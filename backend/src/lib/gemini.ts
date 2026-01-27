import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

export const flashModel = "gemini-flash-latest";
export const proModel = "gemini-pro-latest";

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

    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction,
    }, { apiVersion: "v1beta" });

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return result.response.text();
}

export async function embedText(text: string) {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
}
