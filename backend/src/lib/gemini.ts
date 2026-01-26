import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

export const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
export const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

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

export async function generateResponse(model: any, prompt: string, context: PersonaContext) {
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

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction,
    });

    return result.response.text();
}
