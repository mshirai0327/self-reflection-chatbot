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
 * Generate a persona-aware response using the specified generative model.
 *
 * Constructs a system instruction from the provided `context` (status and memories),
 * invokes the generative model identified by `modelName`, and returns the model's reply text.
 *
 * @param modelName - The identifier of the generative model to use (e.g., `"gemini-pro-latest"`).
 * @param prompt - The user prompt to send to the model.
 * @param context - PersonaContext containing `status` and `memories` used to shape the system instruction.
 * @returns The generated response text from the model.
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
    // Fallback to flashModel if modelName fails? Or just use modelName.
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction,
    }, { apiVersion: "v1beta" });

    return callWithRetry(async () => {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        return result.response.text();
    }, "generateResponse");
}

export async function embedText(text: string) {
    return callWithRetry(async () => {
        try {
            if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
                throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing from environment variables");
            }
            const genAI = getGenAI();
            const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" }, { apiVersion: "v1beta" });
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