import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { addMemory } from "@/lib/chroma";
import { getLatestStatus, flattenStatus } from "@/lib/persona";
import { LLMConfig } from "@/lib/llm";
import { isProviderAllowed } from "@/lib/env";
import { ulid } from "ulid";

/** LLMサービスへのリクエストタイムアウト（ミリ秒） */
const REFLECT_TIMEOUT_MS = 15_000;

/**
 * Python LLMサービスから返却される内省結果の期待する型。
 * バリデーション関数 {@link validateReflection} で検証する。
 */
type ReflectionResult = {
    statusUpdate: {
        health: number;
        mood: number;
        trust: number;
        friendliness: number;
        heightIncrease?: number;
    };
    growthFeedback?: string | null;
    permanentMemory?: string | null;
    newMemories?: string[];
    thought?: string;
    [key: string]: unknown;
};

/**
 * Python LLMサービスから返却されたJSONが期待する形状かどうかを検証するガード関数。
 *
 * @param data - 検証対象のオブジェクト
 * @returns `data` が {@link ReflectionResult} 型であれば `true`
 * @throws バリデーション失敗時に詳細なメッセージを含む Error をスローする
 */
function validateReflection(data: unknown): asserts data is ReflectionResult {
    if (typeof data !== "object" || data === null) {
        throw new Error(`[Reflect API] Invalid reflection response: expected object, got ${typeof data}`);
    }
    const d = data as Record<string, unknown>;

    if (typeof d.statusUpdate !== "object" || d.statusUpdate === null) {
        throw new Error("[Reflect API] Invalid reflection response: 'statusUpdate' is missing or not an object");
    }
    const su = d.statusUpdate as Record<string, unknown>;

    const numericFields = ["health", "mood", "trust", "friendliness"] as const;
    for (const field of numericFields) {
        if (typeof su[field] !== "number") {
            throw new Error(
                `[Reflect API] Invalid reflection response: 'statusUpdate.${field}' is missing or not a number (got ${typeof su[field]})`
            );
        }
    }
}

/**
 * 直近のチャットログに基づいて内省処理を実行し、ペルソナの状態を更新しRDBに保存する POST リクエスト
 */
export async function POST(req: NextRequest) {
    try {
        console.log("[Reflect API] Starting reflection process...");

        let body: { llmConfig?: LLMConfig, chatId?: string } = {};
        try {
            body = await req.json();
        } catch (e) {
            // No body is fine, use defaults
        }

        const chatId = body.chatId;
        if (!chatId) {
            console.error("[Reflect API] chatId is missing in request body.");
            return NextResponse.json({ error: "chatId is required for reflection." }, { status: 400 });
        }

        // LLM設定（デフォルトはGemini Pro, または高性能なモデルを推奨）
        const activeConfig: LLMConfig = body.llmConfig || {
            provider: "gemini",
            model: "gemini-1.5-pro-latest" // 内省処理には高性能なモデルを推奨
        };

        // SSRF対策: 本番環境では local プロバイダーを拒否
        if (!isProviderAllowed(activeConfig.provider)) {
            return NextResponse.json(
                { error: "Local LLM provider is not available in this environment." },
                { status: 403 }
            );
        }

        console.log(`[Reflect API] Using provider: ${activeConfig.provider}, chatId: ${chatId}`);

        // 5. デフォルトのペルソナではなく、チャットに関連付けられたペルソナを取得
        const chat = await prisma.chat.findUnique({
            where: { id: chatId },
            include: { persona: true }
        });

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        const personaId = chat.personaId;
        console.log(`[Reflect API] Reflecting on persona: ${personaId} (Chat: ${chat.title})`);

        // 1. 直近のチャットログを最大20件取得（対象のチャットIDに限定）
        const recentLogs = await prisma.chatLog.findMany({
            where: {
                personaId: personaId,
                chatId: chatId
            },
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        if (recentLogs.length === 0) {
            console.log("[Reflect API] No chat logs found. Skipping.");
            return NextResponse.json({ message: "No logs to reflect on." });
        }
        console.log(`[Reflect API] Found ${recentLogs.length} recent logs.`);

        // 前回の内省からのユーザー発言回数をチェック (5回以上必要)
        const reflectionEvent = await prisma.reflectionEvent.findFirst({
            where: { personaId: personaId },
            orderBy: { createdAt: 'desc' }
        });
        
        const userMessageCountSinceLastReflection = await prisma.chatLog.count({
            where: {
                chatId: chatId,
                role: 'user',
                ...(reflectionEvent ? { createdAt: { gt: reflectionEvent.createdAt } } : {})
            }
        });

        const REQUIRED_TURNS = 5;
        if (userMessageCountSinceLastReflection < REQUIRED_TURNS) {
            console.log(`[Reflect API] Not enough user messages since last reflection. Count: ${userMessageCountSinceLastReflection}, Required: ${REQUIRED_TURNS}`);
            return NextResponse.json({ error: `内省を行うには、前回の内省から${REQUIRED_TURNS}回以上のユーザーの発言が必要です。(現在: ${userMessageCountSinceLastReflection}回)` }, { status: 400 });
        }

        const logSummary = recentLogs.slice().reverse().map((l) => `${l.role}: ${l.content}`).join("\n");

        // 2. 現在のペルソナステータスを取得
        const fullStatus = await getLatestStatus(personaId);

        if (!fullStatus) {
            console.error("[Reflect API] Persona status not found! (No status ID linked to persona)");
            return NextResponse.json({ error: "Status ID not found on persona. Please run seed script." }, { status: 404 });
        }

        const status = flattenStatus(fullStatus);
        if (!status) {
            console.error("[Reflect API] Failed to flatten status. Some sub-tables might be missing.");
            return NextResponse.json({ error: "Incomplete status data" }, { status: 500 });
        }
        console.log("[Reflect API] Current status:", status);

        // 3. Python LLM Serviceに内省を依頼
        const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://llm-service:8080";
        console.log(`[Reflect API] Delegating reflection to Python Service: ${llmServiceUrl}`);

        /* 
         * Python側 (Result) に合わせてプロンプト構築はPython側で行うため、
         * JS側では logSummary と status を送るだけでよい。
         */

        // AbortController でタイムアウトを制御する
        const reflectController = new AbortController();
        const reflectTimeoutId = setTimeout(() => reflectController.abort(), REFLECT_TIMEOUT_MS);

        let res: Response;
        try {
            res = await fetch(`${llmServiceUrl}/reflect`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    log_summary: logSummary,
                    status: status,
                    llm_config: activeConfig ? {
                        provider: activeConfig.provider || "gemini",
                        model: activeConfig.model,
                        api_key: activeConfig.apiKey,
                        base_url: activeConfig.baseURL || activeConfig.endpoint,
                    } : null,
                }),
                signal: reflectController.signal,
            });
        } catch (fetchError) {
            // タイムアウト（AbortError）の場合は専用のエラーメッセージを返す
            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                throw new Error(
                    `[Reflect API] LLM Service request timed out after ${REFLECT_TIMEOUT_MS}ms`
                );
            }
            throw fetchError;
        } finally {
            // 成功・失敗にかかわらずタイマーを解除してリソースリークを防ぐ
            clearTimeout(reflectTimeoutId);
        }

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`LLM Service Reflection Error (${res.status}): ${errorText}`);
        }

        // JSONパース失敗に備えて try-catch でラップする
        let reflection: unknown;
        try {
            reflection = await res.json();
        } catch (parseError) {
            throw new Error(
                `[Reflect API] Failed to parse JSON response from LLM Service: ${
                    parseError instanceof Error ? parseError.message : String(parseError)
                }`
            );
        }

        // レスポンスの shape をバリデーションし、不正な場合は早期にエラーをスローする
        validateReflection(reflection);

        console.log("[Reflect API] Received reflection result from Python Service:", reflection);


        // ステータス更新値の計算
        console.log("[Reflect API] Calculating status updates...");

        // 新しいステータス値の計算 (Clamp 0-100)
        let trustBonus = 0;
        let friendlinessBonus = 0;
        if (reflection.growthFeedback) {
            console.log("[Reflect API] Growth feedback detected. Applying bonus to trust and friendliness.");
            trustBonus = 2;
            friendlinessBonus = 2;
        }

        const newHealth = Math.min(100, Math.max(0, (status.health ?? 100) + (reflection.statusUpdate.health || 0)));
        const newMood = Math.min(100, Math.max(0, (status.mood ?? 50) + (reflection.statusUpdate.mood || 0)));
        const newTrust = Math.min(100, Math.max(0, (status.trust ?? 50) + (reflection.statusUpdate.trust || 0) + trustBonus));
        const newFriendliness = Math.min(100, Math.max(0, (status.friendliness ?? 50) + (reflection.statusUpdate.friendliness || 0) + friendlinessBonus));

        // Lv3-1: QuantityReversible (JSON構築) - 現状は内省で変化しないので値を引き継ぐ
        // note: 内省で変化させるか、またはgraphなどで変化させるか
        const quantityReversibleValue = [
            { label: "weight", value: status.weight ?? 50.0, unit: "kg" },
            { label: "bloodSugar", value: status.bloodSugar ?? 90.0, unit: "mg/dL" },
            { label: "bloodPressureSys", value: status.bloodPressureSys ?? 110.0, unit: "mmHg" },
            { label: "bloodPressureDia", value: status.bloodPressureDia ?? 70.0, unit: "mmHg" },
            { label: "sleepTime", value: status.sleepTime ?? 7.5, unit: "h" },
            { label: "sleepQuality", value: status.sleepQuality ?? 80.0, unit: null },
        ];

        // Lv3-2: SemiquantityReversible (JSON構築)
        const semiquantityReversibleValue = [
            { label: "health", value: newHealth, unit: null },
            { label: "mood", value: newMood, unit: null },
            { label: "trust", value: newTrust, unit: null },
            { label: "friendliness", value: newFriendliness, unit: null },
        ];

        // 5. RDB (PostgreSQL) のステータスを更新 (Hubパターンの新スキーマに対応)
        console.log("[Reflect API] Updating status in Prisma (Hub pattern 1:N)...");



        // Hub (PersonaStatus) は既に存在するので、そのIDを使って子テーブルに履歴を追加する
        console.log("[Reflect API] Target Hub Status ID:", fullStatus.statusId);

        if (!fullStatus.statusId) {
            throw new Error("Critical: fullStatus.statusId is undefined or null!");
        }

        // 身長の更新ロジック: 現在の身長 + 増加分 (デフォルト0)
        const currentHeight = status.height ?? 160.0;
        const heightIncrease = reflection.statusUpdate.heightIncrease ?? 0;
        const newHeight = parseFloat((currentHeight + heightIncrease).toFixed(1)); // 小数点第1位まで

        if (heightIncrease > 0) {
            console.log(`[Reflect API] Height increase detected: +${heightIncrease}cm (New height: ${newHeight}cm)`);
        }

        const irreversibleData = {
            personaStatusId: fullStatus.statusId,
            height: newHeight,
            boneDensity: fullStatus.quantityIrreversible?.boneDensity ?? 100.0,
            gripStrength: fullStatus.quantityIrreversible?.gripStrength,
            voicePitch: fullStatus.quantityIrreversible?.voicePitch,
            eyesight: fullStatus.quantityIrreversible?.eyesight,
            hearingAbility: fullStatus.quantityIrreversible?.hearingAbility,
            version: (fullStatus.quantityIrreversible?.version || 0) + 1,
        };

        const quantityReversibleData = {
            personaStatusId: fullStatus.statusId,
            value: quantityReversibleValue,
            version: (fullStatus.quantityReversible?.version || 0) + 1,
        };

        const semiquantityReversibleData = {
            personaStatusId: fullStatus.statusId,
            value: semiquantityReversibleValue,
            version: (fullStatus.semiquantityReversible?.version || 0) + 1,
        };

        // トランザクションを使用してアトミックに更新する
        try {
            console.log("[Reflect API] Executing atomic transaction for status records...");
            await prisma.$transaction([
                prisma.quantityIrreversibleStatus.create({ data: irreversibleData }),
                prisma.quantityReversibleStatus.create({ data: quantityReversibleData }),
                prisma.semiquantityReversibleStatus.create({ data: semiquantityReversibleData }),
            ]);
            console.log("[Reflect API] Transaction completed successfully.");
        } catch (e: any) {
            console.error("[Reflect API] Transaction failed:", e.message);
            throw new Error(`Failed to update status records atomically: ${e.message}`);
        }

        // Persona自体の更新は不要 (statusIdは固定)

        // 6. 内省イベントをデータベースに保存
        console.log("[Reflect API] Saving reflection event to DB...");
        await prisma.reflectionEvent.create({
            data: {
                personaId: personaId,
                // ReflectionResult は index signature を持つため Prisma の InputJsonValue へ
                // 直接代入できない。実体はJSONパース済みの安全なオブジェクトなので unknown 経由でキャストする
                response: reflection as unknown as import("@prisma/client").Prisma.InputJsonValue,
                prompt: "(Generated in Python Service)"
            }
        });

        // 7. ベクトルストア (ChromaDB) への「恒久的な記憶」の保存
        if (reflection.permanentMemory) {
            console.log("[Reflect API] Saving permanent memory to ChromaDB...");
            await addMemory(
                ulid(),
                reflection.permanentMemory,
                {
                    type: "reflection",
                    thought: reflection.thought,
                    personaId: personaId
                },
                chatId // chatIdを付与
            );
        }

        // 8. 抽出された新しい記憶 (newMemories) をChromaDBに保存
        if (reflection.newMemories && reflection.newMemories.length > 0) {
            console.log(`[Reflect API] Saving ${reflection.newMemories.length} new memories to ChromaDB...`);
            for (const memory of reflection.newMemories) {
                await addMemory(
                    ulid(),
                    memory,
                    {
                        type: "fact",
                        source: "reflection",
                        personaId: personaId,
                        reflectedAt: new Date().toISOString()
                    },
                    chatId // chatIdを付与
                );
            }
        }

        console.log("[Reflect API] Reflection process completed successfully.");
        return NextResponse.json({
            reflection: {
                ...reflection,
                prompt: "(Generated in Python Service)"
            }
        });

    } catch (error: unknown) {
        let errorMessage = "An unknown error occurred during reflection";
        let errorStatus = 500;
        let errorDetails: Record<string, unknown> = {};

        if (error instanceof Error) {
            errorMessage = error.message;
            errorDetails = { message: error.message, stack: error.stack, cause: (error as any).cause };

            const errorAny = error as any;
            const isRateLimit = errorAny.message?.includes("429") || errorAny.status === 429;

            if (isRateLimit) {
                errorStatus = 429;
                errorMessage = "現在内省機能の利用枠を超えています。少し時間を置いてから再度お試しください。";
            }
        } else {
            errorDetails = { error };
        }

        console.error("[Reflect API Error] Details:", errorDetails);

        return NextResponse.json({ error: errorMessage }, { status: errorStatus });
    }
}