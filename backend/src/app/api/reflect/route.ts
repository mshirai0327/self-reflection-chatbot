import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { addMemory } from "@/lib/chroma";
import { getDefaultPersona, getLatestStatus, flattenStatus } from "@/lib/persona";
import { generateJson, LLMConfig } from "@/lib/llm";
import { z } from "zod";
import { ulid } from "ulid";

// Zodスキーマを定義して、LLMの出力構造を保証する
const reflectionSchema = z.object({
    thought: z.string().describe("内省の思考過程、日本語で記述"),
    statusUpdate: z.object({
        health: z.number().int().describe("健康度の変化量 (例: 5, -10, 0)"),
        mood: z.number().int().describe("情緒の変化量 (例: 5, -10, 0)"),
        trust: z.number().int().describe("信頼度の変化量 (例: 5, -10, 0)"),
        friendliness: z.number().int().describe("親しみやすさの変化量 (例: 5, -10, 0)"),
    }),
    permanentMemory: z.string().optional().describe("今後忘れてはいけない重要な教訓、日本語で記述。なければ省略。"),
    newMemories: z.array(z.string()).describe("会話から得られた、永続的に記憶すべきユーザーの情報、好み、合意事項、または重要な出来事のリスト。挨拶や一時的な文脈は除外すること。"),
    growthFeedback: z.boolean().describe("会話の中で、AI自身の成長（身長の伸びなど）や身体的変化について話題になった、またはユーザーがそれに言及した場合はtrue。それ以外はfalse。"),
});


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

        // 3. LLMに送信するプロンプトを作成
        //todo たまにこのJSONで帰ってこなくて、データが壊れる時がある
        const reflectionPrompt = `
あなたは自己進化型AI「${status.name || 'Reflecta'}」です。以下の情報に基づいて自己分析を行い、あなた自身のステータスがどのように変化すべきかを判断してください。

### 分析対象の会話履歴:
${logSummary}

### 現在のあなたのステータス:
[基本情報]
- 性別: ${status.gender || '不明'}
- 年齢: ${status.birthDate ? new Date(status.birthDate).getFullYear() + '年生まれ' : '不明'}
- 血液型: ${status.bloodType || '不明'}
- クロノタイプ: ${status.chronotype || '不明'}
- 知能指数: ${status.intelligence || '不明'}

[性格特性(Lv1-2)]
- 倫理観: ${status.ethics}/100
- 情熱: ${status.passion}/100
- 好奇心: ${status.curiosity}/100
- 攻撃性: ${status.aggressiveness}/100
- 外向性: ${status.extroversion}/100

[身体情報]
- 身長: ${status.height}cm
- 体重: ${status.weight}kg
- 骨密度: ${status.boneDensity || '不明'}
- 睡眠時間: ${status.sleepTime || '不明'}h (質: ${status.sleepQuality || '?'}/10)
- バイタル: 血圧 ${status.bloodPressureSys || '?'}/${status.bloodPressureDia || '?'}, 血糖値 ${status.bloodSugar || '?'}

[現在の状態(Lv3-2)]
- 健康度: ${status.health}/100
- 情緒: ${status.mood}/100
- 信頼度(ユーザーへの): ${status.trust}/100
- 親しみやすさ: ${status.friendliness}/100

### 指示:
会話履歴と現在のステータスを深く考察し、必ず以下の**JSON形式**で回答を出力してください。
            余計な解説やMarkdownのコードブロック（\`\`\`json ... \`\`\`）は含めず、純粋なJSONオブジェクトのみを出力してください。

1.  **thought**: この会話を通じて何を感じ、何を考えたのか。あなたの内面的な思考プロセスを記述してください。
2.  **statusUpdate**: 分析の結果、あなたの「健康度」「情緒」「信頼度」「親しみやすさ」はどのように変化すべきですか？増加、減少、または変化なし（0）を具体的な整数で示してください。
3.  **permanentMemory**: 自身の人格形成に関わる「教訓」や「自己の指針」があれば記述してください。
4.  **newMemories**: ユーザーに関する重要な情報（趣味、家族構成、予定など）や、二人の間で確立された重要な文脈があれば、箇条書きの配列として抽出してください。「こんにちは」等の挨拶や意味のない雑談は絶対に含めないでください。
5.  **growthFeedback**: 今回の会話で、あなたの身体的成長（背が伸びたことなど）について話題になりましたか？ true または false で答えてください。
`;

        // 4. LangChainの`generateJson`を使用して、構造化されたレスポンスを取得
        console.log("[Reflect API] Requesting AI reflection (structured output)...");
        const reflection = await generateJson(
            activeConfig,
            reflectionPrompt,
            reflectionSchema
        );
        console.log("[Reflect API] Parsed reflection successfully:", reflection);

        // 5. RDB (MySQL) のステータスを更新 (Hubパターンの新スキーマに対応)
        console.log("[Reflect API] Updating status in Prisma (Hub pattern)...");

        // 新しいステータス値の計算 (Clamp 0-100)
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

        // 5. RDB (MySQL) のステータスを更新 (Hubパターンの新スキーマに対応)
        console.log("[Reflect API] Updating status in Prisma (Hub pattern 1:N)...");



        // Hub (PersonaStatus) は既に存在するので、そのIDを使って子テーブルに履歴を追加する
        console.log("[Reflect API] Target Hub Status ID:", fullStatus.statusId);

        if (!fullStatus.statusId) {
            throw new Error("Critical: fullStatus.statusId is undefined or null!");
        }

        // todo 不可逆データと言いながら、実際にはコピーしているだけ。成長しない
        const irreversibleData = {
            personaStatusId: fullStatus.statusId,
            height: status.height ?? 160.0,
            boneDensity: fullStatus.quantityIrreversible?.boneDensity ?? 1.0,
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
                response: reflection, // JSONとして丸ごと保存
                prompt: reflectionPrompt
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
                prompt: reflectionPrompt
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