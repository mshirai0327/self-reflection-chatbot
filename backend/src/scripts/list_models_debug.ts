
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface GoogleModel {
    name: string;
    version?: string;
    displayName?: string;
    description?: string;
}

async function main() {
    console.log("=== Listing Available Models ===");

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
        console.error("No API Key found.");
        return;
    }

    // REST API directly might be better to see everything, but let's try via SDK or fetch
    // SDK doesn't have a simple listModels? It does in newer versions perhaps. 
    // Let's use fetch for raw check to be sure.

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log(`Found ${data.models.length} models.`);
            const embeddingModels = data.models.filter((m: GoogleModel) => m.name.includes("embedding"));

            console.log("\n--- Embedding Models ---");
            embeddingModels.forEach((m: GoogleModel) => {
                console.log(`Name: ${m.name}`);
                console.log(`   Version: ${m.version}`);
                console.log(`   Display Name: ${m.displayName}`);
                console.log(`   Description: ${m.description?.substring(0, 50) ?? "N/A"}...`);
            });

            console.log("\n--- Other Models (First 5) ---");
            data.models.filter((m: any) => !m.name.includes("embedding")).slice(0, 5).forEach((m: any) => {
                console.log(`Name: ${m.name}`);
            });

        } else {
            console.log("No 'models' field in response:", data);
        }
    } catch (e: any) {
        console.error("Error fetching models:", e.message);
    }
}

main();
