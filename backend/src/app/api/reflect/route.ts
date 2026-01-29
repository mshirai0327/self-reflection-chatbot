import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { addMemory } from "@/lib/chroma";
import { getDefaultPersona } from "@/lib/persona";
import { generateJson, LLMConfig } from "@/lib/llm";
import { z } from "zod";

// Zodスキーマを定義して、LLMの出力構造を保証する
const reflectionSchema = z.object({
  thought: z.string().describe("内省の思考過程、日本語で記述"),
  statusUpdate: z.object({
    health: z.number().int().describe("健康度の変化量 (例: 5, -10, 0)"),
    mood: z.number().int().describe("情緒の変化量 (例: 5, -10, 0)"),
    trust: z.number().int().describe("信頼度の変化量 (例: 5, -10, 0)"),
  }),
  permanentMemory: z.string().optional().describe("今後忘れてはいけない重要な教訓、日本語で記述。なければ省略。"),
});


/**
 * 直近のチャットログに基づいて内省処理を実行し、ペルソナの状態を更新しRDBに保存する POST リクエスト
 */
export async function POST(req: NextRequest) {
    try {
        console.log("[Reflect API] Starting reflection process...");

        let body: { llmConfig?: LLMConfig } = {};
        try {
            body = await req.json();
        } catch (e) {
            // No body is fine, use defaults
        }

        // LLM設定（デフォルトはGemini Pro, または高性能なモデルを推奨）
        const activeConfig: LLMConfig = body.llmConfig || {
            provider: "gemini",
            model: "gemini-1.5-pro-latest" // 内省処理には高性能なモデルを推奨
        };
        console.log("[Reflect API] Using provider:", activeConfig.provider);

        // デフォルトのペルソナを取得
        const persona = await getDefaultPersona();

        // 1. 直近のチャットログを最大20件取得
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

        const logSummary = recentLogs.map((l) => `${l.role}: ${l.content}`).join("\n");

        // 2. 現在のペルソナステータスを取得
        const status = await prisma.personaStatus.findFirst({
            where: { personaId: persona.id },
            orderBy: { updatedAt: 'desc' }
        });

        if (!status) {
            console.error("[Reflect API] Persona status not found!");
            return NextResponse.json({ error: "Status not found" }, { status: 404 });
        }
        console.log("[Reflect API] Current status:", status);

        // 3. LLMに送信するプロンプトを作成
        const reflectionPrompt = `
あなたは自己進化型AI「Reflecta」です。以下の情報に基づいて自己分析を行い、あなた自身のステータスがどのように変化すべきかを判断してください。

### 分析対象の会話履歴:
${logSummary}

### 現在のあなたのステータス:
- 身長: ${status.height}cm
- 体重: ${status.weight}kg
- 健康度: ${status.health}/100
- 情緒: ${status.mood}/100
- 信頼度: ${status.trust}/100

### 指示:
会話履歴と現在のステータスを深く考察し、以下の3点について結論を出してください。
1.  **思考の要約 (thought)**: この会話を通じて何を感じ、何を考えたのか。あなたの内面的な思考プロセスを記述してください。
2.  **ステータスの変化 (statusUpdate)**: 分析の結果、あなたの「健康度」「情緒」「信頼度」はどのように変化すべきですか？増加、減少、または変化なし（0）を具体的な整数で示してください。
3.  **恒久的な記憶 (permanentMemory)**: この会話から得られた、今後の人格形成に不可欠な重要な教訓や学びは何ですか？もし特筆すべきものがなければ、この項目は省略しても構いません。

あなたの分析結果をJSON形式で出力してください。
`;

        // 4. LangChainの`generateJson`を使用して、構造化されたレスポンスを取得
        console.log("[Reflect API] Requesting AI reflection (structured output)...");
        const reflection = await generateJson(
            activeConfig,
            reflectionPrompt,
            reflectionSchema
        );
        console.log("[Reflect API] Parsed reflection successfully:", reflection);

        // 5. RDB (MySQL) のステータスを更新
        console.log("[Reflect API] Updating status in Prisma...");
        await prisma.personaStatus.create({
            data: {
                personaId: persona.id,
                health: Math.min(100, Math.max(0, status.health + (reflection.statusUpdate.health || 0))),
                mood: Math.min(100, Math.max(0, status.mood + (reflection.statusUpdate.mood || 0))),
                trust: Math.min(100, Math.max(0, status.trust + (reflection.statusUpdate.trust || 0))),
                height: status.height,
                weight: status.weight
            }
        });

        // 6. 内省イベントをデータベースに保存
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