import { GoogleGenerativeAI } from "@google/generative-ai";

function getGenAI() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set in environment variables");
    }
    return new GoogleGenerativeAI(apiKey);
}

//export const flashModel = "gemini-flash-latest";
//export const flashModel = "gemini-flash-latest";
export const flashModel = "gemini-2.5-flash";
export const proModel = "gemini-2.5-pro";

export interface PersonaContext {
    status: {
        height: number;
        weight: number;
        health: number;
        mood: number;
        trust: number;
    };
    memories: string[];
}

/**
 * 指定された生成モデルを使用して、ペルソナを考慮したレスポンスを生成します。
 *
 * 提供された `context`（ステータスおよびメモリ）からシステム指示文（System Instruction）を構築し、
 * `modelName` で指定された生成モデルを呼び出して、モデルからの返答テキストを返します。
 *
 * @param modelName - 使用する生成モデルの識別子（例: `"gemini-pro-latest"`）。
 * @param prompt - モデルに送信するユーザープロンプト。
 * @param context - システム指示文を構成するために使用される、`status` と `memories` を含む PersonaContext。
 * @returns モデルによって生成されたレスポンスのテキスト。
 */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function callWithRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: any;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            const isRateLimit = error.message?.includes("429") || error.status === 429;
            if (isRateLimit) {
                const delay = RETRY_DELAY_MS * Math.pow(2, i);
                console.warn(`[Gemini] Rate limit hit for ${operationName}. Retrying in ${delay}ms... (Attempt ${i + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
    console.error(`[Gemini] Failed ${operationName} after ${MAX_RETRIES} retries.`);
    throw lastError;
}

export async function generateResponse(modelName: string, prompt: string, context: PersonaContext) {
    const systemInstruction = `
あなたは自己進化型AI「Reflecta」です。
現在のあなたのステータス:
身長: ${context.status.height}cm
体重: ${context.status.weight}kg
健康度: ${context.status.health}/100
情緒: ${context.status.mood}/100
信頼度: ${context.status.trust}/100

過去の関連する記憶:
${context.memories.join("\n")}

上記を踏まえ、一貫性のある人格として回答してください。
`;

    const genAI = getGenAI();

    // Gemmaなどの一部のモデルは API レベルで systemInstruction (Developer Instruction) をサポートしていないため、
    // それらのモデルの場合はプロンプトの先頭に指示を結合する形式にフォールバックします。
    const isSystemInstructionSupported = !modelName.startsWith("gemma");

    const modelOptions: any = { model: modelName };
    if (isSystemInstructionSupported) {
        modelOptions.systemInstruction = systemInstruction;
    }

    const model = genAI.getGenerativeModel(modelOptions, { apiVersion: "v1beta" });

    return callWithRetry(async () => {
        // systemInstruction がサポートされていない場合は、プロンプトの先頭に指示を挿入
        const finalPrompt = isSystemInstructionSupported
            ? prompt
            : `System Instruction:\n${systemInstruction}\n\nUser Message: ${prompt}`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
        });
        return result.response.text();
    }, "generateResponse");
}

export const embeddingModel = process.env.GOOGLE_EMBEDDING_MODEL || "gemini-embedding-001";

export async function embedText(text: string) {
    return callWithRetry(async () => {
        try {
            if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
                throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing from environment variables");
            }
            const genAI = getGenAI();
            const model = genAI.getGenerativeModel({ model: embeddingModel }, { apiVersion: "v1beta" });
            const result = await model.embedContent(text);
            if (!result || !result.embedding) {
                throw new Error("Failed to get embedding from Gemini API");
            }
            return result.embedding.values;
        } catch (error: any) {
            // If it's NOT a rate limit, log it here, otherwise retry loop handles logging
            if (!error.message?.includes("429")) {
                console.error("[Gemini] embedText failed:", error.message || error);
            }
            throw error;
        }
    }, "embedText");
}