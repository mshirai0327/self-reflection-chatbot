import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { addMemory } from "@/lib/chroma";
import { getDefaultPersona } from "@/lib/persona";
import { generateLLMResponse, LLMConfig } from "@/lib/llm";

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

        let body: any = {};
        try {
            body = await req.json();
        } catch (e) {
            // No body
        }

        // LLM設定（デフォルトはGemini Pro）
        const activeConfig: LLMConfig = body.llmConfig || {
            provider: "gemini",
            model: "gemini-2.5-pro"
        };
        console.log("[Reflect API] Using provider:", activeConfig.provider);

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

        //todo 会話ログについて。前回の内省から今回の内省までの会話をDBから取得するべき
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

        // 3. 選択されたLLMを使用して自己内省を実行
        console.log("[Reflect API] Requesting AI reflection...");
        const reflectionPrompt = `
以下の直近の会話内容を内省してください。
分析に基づき、自分の性格やステータス（健康度、情緒、信頼度）に与える影響を決定してください。

会話履歴:
${logSummary}

現在のステータス:
身長: ${status.height}cm, 体重: ${status.weight}kg, 健康: ${status.health}, 情緒: ${status.mood}, 信頼: ${status.trust}

### 出力指示
- 必ず以下のJSONフォーマットのみを出力してください。
- 文末に解説や追加の文章を一切含めないでください。
- JSON以外のテキスト（「はい、お答えします」等）も一切含めないでください。
- statusUpdate の値は整数である必要があります（例: +5, -10）。

{
  "thought": "（内省の思考過程、日本語で記述）",
  "statusUpdate": { "health": 0, "mood": 0, "trust": 0 },
  "permanentMemory": "（今後忘れてはいけない重要な教訓、日本語で記述）"
}
`;

        const resultText = await generateLLMResponse(activeConfig, reflectionPrompt, {
            status,
            memories: []
        });
        console.log("[Reflect API] AI Raw Response received.");

        // 4. LLMの返答からJSONを抽出してパース (Markdownのコードブロックなどを考慮)
        let reflection;
        try {
            // 最も外側の { } を探す
            const firstBrace = resultText.indexOf('{');
            const lastBrace = resultText.lastIndexOf('}');

            if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
                console.error("[Reflect API] No JSON braces found. Raw Response:", resultText);
                throw new Error("No valid JSON object found in AI response");
            }

            let jsonString = resultText.substring(firstBrace, lastBrace + 1);

            // 一部のLLMが "+5" のように符号を出力してJSONパースに失敗するのを防ぐ
            // 数値の前の : +5 を : 5 に置換する (負の数は - でパースできるのでそのまま)
            jsonString = jsonString.replace(/:\s*\+(\d+)/g, ': $1');

            reflection = JSON.parse(jsonString);
            console.log("[Reflect API] Parsed reflection successfully.");
        } catch (parseError: any) {
            console.error("[Reflect API] JSON Parse Error:", parseError.message);
            console.error("[Reflect API] Raw Response which caused error:", resultText);
            throw new Error(`Failed to parse AI reflection: ${parseError.message}`);
        }

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