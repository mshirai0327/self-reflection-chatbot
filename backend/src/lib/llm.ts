import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";

export type LLMProvider = "gemini" | "local";

export interface LLMConfig {
    provider: LLMProvider;
    model?: string;
    endpoint?: string; // For local LLM
    apiKey?: string;
}

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

const DEFAULT_GEMINI_FLASH = "gemini-2.5-flash";
const DEFAULT_GEMINI_PRO = "gemini-2.5-pro";

/**
 * プロンプトにペルソナ情報を付与したシステム指示文を生成します
 */
function buildSystemInstruction(context: PersonaContext) {
    return `
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
}

/**
 * Gemini APIを使用してレスポンスを生成します
 */
async function generateWithGemini(config: LLMConfig, prompt: string, context: PersonaContext) {
    const apiKey = config.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("Google AI API Key is missing");

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = config.model || DEFAULT_GEMINI_FLASH;
    const systemInstruction = buildSystemInstruction(context);

    const isSystemInstructionSupported = !modelName.startsWith("gemma");
    const modelOptions: any = { model: modelName };
    if (isSystemInstructionSupported) {
        modelOptions.systemInstruction = systemInstruction;
    }

    const model = genAI.getGenerativeModel(modelOptions, { apiVersion: "v1beta" });
    const finalPrompt = isSystemInstructionSupported
        ? prompt
        : `System Instruction:\n${systemInstruction}\n\nUser Message: ${prompt}`;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
    });
    return result.response.text();
}

/**
 * Local LLM のエンドポイントを正規化します。
 * /v1 で終わっている場合は、用途に応じて /chat/completions や /models を付加できるようにベースURLを返します。
 */
export function normalizeLocalEndpoint(endpoint: string, path: "/chat/completions" | "/models" = "/chat/completions"): string {
    let base = endpoint.trim().replace(/\/$/, "");

    // すでに指定のパスが含まれている場合はそのまま返す
    if (base.endsWith(path)) return base;

    // /v1/chat/completions などのフルパスが入力された場合、まずそれを削ってベースを作る
    const knownPaths = ["/chat/completions", "/models"];
    for (const p of knownPaths) {
        if (base.endsWith(p)) {
            base = base.substring(0, base.length - p.length);
            break;
        }
    }

    // ベースURLに指定のパスを付加して返す
    return `${base}${path}`;
}

/**
 * Local LLM (OpenAI互換API)を使用してレスポンスを生成します
 */
async function generateWithLocal(config: LLMConfig, prompt: string, context: PersonaContext) {
    const rawEndpoint = config.endpoint || "http://localhost:11434/v1";
    const endpoint = normalizeLocalEndpoint(rawEndpoint, "/chat/completions");
    const modelName = config.model || "llaman";
    const systemInstruction = buildSystemInstruction(context);

    const response = await axios.post(endpoint, {
        model: modelName,
        messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
        ],
        temperature: 0.7
    }, {
        headers: {
            "Content-Type": "application/json",
            ...(config.apiKey ? { "Authorization": `Bearer ${config.apiKey}` } : {})
        }
    });

    return response.data.choices[0].message.content;
}

/**
 * プロバイダーに応じてLLMレスポンスを生成します
 */
export async function generateLLMResponse(config: LLMConfig, prompt: string, context: PersonaContext) {
    console.log(`[LLM] Generating response using provider: ${config.provider}, model: ${config.model || 'default'}`);

    if (config.provider === "gemini") {
        return generateWithGemini(config, prompt, context);
    } else if (config.provider === "local") {
        return generateWithLocal(config, prompt, context);
    } else {
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}
