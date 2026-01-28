
import "dotenv/config";

async function main() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json() as any;
    console.log("v1beta models:");
    if (data.models) {
        data.models.forEach((m: any) => {
            if (m.supportedGenerationMethods.includes("embedContent")) {
                console.log(`- ${m.name} (FOUND EMBEDDING MODEL!)`);
            } else {
                console.log(`- ${m.name}`);
            }
        });
    } else {
        console.log("No models found:", data);
    }
}

main();
