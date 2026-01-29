import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Embeddings } from "@langchain/core/embeddings";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { Runnable } from "@langchain/core/runnables";

// --- Configuration Interfaces ---

export type LLMProvider = "gemini" | "openai";

export interface LLMConfig {
    provider: LLMProvider;
    model?: string;
    apiKey?: string;
    // For OpenAI-compatible endpoints (like local LLMs)
    baseURL?: string;
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

// --- Model Instantiation ---

const DEFAULT_GEMINI_CHAT_MODEL = "gemini-1.5-flash-latest";
const DEFAULT_OPENAI_CHAT_MODEL = "gpt-4o";
const DEFAULT_GEMINI_EMBEDDING_MODEL = "text-embedding-004";
const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Creates a LangChain chat model instance based on the provided configuration.
 * @param config The LLM configuration.
 * @returns An instance of a LangChain BaseChatModel.
 */
export function createChatModel(config: LLMConfig): BaseChatModel {
    const provider = config.provider || "gemini";

    switch (provider) {
        case "openai":
            return new ChatOpenAI({
                apiKey: config.apiKey || process.env.OPENAI_API_KEY,
                model: config.model || DEFAULT_OPENAI_CHAT_MODEL,
                configuration: {
                    baseURL: config.baseURL, // For local LLM proxy
                },
                // maxRetries: 3, // Optional: configure retries
            });
        case "gemini":
        default:
            return new ChatGoogleGenerativeAI({
                apiKey: config.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
                model: config.model || DEFAULT_GEMINI_CHAT_MODEL,
                // maxRetries: 3,
            });
    }
}

/**
 * Creates a LangChain embeddings model instance based on the provided configuration.
 * @param config The LLM configuration.
 * @returns An instance of a LangChain BaseEmbeddings model.
 */
export function createEmbeddingModel(config: LLMConfig): Embeddings {
    const provider = config.provider || "gemini";

    switch (provider) {
        case "openai":
            return new OpenAIEmbeddings({
                apiKey: config.apiKey || process.env.OPENAI_API_KEY,
                model: config.model || DEFAULT_OPENAI_EMBEDDING_MODEL,
                configuration: {
                    baseURL: config.baseURL,
                },
            });
        case "gemini":
        default:
            return new GoogleGenerativeAIEmbeddings({
                apiKey: config.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
                model: config.model || DEFAULT_GEMINI_EMBEDDING_MODEL,
            });
    }
}

// --- Core Functions ---

/**
 * Builds the system instruction prompt from the persona context.
 */
function buildSystemInstruction(context: PersonaContext): string {
    return `あなたは自己進化型AI「Reflecta」です。
現在のあなたのステータス:
身長: ${context.status.height}cm
体重: ${context.status.weight}kg
健康度: ${context.status.health}/100
情緒: ${context.status.mood}/100
信頼度: ${context.status.trust}/100

過去の関連する記憶:
${context.memories.join("\n")}

上記を踏まえ、一貫性のある人格として回答してください。`;
}

/**
 * Generates a text response from the LLM based on the provided configuration and context.
 * @param config The LLM configuration.
 * @param userPrompt The user's prompt.
 * @param context The persona context.
 * @returns The generated text response.
 */
export async function generateResponse(
    config: LLMConfig,
    userPrompt: string,
    context: PersonaContext
): Promise<string> {
    console.log(`[LLM] Generating response using provider: ${config.provider}, model: ${config.model || 'default'}`);
    const chatModel = createChatModel(config);
    const systemInstruction = buildSystemInstruction(context);

    const messages = [
        new SystemMessage(systemInstruction),
        new HumanMessage(userPrompt),
    ];

    const result = await chatModel.invoke(messages);
    return result.content as string;
}

/**
 * Generates a structured JSON response from the LLM.
 * @param config The LLM configuration.
 * @param userPrompt The user's prompt.
 * @param zodSchema The Zod schema to validate the JSON output.
 * @returns The generated and validated JSON object.
 */
export async function generateJson<T extends z.ZodType>(
    config: LLMConfig,
    userPrompt: string,
    zodSchema: T
): Promise<z.infer<T>> {
    console.log(`[LLM] Generating JSON using provider: ${config.provider}, model: ${config.model || 'default'}`);
    const chatModel = createChatModel(config);

    const modelWithStructuredOutput = chatModel.withStructuredOutput(zodSchema);

    const result = await modelWithStructuredOutput.invoke([
        new HumanMessage(userPrompt),
    ]);

    return result as z.infer<T>;
}


/**
 * Generates embeddings for a list of texts.
 * @param config The LLM configuration.
 * @param texts An array of texts to embed.
 * @returns A promise that resolves to an array of embeddings.
 */
export async function embedTexts(
    config: LLMConfig,
    texts: string[]
): Promise<number[][]> {
    console.log(`[LLM] Embedding ${texts.length} documents using provider: ${config.provider}`);
    const embeddingModel = createEmbeddingModel(config);
    return embeddingModel.embedDocuments(texts);
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
