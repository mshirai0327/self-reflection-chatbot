
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function main() {
    console.log("=== Embedding Debugging ===");

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    console.log("API Key present:", !!key);
    if (key) console.log("API Key prefix:", key.substring(0, 5) + "...");

    const genAI = new GoogleGenerativeAI(key || "");
    const texts = ["りんご", "宇宙"];

    async function testModel(modelName: string, options: any = {}) {
        console.log(`\nTesting model: ${modelName} with options: ${JSON.stringify(options)}`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });

            const results = [];
            for (const t of texts) {
                const res = await model.embedContent({ content: { parts: [{ text: t }] }, ...options });
                results.push(res.embedding.values);
            }

            const vec1 = results[0];
            const vec2 = results[1];

            console.log(`v1[0..5]: [${vec1.slice(0, 5).join(", ")}...]`);
            console.log(`v2[0..5]: [${vec2.slice(0, 5).join(", ")}...]`);

            const isIdentical = vec1.every((val, index) => val === vec2[index]);
            if (isIdentical) {
                console.error("-> FAIL: Vectors are IDENTICAL");
            } else {
                console.log("-> OK: Vectors are distinct");
            }

        } catch (e: any) {
            console.error("-> Error:", e.message);
        }
    }

    // 1. Current setup
    await testModel("text-embedding-004");

    // 2. Full path
    await testModel("models/text-embedding-004");

    // 3. Older model
    await testModel("embedding-001");

    // 4. With TaskType
    await testModel("text-embedding-004", { taskType: "RETRIEVAL_DOCUMENT" });

}

main();
