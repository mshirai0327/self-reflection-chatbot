
import { ChromaClient } from "chromadb";
import "dotenv/config";

async function main() {
    const chromaPath = process.env.CHROMA_URL || "http://localhost:8000";
    console.log("Connecting to ChromaDB at:", chromaPath);
    const client = new ChromaClient({ path: chromaPath });
    try {
        const collections = await client.listCollections();
        console.log("Collections found:", collections.length);
        for (const col of collections) {
            // Check count
            const collection = await client.getCollection({ name: col.name, embeddingFunction: null as any });
            const count = await collection.count();
            console.log(`- Collection: ${col.name}, Items: ${count}`);

            // Try to peek one if exists
            if (count > 0) {
                const peek = await collection.peek({ limit: 1 });
                console.log(`  Peek embedding dimension: ${peek.embeddings?.[0]?.length}`);
            }
        }
    } catch (e: any) {
        console.error("Failed to connect or list collections:", e.message);
    }
}

main();
