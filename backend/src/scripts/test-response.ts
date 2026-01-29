
import { generateResponse } from "../lib/gemini";
import "dotenv/config";

async function test() {
    const modelName = "gemini-2.5-flash";
    console.log("Testing generateResponse with model:", modelName);

    const context = {
        status: { height: 160, weight: 50, health: 100, mood: 100, trust: 100 },
        memories: ["こんにちは、私はテストです。"]
    };

    try {
        const response = await generateResponse(modelName, "自己紹介してください", context);
        console.log("Response successful!");
        console.log("AI Response:", response);
    } catch (error: any) {
        console.error("Response failed!");
        console.error("Error:", error.message);
    }
}

test();
