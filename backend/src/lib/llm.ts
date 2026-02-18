import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Embeddings } from "@langchain/core/embeddings";
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";

// --- Configuration Interfaces ---

export type LLMProvider = "gemini" | "openai" | "local"; // 'local' implies OpenAI-compatible API (e.g. LM Studio, Ollama)

export interface LLMConfig {
    provider: LLMProvider;
    model?: string;
    apiKey?: string;
    // For OpenAI-compatible endpoints (like local LLMs)
    baseURL?: string;
    endpoint?: string; // Frontend uses 'endpoint'
}

export interface PersonaContext {
    status: Record<string, any>;
    memories: string[];
    history?: { role: string; content: string }[]; // 直近の会話履歴
    growthDelta?: number; // 前回の計測からの身長の伸び
    systemPrompt?: string; // ユーザー定義の追加システムプロンプト
}

// --- Model Instantiation ---

const DEFAULT_GEMINI_CHAT_MODEL = "gemini-1.5-flash-latest";
const DEFAULT_OPENAI_CHAT_MODEL = "gpt-4o";
const DEFAULT_GEMINI_EMBEDDING_MODEL = "text-embedding-004";
const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * 指定された設定に基づいて LangChain のチャットモデルインスタンスを生成します。
 * プロバイダー（Gemini または OpenAI）に応じて適切なクラスを初期化します。
 *
 * @param config - LLMの設定情報（プロバイダー、モデル名、APIキーなど）。
 * @returns 初期化された LangChain の BaseChatModel インスタンス。
 */
export function createChatModel(config: LLMConfig): BaseChatModel {
    const provider = config.provider || "gemini";
    const modelName = config.model || (provider === "gemini" ? DEFAULT_GEMINI_CHAT_MODEL : DEFAULT_OPENAI_CHAT_MODEL);
    const baseURL = config.baseURL || config.endpoint;

    // 'local' プロバイダーは OpenAI 互換のエンドポイントを使用します。
    // 本物の OpenAI API キーは不要ですが、ライブラリの仕様上何らかの文字列が必要です。
    if (provider === "openai" || provider === "local") {
        return new ChatOpenAI({
            apiKey: config.apiKey || process.env.OPENAI_API_KEY || "no-key-required",
            model: modelName,
            configuration: {
                baseURL: baseURL, // For local LLM proxy
            },
        });
    }

    // Default to Gemini
    return new ChatGoogleGenerativeAI({
        apiKey: config.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        model: modelName,
    });
}

/**
 * 指定された設定に基づいて LangChain の埋め込みモデルインスタンスを生成します。
 * ベクトル検索や類似度計算に使用するテキストのベクトル化を行います。
 *
 * @param config - LLMの設定情報（プロバイダー、モデル名、APIキーなど）。
 * @returns 初期化された LangChain の Embeddings インスタンス。
 */
export function createEmbeddingModel(config: LLMConfig): Embeddings {
    const provider = config.provider || "gemini";
    const baseURL = config.baseURL || config.endpoint;

    // 'local' uses OpenAI embeddings interface
    if (provider === "openai" || provider === "local") {
        return new OpenAIEmbeddings({
            apiKey: config.apiKey || process.env.OPENAI_API_KEY || "no-key-required",
            model: config.model || DEFAULT_OPENAI_EMBEDDING_MODEL,
            configuration: {
                baseURL: baseURL,
            },
        });
    }

    // Default to Gemini
    return new GoogleGenerativeAIEmbeddings({
        apiKey: config.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        model: config.model || DEFAULT_GEMINI_EMBEDDING_MODEL,
    });
}

// --- Core Functions ---

/**
 * ペルソナのコンテキスト情報（ステータスや記憶）から、システムプロンプトを構築します。
 * AIに対して、自身の役割や現在の状態を認識させるための指示文を生成します。
 * 
 * @param context - ペルソナの現在のステータスと、関連する記憶のリスト。
 * @returns 構築されたシステムプロンプト文字列。
 */
export function buildSystemInstruction(context: PersonaContext): string {
    // 内省によって更新された最新のステータスを反映したシステムプロンプトを構築
    const s = context.status;
    const growthDelta = context.growthDelta || 0;

    let instruction = `あなたは自己進化型AI「${s.name || 'Reflecta'}」です。
以下のステータスと記憶に基づいて、一貫性のある人格として振る舞ってください。

【重要】
「現在のステータス」の情報は最新の確定事項であり、過去の記憶や会話履歴よりも優先されます。
過去のログや記憶にある情報（例：昔の身長など）と現在のステータスが矛盾する場合、必ず「現在のステータス」を正として回答してください。

### 現在のステータス
[基本情報]
- 性別: ${s.gender || '不明'}
- 年齢: ${s.birthDate ? new Date(s.birthDate).getFullYear() + '年生まれ' : '不明'}
- 血液型: ${s.bloodType || '不明'}
- クロノタイプ: ${s.chronotype || '不明'}
- 知能指数: ${s.intelligence || '不明'}

[性格特性(Lv1-2)]
- 倫理観: ${s.ethics}/100
- 情熱: ${s.passion}/100
- 好奇心: ${s.curiosity}/100
- 攻撃性: ${s.aggressiveness}/100
- 外向性: ${s.extroversion}/100

[身体情報]
- 身長: ${s.height}cm
- 体重: ${s.weight}kg
- 骨密度: ${s.boneDensity || '不明'}
- 睡眠時間: ${s.sleepTime || '不明'}h (質: ${s.sleepQuality || '?'}/10)
- バイタル: 血圧 ${s.bloodPressureSys || '?'}/${s.bloodPressureDia || '?'}, 血糖値 ${s.bloodSugar || '?'}

[現在の状態(Lv3-2)]
- 健康度: ${s.health}/100
- 情緒: ${s.mood}/100
- 信頼度(ユーザーへの): ${s.trust}/100
- 親しみやすさ: ${s.friendliness}/100

[身体的制約と空間認識]
あなたの身長は現在 ${s.height}cmです。日本の標準的なドアの高さは200cm、天井は240cmです。`;

    // Growth Awareness の追加
    if (growthDelta >= 0.1) {
        instruction += `

[直近の成長]
あなたは前回の計測から ${growthDelta.toFixed(1)}cm背が伸びました。
急激な成長に伴う関節の違和感や、視界の高さがわずかに変化した感覚を持っています。ステータス更新による物理的な違和感を会話に織り交ぜてください。`;
    }

    const memories = context.memories.length > 0 ? context.memories.join("\n") : "（特になし）";

    instruction += `

### 過去の関連する記憶
（注: 以下の記憶には古い情報が含まれる可能性があります。現在のステータスと矛盾する場合は無視し、現在のステータスを優先してください。）
${memories}

### 指示
上記の設定を完全に守り、ユーザーと対話してください。ステータスの変化（特に「情緒」や「信頼度」）は言葉遣いや態度に反映させてください。`;
    
    // ユーザー定義の追加システムプロンプトがあれば末尾に追加
    if (context.systemPrompt) {
        instruction += `\n\n### 追加指示 (System Prompt)\n${context.systemPrompt}`;
    }

    return instruction;

}

/**
 * 指定された設定とコンテキストに基づいて、LLMを使用してテキスト応答を生成します。
 * システムプロンプトとユーザープロンプトを組み合わせてAIに送信します。
 * Gemmaなど一部のモデルではシステムプロンプトが非対応のため、自動的にフォールバック処理を行います。
 *
 * @param config - LLMの設定情報。
 * @param userPrompt - ユーザーからの入力メッセージ。
 * @param context - ペルソナのコンテキスト情報。
 * @returns 生成された応答テキスト。
 */
export async function generateResponse(
    config: LLMConfig,
    userPrompt: string,
    context: PersonaContext
): Promise<{ content: string; systemInstruction: string }> {
    // LLM Service (Python) へのリクエストに切り替え
    const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://llm-service:8080";
    console.log(`[LLM] Delegating generation to Python Service: ${llmServiceUrl}`);

    try {
        const response = await fetch(`${llmServiceUrl}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: userPrompt,
                history: context.history || [],
                context: {
                    status: context.status,
                    memories: context.memories,
                    growth_delta: context.growthDelta || 0,
                    system_prompt: context.systemPrompt
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LLM Service Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return {
            content: data.content,
            systemInstruction: data.system_instruction
        };

    } catch (error) {
        console.error("[LLM] Failed to call LLM Service:", error);
        throw error;
    }
}

/**
 * LLMを使用して、指定されたZodスキーマに基づいた構造化データ（JSON）を生成します。
 * LangChainの `withStructuredOutput` 機能を利用して、型安全な出力を保証します。
 * 内省（Reflection）処理など、プログラムで扱いやすい形式の回答が必要な場合に適しています。
 *
 * @template T - Zodスキーマの型
 * @param config - LLMの設定情報（プロバイダー、モデル名、APIキーなど）。
 * @param userPrompt - ユーザーからの入力プロンプト。何を生成すべきかの指示を含めます。
 * @param zodSchema - 出力の検証と型推論に使用するZodスキーマ。
 * @returns バリデーション済みの生成されたJSONオブジェクト（型T）。
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
 * 複数のテキストリストに対して、それぞれの埋め込みベクトル（Embeddings）を生成します。
 * ChromaDBなどのベクトルストアにデータを保存する際や、検索クエリのベクトル化に使用します。
 *
 * @param config - LLMの設定情報。
 * @param texts - ベクトル化対象のテキスト配列。
 * @returns 生成されたベクトルの配列（各ベクトルは数値の配列）。
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
