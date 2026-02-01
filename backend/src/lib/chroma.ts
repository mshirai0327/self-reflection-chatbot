import { ChromaClient, EmbeddingFunction } from "chromadb";
import { embedTexts, LLMConfig } from "./llm";

/** ChromaDBの接続URL（環境変数から取得） */
const chromaPath = process.env.CHROMA_URL || "http://localhost:8000";
/** メモリを保存するコレクション名 */
const collectionName = process.env.CHROMA_COLLECTION_NAME || "persona_memories";

/**
 * ChromaDB SDKの特定の警告を抑制するためのハック。
 */
const originalWarn = console.warn;
console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('No embedding function configuration found')) {
        return;
    }
    originalWarn(...args);
};

/**
 * ChromaDBクライアントを初期化します。
 */
const getChromaClient = () => {
    const urlObj = new URL(chromaPath);
    const isDocker = process.env.IS_DOCKER === "true";
    const host = (urlObj.hostname === "chromadb" && !isDocker) ? "localhost" : urlObj.hostname;
    const port = parseInt(urlObj.port || (urlObj.protocol === "https:" ? "443" : "80"));

    console.log(`[ChromaDB] Initializing client with host: ${host}, port: ${port}`);
    return new ChromaClient({
        host: host,
        port: port,
        ssl: urlObj.protocol === "https:"
    });
};

const client = getChromaClient();

/**
 * llm.tsのファクトリ関数を利用して、動的に埋め込みモデルを切り替えるカスタム埋め込み関数。
 */
class DynamicEmbeddingFunction implements EmbeddingFunction {
    private config: LLMConfig;

    constructor(config?: LLMConfig) {
        // デフォルトはGeminiの埋め込みモデルを使用
        this.config = config || {
            provider: "gemini",
            model: process.env.GOOGLE_EMBEDDING_MODEL || "text-embedding-004",
        };
        console.log(`[ChromaDB] Initialized DynamicEmbeddingFunction with provider: ${this.config.provider}`);
    }

    /**
     * 与えられたテキスト配列をベクトルに変換します。
     * @param texts 変換対象のテキスト配列
     * @returns ベクトルの配列
     */
    async generate(texts: string[]): Promise<number[][]> {
        try {
            console.log(`[ChromaDB] Generating embeddings for ${texts.length} texts using ${this.config.provider}`);
            // llm.tsのembedTexts関数を一括で呼び出す
            return await embedTexts(this.config, texts);
        } catch (error) {
            console.error("[ChromaDB] Embedding generation failed:", error);
            // エラーを再スローして、呼び出し元で処理できるようにする
            throw error;
        }
    }
}

// デフォルトのEmbeddingFunctionインスタンス
const defaultEmbeddingFunction = new DynamicEmbeddingFunction();

/**
 * メモリ保存用のコレクションを取得、存在しない場合は作成します。
 */
export async function getCollection() {
    try {
        return await client.getOrCreateCollection({
            name: collectionName,
            embeddingFunction: defaultEmbeddingFunction,
        });
    } catch (error) {
        console.error("[ChromaDB] getOrCreateCollection failed. Check CHROMA_URL:", process.env.CHROMA_URL);
        if (error instanceof Error) {
            console.error("Error details:", error.message);
        }
        throw error;
    }
}

/**
 * 新しい記憶をベクトルストアに保存します。
 */
export async function addMemory(id: string, text: string, metadata: Record<string, any>) {
    const collection = await getCollection();
    await collection.add({
        ids: [id],
        documents: [text],
        metadatas: [metadata],
    });
}

/**
 * 与えられたテキストに意味的に近い記憶を検索します。
 * デフォルトでは、3つの結果を返却します
 */
export async function queryMemories(text: string, nResults: number = 3) {
    try {
        console.log("[ChromaDB] Querying for text:", text);
        const collection = await getCollection();
        const results = await collection.query({
            queryTexts: [text],
            nResults,
        });
        console.log("[ChromaDB] Query results:", results.documents);
        if (!results.documents || results.documents.length === 0) {
            return [];
        }
        const docs = results.documents[0];
        const dists = results.distances ? results.distances[0] : [];

        return docs.map((doc, i) => ({
            content: doc,
            distance: dists[i] ?? null
        })).filter(item => item.content !== null);
    } catch (error: unknown) {
        console.error("[ChromaDB Error] queryMemories failed:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to query memories: ${error.message}`);
        }
        throw new Error("An unknown error occurred while querying memories");
    }
}

