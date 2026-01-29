import { ChromaClient, EmbeddingFunction } from "chromadb";
import { embedText } from "./gemini";

const chromaPath = process.env.CHROMA_URL || "http://localhost:8000";
const collectionName = process.env.CHROMA_COLLECTION_NAME || "persona_memories";

// ChromaDB SDKの特定の警告（デシリアライズ時の埋め込み関数不足）を抑制するためのハック
// 実態として embeddingFunction は常に渡しているため動作に問題はないが、
// SDKがコレクション情報の取得時に必ずこの警告を出してしまうため、それをフィルタリングする。
const originalWarn = console.warn;
console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('No embedding function configuration found')) {
        return;
    }
    originalWarn(...args);
};

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


class GeminiEmbeddingFunction implements EmbeddingFunction {
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

export async function addMemory(id: string, text: string, metadata: any) {
    const collection = await getCollection();
    await collection.add({
        ids: [id],
        documents: [text],
        metadatas: [metadata],
    });
}

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
        return results.documents[0];
    } catch (error: any) {
        console.error("[ChromaDB Error] queryMemories failed:", error);
        throw error;
    }
}
