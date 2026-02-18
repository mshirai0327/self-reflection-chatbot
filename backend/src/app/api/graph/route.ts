import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://llm-service:8080";
        const response = await fetch(`${llmServiceUrl}/graph`);
        
        if (!response.ok) {
            throw new Error(`LLM Service Error: ${response.statusText}`);
        }
        
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Failed to fetch graph:", error);
        return NextResponse.json({ error: "Failed to fetch graph data" }, { status: 500 });
    }
}
