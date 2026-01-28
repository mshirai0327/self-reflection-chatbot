import { ChromaClient, EmbeddingFunction } from "chromadb";
import { embedText } from "./gemini";

const chromaPath = process.env.CHROMA_URL || "http://localhost:8000";
console.log("[ChromaDB] Initializing client with path:", chromaPath);
const client = new ChromaClient({
    path: chromaPath
});


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
            name: "persona_memories",
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
