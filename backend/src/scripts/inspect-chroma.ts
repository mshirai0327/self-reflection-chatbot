import { ChromaClient } from "chromadb";
import "dotenv/config";

// ChromaDB SDKの特定の警告を抑制
const originalWarn = console.warn;
console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('No embedding function configuration found')) {
        return;
    }
    originalWarn(...args);
};

const SAMPLE_LIMIT = 80;

async function main() {
    let chromaPath = process.env.CHROMA_URL || "http://localhost:8000";

    // スクリプトがホストマシンから実行されている場合、
    // コンテナ間通信用の "http://chromadb:8000" は解決できないため、localhost に置換を試みる。
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
            console.error("Failed to connect or list collections:", e.message);
            return;
        }
    }

    try {
        const collections = await client.listCollections();
        console.log("Collections found:", collections.length);
        for (const col of collections) {
            // Check count
            const collection = await client.getCollection({ name: col.name, embeddingFunction: null as any });
            const count = await collection.count();
            console.log(`- Collection: ${col.name}, Items: ${count}`);

            // Try to fetch some records if exists
            if (count > 0) {
                // peekの代わりにgetを使用して、明示的にincludeを指定します
                const result: any = await (collection as any).get({
                    limit: SAMPLE_LIMIT,
                    include: ["embeddings", "documents", "metadatas"]
                });

                if (result.embeddings && result.embeddings.length > 0) {
                    const dim = result.embeddings[0].length;
                    console.log(`  Embedding dimension: ${dim}`);
                    console.log(`  Sample records:`);
                    for (let i = 0; i < Math.min(result.documents.length, SAMPLE_LIMIT); i++) {
                        const doc = result.documents[i];
                        const metadata = result.metadatas[i];
                        console.log(`    [${i}] ${doc?.substring(0, 50)}${doc && doc.length > 50 ? "..." : ""}`);
                        console.log(`        Metadata: ${JSON.stringify(metadata)}`);
                    }
                } else {
                    console.log(`  Embeddings not returned in get results.`);
                    if (result.documents && result.documents.length > 3) {
                        console.log(`  Sample documents:`);
                        result.documents.slice(0, 3).forEach((doc: string, i: number) => {
                            console.log(`    [${i}] ${doc?.substring(0, 50)}...`);
                        });
                    }
                }
            }
        }
    } catch (e: any) {
        console.error("Failed to connect or list collections:", e.message);
    }
}

main();
