
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
    try {
        const result = await genAI.getGenerativeModel({ model: "gemini-pro" }).listModels();
        // Wait, listModels is actually on the genAI instance or something?
        // Actually it's genAI.listModels()? No.
        // It's under a separate client often.
        console.log("This SDK version might not have listModels easily accessible this way.");
    } catch (e) {
        console.log("Error listing models:", e);
    }
}
// Traditional way:
async function test() {
    console.log("Trying text-embedding-004 again but with different names");
    const names = ["text-embedding-004", "models/text-embedding-004", "embedding-001", "models/embedding-001"];
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
    for (const name of names) {
        try {
            console.log(`Testing model: ${name}`);
            const model = genAI.getGenerativeModel({ model: name });
            const res = await model.embedContent("test");
            console.log(`Success with ${name}!`);
            return;
        } catch (e: any) {
            console.log(`Failed ${name}: ${e.message}`);
        }
    }
}
test();
