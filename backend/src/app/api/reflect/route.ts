import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { proModel, generateResponse } from "@/lib/gemini";
import { addMemory } from "@/lib/chroma";
import { getDefaultPersona } from "@/lib/persona";

/**
 * 直近のチャットログに基づいて内省処理を実行し、ペルソナの状態を更新しRDBに保存する POST リクエスト
 *
 * 動作の詳細:
 * - 直近のチャットログと最新のペルソナ状態を取得します。
 * - 設定された LLM に対して、リフレクション用のプロンプト（日本語）を送信します。
 * - LLM からの JSON レスポンス（`thought`、`statusUpdate`、`permanentMemory` を含む）を解析します。
 * - 体力（health）、気分（mood）、信頼度（trust）の更新値を範囲内に収めた（clamped）状態で、新しいペルソナ状態レコードを作成します。
 * - `permanentMemory` が存在する場合、それをセマンティックメモリ（ベクトルストア）に保存します。
 * - 解析済みのリフレクション結果（ペイロード）を返します。
 *
 * @param req - リフレクション操作のための Next.js POST リクエスト
 * @returns 成功時は `reflection` オブジェクトを含む JSON レスポンス。
 * ログが存在しない場合は案内メッセージを、失敗時はエラーメッセージと適切な HTTP ステータスコードを返します。
 */
export async function POST(req: NextRequest) {
    try {
        console.log("[Reflect API] Starting reflection process...");

        let model = proModel;
        try {
            const body = await req.json();
            if (body && body.model) model = body.model;
        } catch (e) {
            // No body or invalid JSON, ignore
        }
        console.log("[Reflect API] Using model:", model);

        // デフォルトのペルソナを取得
        const persona = await getDefaultPersona();

        // 1. 直近のチャットログを最大20件取得 (最新の会話を内省の材料にする)
        const recentLogs = await prisma.chatLog.findMany({
            where: { personaId: persona.id },
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        if (recentLogs.length === 0) {
            console.log("[Reflect API] No chat logs found. Skipping.");
            return NextResponse.json({ message: "No logs to reflect on." });
        }
        console.log(`[Reflect API] Found ${recentLogs.length} recent logs.`);

        const logSummary = recentLogs.map((l: any) => `${l.role}: ${l.content}`).join("\n");

        // 2. 現在のペルソナステータスを取得 (更新のベースとなる値)
        console.log("[Reflect API] Fetching current status...");
        const status = await prisma.personaStatus.findFirst({
            where: { personaId: persona.id },
            orderBy: { updatedAt: 'desc' }
        });

        if (!status) {
            console.error("[Reflect API] Persona status not found!");
            return NextResponse.json({ error: "Status not found" }, { status: 404 });
        }
        console.log("[Reflect API] Current status:", status);

        // 3. Gemini Pro（推論モデル）を使用して自己内省を実行
        console.log("[Reflect API] Sending data to Gemini Pro for reflection...");
        const reflectionPrompt = `
            以下の直近の会話内容を内省し、自分の性格やステータスにどのような影響を与えるべきか考えてください。
            会話履歴:
            ${logSummary}

            現在のステータス:
            身長: ${status.height}, 体重: ${status.weight}, 健康: ${status.health}, 情緒: ${status.mood}, 信頼: ${status.trust}

            内省の結果として、以下のJSON形式で回答してください：
            {
            "thought": "（内省の思考過程）",
            "statusUpdate": { "health": 1, "mood": -5, "trust": 10 },
            "permanentMemory": "（今後忘れてはいけない重要な教訓や記憶）"
            }
            `;

        const resultText = await generateResponse(model, reflectionPrompt, {
            status,
            memories: []
        });
        console.log("[Reflect API] Gemini Pro Raw Response:", resultText);

        // 4. LLMの返答からJSONを抽出してパース (Markdownのコードブロックなどを考慮)
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("[Reflect API] Failed to find JSON in response.");
            throw new Error("Failed to parse reflection result");
        }
        const reflection = JSON.parse(jsonMatch[0]);
        console.log("[Reflect API] Parsed reflection:", reflection);

        // 5. RDB (MySQL) のステータスを更新 (新レコードの作成)
        // 数値を 0-100 の範囲にクランプして保存
        console.log("[Reflect API] Updating status in Prisma...");
        await prisma.personaStatus.create({
            data: {
                personaId: persona.id,
                health: Math.min(100, Math.max(0, status.health + (reflection.statusUpdate.health || 0))),
                mood: Math.min(100, Math.max(0, status.mood + (reflection.statusUpdate.mood || 0))),
                trust: Math.min(100, Math.max(0, status.trust + (reflection.statusUpdate.trust || 0))),
                height: status.height, // 身長・体重などは現在は不偏とする
                weight: status.weight
            }
        });

        // 6. 内省イベント（思考過程含む）をデータベースに保存
        console.log("[Reflect API] Saving reflection event to DB...");
        await prisma.reflectionEvent.create({
            data: {
                personaId: persona.id,
                thought: reflection.thought,
                statusUpdate: reflection.statusUpdate,
                permanentMemory: reflection.permanentMemory
            }
        });

        // 7. ベクトルストア (ChromaDB) への「恒久的な記憶」の保存
        if (reflection.permanentMemory) {
            console.log("[Reflect API] Saving permanent memory to ChromaDB...");
            await addMemory(
                `ref_${Date.now()}`,
                reflection.permanentMemory,
                {
                    type: "reflection",
                    thought: reflection.thought,
                    personaId: persona.id
                }
            );
        }

        console.log("[Reflect API] Reflection process completed successfully.");
        return NextResponse.json({ reflection });
    } catch (error: any) {
        console.error("[Reflect API Error] Details:", {
            message: error.message,
            stack: error.stack,
            cause: error.cause
        });

        // Gemini APIからの429エラーなどを検知して適切なステータスを返す
        const status = error.message?.includes("429") || error.status === 429 ? 429 : 500;
        const errorMessage = status === 429
            ? "現在内省機能の利用枠を超えています。少し時間を置いてから再度お試しください。"
            : error.message;

        return NextResponse.json({ error: errorMessage }, { status });
    }
}