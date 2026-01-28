
import { embedText } from "../lib/gemini";
import "dotenv/config";

async function test() {
    console.log("Starting embedding test...");
    console.log("API Key present:", !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    try {
        const result = await embedText("Hello world");
        console.log("Embedding successful! Length:", result.length);
        console.log("First 5 values:", result.slice(0, 5));
    } catch (error: any) {
        console.error("Embedding failed!");
        console.error("Error message:", error.message);
        if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("No response object. Error details:", error);
        }
    }
}

test();
