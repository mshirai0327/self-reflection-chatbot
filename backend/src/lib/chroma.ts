import { ChromaClient } from "chromadb";

const client = new ChromaClient({
    path: process.env.CHROMA_URL || "http://localhost:8000"
});

export async function getCollection() {
    return await client.getOrCreateCollection({
        name: "persona_memories",
    });
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
    const collection = await getCollection();
    const results = await collection.query({
        queryTexts: [text],
        nResults,
    });
    return results.documents[0];
}
