
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function main() {
    console.log("=== Testing gemini-embedding-001 ===");

    // Test Texts
    const text1 = "りんご";
    const text2 = "宇宙";

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const genAI = new GoogleGenerativeAI(key || "");

    // Valid names from list: 'models/gemini-embedding-001'
    const modelName = "models/gemini-embedding-001";

    try {
        const model = genAI.getGenerativeModel({ model: modelName });

        console.log(`Generating embedding for "${text1}" using ${modelName}...`);
        const result1 = await model.embedContent(text1);
        const vec1 = result1.embedding.values;

        console.log(`Generating embedding for "${text2}" using ${modelName}...`);
        const result2 = await model.embedContent(text2);
        const vec2 = result2.embedding.values;

        console.log(`Vector 1 sample: [${vec1.slice(0, 5).join(", ")}...]`);
        console.log(`Vector 2 sample: [${vec2.slice(0, 5).join(", ")}...]`);

        const isIdentical = vec1.every((val, index) => val === vec2[index]);
        if (isIdentical) {
            console.error("[FAIL] Vectors are IDENTICAL!");
        } else {
            console.log("[OK] Vectors are distinct.");

            // Calculate similarity
            let dotProduct = 0;
            let normA = 0;
            let normB = 0;
            for (let i = 0; i < vec1.length; i++) {
                dotProduct += vec1[i] * vec2[i];
                normA += vec1[i] * vec1[i];
                normB += vec2[i] * vec2[i];
            }
            const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
            console.log(`Similarity: ${similarity.toFixed(4)}`);
        }

    } catch (e: any) {
        console.error("Test failed:", e.message);
    }
}

main();
