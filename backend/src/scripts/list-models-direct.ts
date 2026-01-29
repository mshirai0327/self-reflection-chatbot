
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

async function main() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        console.error("API Key is missing!");
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    // SDKによっては listModels が直接生えていない場合があるため、
    // fetch で直接叩いてみます
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
        const data = await response.json() as any;
        console.log("Available models:");
        if (data.models) {
            data.models.forEach((m: any) => {
                console.log(`- ${m.name} (supports: ${m.supportedGenerationMethods.join(", ")})`);
            });
        } else {
            console.log("No models found in response:", data);
        }
    } catch (e) {
        console.error("Error fetching models:", e);
    }
}

main();
