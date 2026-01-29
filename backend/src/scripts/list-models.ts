
import axios from "axios";
import "dotenv/config";

async function listModels() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        console.error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
        return;
    }

    try {
        console.log("Fetching models via REST API...");
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        console.log("Available Models:");
        const models = response.data.models;
        models.forEach((m: any) => {
            const shortName = m.name.replace("models/", "");
            // generateContent をサポートしているモデルのみ抽出
            if (m.supportedGenerationMethods.includes("generateContent")) {
                console.log(`{ value: '${shortName}', label: '${m.displayName}' }, // ${m.description}`);
            }
        });
    } catch (error: any) {
        console.error("Error listing models:", error.message);
        if (error.response) {
            console.error("Response data:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

listModels();
