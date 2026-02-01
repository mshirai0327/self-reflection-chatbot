import { generateResponse } from "../lib/llm";
import "dotenv/config";

async function test() {
    const modelName = "gemini-1.5-flash";
    console.log("Testing generateResponse with model:", modelName);

    const context = {
        status: { height: 160, weight: 50, health: 100, mood: 100, trust: 100, ethics: 50, passion: 50, curiosity: 50, aggressiveness: 50, extroversion: 50, friendliness: 50 },
        memories: ["こんにちは、私はテストです。"]
    };

    try {
        const { content: response } = await generateResponse({
            provider: "gemini",
            model: modelName
        }, "自己紹介してください", context);
        console.log("Response successful!");
        console.log("AI Response:", response);
    } catch (error: any) {
        console.error("Response failed!");
        console.error("Error:", error.message);
    }
}

test();
