
import { ChromaClient } from "chromadb";
import "dotenv/config";

async function main() {
    let chromaPath = process.env.CHROMA_URL || "http://localhost:8000";

    // inspect-chroma.ts と同様の接続ロジックを使用
    const tryConnect = async (url: string) => {
        const urlObj = new URL(url);
        console.log("Connecting to ChromaDB at:", url);
        const client = new ChromaClient({
            host: urlObj.hostname,
            port: parseInt(urlObj.port || (urlObj.protocol === "https:" ? "443" : "80")),
            ssl: urlObj.protocol === "https:"
        });

        await client.heartbeat();
        return client;
    };

    let client: ChromaClient;
    try {
        client = await tryConnect(chromaPath);
    } catch (e: any) {
        if (chromaPath.includes("chromadb") && !process.env.IS_DOCKER) {
            console.log("Internal docker host failed, retrying with localhost...");
            chromaPath = chromaPath.replace("chromadb", "localhost");
            try {
                client = await tryConnect(chromaPath);
            } catch (retryError: any) {
                console.error("Failed to connect to ChromaDB:", retryError.message);
                return;
            }
        } else {
            console.error("Failed to connect for deletion:", e.message);
            return;
        }
    }

    try {
        console.log("Deleting collection: persona_memories");
        await client.deleteCollection({ name: "persona_memories" });
        console.log("Deleted successfully.");
    } catch (e: any) {
        console.log("Could not delete (maybe already gone?):", e.message);
    }
}

main();
