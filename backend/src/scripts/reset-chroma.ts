
import { ChromaClient } from "chromadb";
import "dotenv/config";

async function main() {
    const chromaPath = process.env.CHROMA_URL || "http://localhost:8000";
    console.log("Connecting to ChromaDB at:", chromaPath);
    const client = new ChromaClient({ path: chromaPath });
    try {
        console.log("Deleting collection: persona_memories");
        await client.deleteCollection({ name: "persona_memories" });
        console.log("Deleted successfully.");
    } catch (e: any) {
        console.log("Could not delete (maybe already gone?):", e.message);
    }
}

main();
