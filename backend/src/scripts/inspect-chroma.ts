import { ChromaClient, EmbeddingFunction } from "chromadb";
import { embedText } from "../lib/gemini";

const client = new ChromaClient({
    path: process.env.CHROMA_URL || "http://localhost:8000"
});

class GeminiEmbeddingFunction implements EmbeddingFunction {
    async generate(texts: string[]): Promise<number[][]> {
        return await Promise.all(texts.map(text => embedText(text)));
    }
}

const embeddingFunction = new GeminiEmbeddingFunction();

async function inspectChroma() {
    try {
        console.log("--- ChromaDB Inspection ---");
        const collection = await client.getCollection({
            name: "persona_memories",
            embeddingFunction: embeddingFunction,
        });

        const count = await collection.count();
        console.log(`Total documents in 'persona_memories': ${count}`);

        if (count > 0) {
            const results = await collection.get();
            console.log("Documents:");
            results.documents.forEach((doc, i) => {
                console.log(`[${i}] ID: ${results.ids[i]}`);
                console.log(`    Content: ${doc}`);
                console.log(`    Metadata: ${JSON.stringify(results.metadatas[i])}`);
            });
        }
    } catch (error) {
        console.error("Error inspecting ChromaDB:", error);
    }
}

inspectChroma();
