import { ChromaClient, EmbeddingFunction } from "chromadb";
import { embedText } from "./gemini";

/** ChromaDBの接続URL（環境変数から取得） */
const chromaPath = process.env.CHROMA_URL || "http://localhost:8000";
/** メモリを保存するコレクション名 */
const collectionName = process.env.CHROMA_COLLECTION_NAME || "persona_memories";

/**
 * ChromaDB SDKの特定の警告を抑制するためのハック。
 * 実態として embeddingFunction は常に渡しているため動作に問題はないが、
 * SDKが内部的にコレクション情報を取得する際に重複して警告を出してしまうため、それをフィルタリングする。
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
 * 実行環境（Docker内かホストか）に応じて、接続先ホストを適切に判定します。
 * 
 * @returns ChromaClient インスタンス
 */
const getChromaClient = () => {
    const url = process.env.CHROMA_URL || "http://localhost:8000";
    const urlObj = new URL(url);

    // スクリプトがホストマシンから実行される場合の便宜を図る（chromadb -> localhost）
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
 * Gemini APIを使用してテキストをベクトル化するためのChromaDB用カスタム埋め込み関数。
 * これにより、ベクトルストア上での意味ベースの検索が可能になります。
 */
class GeminiEmbeddingFunction implements EmbeddingFunction {
    /**
     * 与えられたテキスト配列をベクトルに変換します。
     * @param texts 変換対象のテキスト配列
     * @returns ベクトルの配列
     */
    async generate(texts: string[]): Promise<number[][]> {
        try {
            console.log("[ChromaDB] Generating embeddings for", texts.length, "texts");
            if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
                console.error("[ChromaDB] ERROR: GOOGLE_GENERATIVE_AI_API_KEY is missing!");
                throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing");
            }
            return await Promise.all(texts.map(text => embedText(text)));
        } catch (error) {
            console.error("[ChromaDB] Embedding generation failed:", error);
            throw error;
        }
    }
}

const embeddingFunction = new GeminiEmbeddingFunction();

/**
 * メモリ保存用のコレクションを取得、存在しない場合は作成します。
 * @returns ChromaDB コレクションインスタンス
 * @throws 接続に失敗した場合
 */
export async function getCollection() {
    try {
        return await client.getOrCreateCollection({
            name: collectionName,
            embeddingFunction: embeddingFunction,
        });
    } catch (error) {
        console.error("[ChromaDB] getOrCreateCollection failed. Check CHROMA_URL:", process.env.CHROMA_URL);
        console.error("Error details:", error);
        throw error;
    }
}

/**
 * 新しい記憶をベクトルストアに保存します。
 * 
 * @param id 記憶の一意識別子
 * @param text 保存するテキスト内容
 * @param metadata 関連付けるメタデータ（ロール、タイムスタンプなど）
 */
export async function addMemory(id: string, text: string, metadata: any) {
    const collection = await getCollection();
    await collection.add({
        ids: [id],
        documents: [text],
        metadatas: [metadata],
    });
}

/**
 * 与えられたテキストに意味的に近い記憶（ベクトル）をベクトルストアから検索します。
 * 
 * @param text 検索のトリガーとなるテキスト（queryTexts）
 * @param nResults 取得する件数（最大数）。デフォルトは3
 * @returns 類似度の高い順に並んだドキュメント（テキスト）の配列。見つからない場合は空配列
 */
export async function queryMemories(text: string, nResults: number = 3) {
    try {
        console.log("[ChromaDB] Querying for text:", text);
        const collection = await getCollection();
        const results = await collection.query({
            queryTexts: [text],
            nResults,
        });
        console.log("[ChromaDB] Query results:", results);
        if (!results.documents || results.documents.length === 0) {
            return [];
        }
        // results.documents[0] は、最初（かつ唯一）のクエリテキストに対する結果の配列
        return results.documents[0] as string[];
    } catch (error: any) {
        console.error("[ChromaDB Error] queryMemories failed:", error);
        throw error;
    }
}

