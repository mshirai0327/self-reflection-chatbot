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
 * 単一ペルソナに対して内省を実行するヘルパー関数。
 * ステータス取得 → Python Service呼び出し → ステータス更新 → ChromaDB保存 → 内省イベント保存を行う。
 * 1:1チャットでもグループチャットでも同じロジックで内省を実行できる。
 */
async function reflectForPersona(params: {
    personaId: string;
    logSummary: string;
    chatId: string | null;
    groupChatId: string | null;
    activeConfig: LLMConfig;
}): Promise<{ reflection: ReflectionResult & { prompt: string } }> {
    const { personaId, logSummary, chatId, groupChatId, activeConfig } = params;

    // 1. 現在のペルソナステータスを取得
    const fullStatus = await getLatestStatus(personaId);
    if (!fullStatus) {
        throw new Error(`Persona status not found for ${personaId}`);
    }

    const status = flattenStatus(fullStatus);
    if (!status) {
        throw new Error(`Failed to flatten status for ${personaId}`);
    }

    // 2. Python LLM Serviceに内省を依頼
    const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://llm-service:8080";
    const reflectController = new AbortController();
    const reflectTimeoutId = setTimeout(() => reflectController.abort(), REFLECT_TIMEOUT_MS);

    let res: Response;
    try {
        res = await fetch(`${llmServiceUrl}/reflect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
            throw new Error(`LLM Service request timed out after ${REFLECT_TIMEOUT_MS}ms`);
        }
        throw fetchError;
    } finally {
        clearTimeout(reflectTimeoutId);
    }

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`LLM Service Reflection Error (${res.status}): ${errorText}`);
    }

    let reflection: unknown;
    try {
        reflection = await res.json();
    } catch (parseError) {
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    validateReflection(reflection);
    console.log(`[Reflect API] Reflection result for ${personaId}:`, reflection);

    // 3. ステータス更新値の計算 (Clamp 0-100)
    let trustBonus = 0;
    let friendlinessBonus = 0;
    if (reflection.growthFeedback) {
        trustBonus = 2;
        friendlinessBonus = 2;
    }

    const newHealth = Math.min(100, Math.max(0, (status.health ?? 100) + (reflection.statusUpdate.health || 0)));
    const newMood = Math.min(100, Math.max(0, (status.mood ?? 50) + (reflection.statusUpdate.mood || 0)));
    const newTrust = Math.min(100, Math.max(0, (status.trust ?? 50) + (reflection.statusUpdate.trust || 0) + trustBonus));
    const newFriendliness = Math.min(100, Math.max(0, (status.friendliness ?? 50) + (reflection.statusUpdate.friendliness || 0) + friendlinessBonus));

    const quantityReversibleValue = [
        { label: "weight", value: status.weight ?? 50.0, unit: "kg" },
        { label: "bloodSugar", value: status.bloodSugar ?? 90.0, unit: "mg/dL" },
        { label: "bloodPressureSys", value: status.bloodPressureSys ?? 110.0, unit: "mmHg" },
        { label: "bloodPressureDia", value: status.bloodPressureDia ?? 70.0, unit: "mmHg" },
        { label: "sleepTime", value: status.sleepTime ?? 7.5, unit: "h" },
        { label: "sleepQuality", value: status.sleepQuality ?? 80.0, unit: null },
    ];

    const semiquantityReversibleValue = [
        { label: "health", value: newHealth, unit: null },
        { label: "mood", value: newMood, unit: null },
        { label: "trust", value: newTrust, unit: null },
        { label: "friendliness", value: newFriendliness, unit: null },
    ];

    // 4. RDB更新（トランザクション）
    if (!fullStatus.statusId) {
        throw new Error("Critical: fullStatus.statusId is undefined or null!");
    }

    const currentHeight = status.height ?? 160.0;
    const heightIncrease = reflection.statusUpdate.heightIncrease ?? 0;
    const newHeight = parseFloat((currentHeight + heightIncrease).toFixed(1));

    await prisma.$transaction([
        prisma.quantityIrreversibleStatus.create({
            data: {
                personaStatusId: fullStatus.statusId,
                height: newHeight,
                boneDensity: fullStatus.quantityIrreversible?.boneDensity ?? 100.0,
                gripStrength: fullStatus.quantityIrreversible?.gripStrength,
                voicePitch: fullStatus.quantityIrreversible?.voicePitch,
                eyesight: fullStatus.quantityIrreversible?.eyesight,
                hearingAbility: fullStatus.quantityIrreversible?.hearingAbility,
                version: (fullStatus.quantityIrreversible?.version || 0) + 1,
            }
        }),
        prisma.quantityReversibleStatus.create({
            data: {
                personaStatusId: fullStatus.statusId,
                value: quantityReversibleValue,
                version: (fullStatus.quantityReversible?.version || 0) + 1,
            }
        }),
        prisma.semiquantityReversibleStatus.create({
            data: {
                personaStatusId: fullStatus.statusId,
                value: semiquantityReversibleValue,
                version: (fullStatus.semiquantityReversible?.version || 0) + 1,
            }
        }),
    ]);

    // 5. 内省イベント保存
    await prisma.reflectionEvent.create({
        data: {
            personaId,
            response: reflection as unknown as import("@prisma/client").Prisma.InputJsonValue,
            prompt: (reflection as any).prompt || "(Generated in Python Service)"
        }
    });

    // 6. ChromaDB保存
    const memoryChatId = chatId || groupChatId;
    if (reflection.permanentMemory && memoryChatId) {
        await addMemory(ulid(), reflection.permanentMemory, {
            type: "reflection",
            thought: reflection.thought,
            personaId,
        }, memoryChatId);
    }

    if (reflection.newMemories && reflection.newMemories.length > 0 && memoryChatId) {
        for (const memory of reflection.newMemories) {
            await addMemory(ulid(), memory, {
                type: "fact",
                source: "reflection",
                personaId,
                reflectedAt: new Date().toISOString(),
            }, memoryChatId);
        }
    }

    return {
        reflection: {
            ...reflection,
            prompt: "(Generated in Python Service)",
        },
    };
}

/**
 * 直近のチャットログに基づいて内省処理を実行し、ペルソナの状態を更新しRDBに保存する POST リクエスト
 */
export async function POST(req: NextRequest) {
    try {
        console.log("[Reflect API] Starting reflection process...");

        let body: { llmConfig?: LLMConfig, chatId?: string, groupChatId?: string } = {};
        try {
            body = await req.json();
        } catch (e) {
            // No body is fine, use defaults
        }

        const chatId = body.chatId;
        const groupChatId = body.groupChatId;
        if (!chatId && !groupChatId) {
            console.error("[Reflect API] chatId or groupChatId is missing in request body.");
            return NextResponse.json({ error: "chatId or groupChatId is required for reflection." }, { status: 400 });
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

        console.log(`[Reflect API] Using provider: ${activeConfig.provider}, chatId: ${chatId || 'N/A'}, groupChatId: ${groupChatId || 'N/A'}`);

        // ========== グループチャットの場合: 全参加ペルソナに対して内省を実行 ==========
        if (groupChatId) {
            const groupChat = await prisma.groupChat.findUnique({
                where: { id: groupChatId },
                include: {
                    participants: {
                        include: { persona: true },
                        orderBy: { sortOrder: 'asc' }
                    }
                }
            });

            if (!groupChat) {
                return NextResponse.json({ error: "Group chat not found" }, { status: 404 });
            }

            // グループチャットのログを取得
            const recentLogs = await prisma.chatLog.findMany({
                where: { groupChatId },
                take: 20,
                orderBy: { createdAt: 'desc' }
            });

            if (recentLogs.length === 0) {
                return NextResponse.json({ message: "No logs to reflect on." });
            }

            // 前回の内省からのユーザー発言回数チェック（最初のペルソナで代表）
            const firstPersonaId = groupChat.participants[0]?.personaId;
            const reflectionEvent = await prisma.reflectionEvent.findFirst({
                where: { personaId: firstPersonaId },
                orderBy: { createdAt: 'desc' }
            });

            const userMessageCount = await prisma.chatLog.count({
                where: {
                    groupChatId,
                    role: 'user',
                    ...(reflectionEvent ? { createdAt: { gt: reflectionEvent.createdAt } } : {})
                }
            });

            const REQUIRED_TURNS = 5;
            if (userMessageCount < REQUIRED_TURNS) {
                return NextResponse.json({
                    error: `内省を行うには、前回の内省から${REQUIRED_TURNS}回以上のユーザーの発言が必要です。(現在: ${userMessageCount}回)`
                }, { status: 400 });
            }

            const logSummary = recentLogs.slice().reverse().map((l) => `${l.role}: ${l.content}`).join("\n");
            const allResults: any[] = [];

            // 各ペルソナに対して内省を直列実行
            for (const participant of groupChat.participants) {
                const personaId = participant.personaId;
                console.log(`[Reflect API] Reflecting for persona: ${participant.persona.name} (${personaId})`);

                try {
                    const result = await reflectForPersona({
                        personaId,
                        logSummary,
                        chatId: null,
                        groupChatId,
                        activeConfig,
                    });
                    allResults.push({
                        personaId,
                        personaName: participant.persona.name,
                        ...result,
                    });
                } catch (err: any) {
                    console.error(`[Reflect API] Failed to reflect for ${participant.persona.name}:`, err.message);
                    allResults.push({
                        personaId,
                        personaName: participant.persona.name,
                        error: err.message,
                    });
                }
            }

            return NextResponse.json({
                reflection: allResults[0]?.reflection || allResults[0],
                allReflections: allResults,
            });
        }

        // ========== 1:1チャットの場合 ==========
        // 5. チャットに関連付けられたペルソナを取得
        const chat = await prisma.chat.findUnique({
            where: { id: chatId! },
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

        // reflectForPersonaで内省実行
        const result = await reflectForPersona({
            personaId,
            logSummary,
            chatId: chatId!,
            groupChatId: null,
            activeConfig,
        });

        console.log("[Reflect API] Reflection process completed successfully.");
        return NextResponse.json({
            reflection: result.reflection,
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