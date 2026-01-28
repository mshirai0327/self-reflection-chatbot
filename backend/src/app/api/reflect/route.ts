import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { proModel, generateResponse } from "@/lib/gemini";
import { addMemory } from "@/lib/chroma";

/**
 * Handle POST requests to run a reflection workflow over recent chat logs, update persona status, and persist any resulting permanent memory.
 *
 * This endpoint:
 * - Fetches recent chat logs and the latest persona status,
 * - Sends a reflection prompt (Japanese) to the configured LLM,
 * - Parses the LLM's JSON response containing `thought`, `statusUpdate`, and `permanentMemory`,
 * - Creates a new personaStatus record with clamped health/mood/trust updates,
 * - Saves `permanentMemory` to the semantic memory store when present,
 * - Returns the parsed reflection payload.
 *
 * @param req - The incoming Next.js POST request for the reflection operation
 * @returns A JSON response containing the `reflection` object on success; if no logs are available, an informational message; on failure, an error message and an appropriate HTTP status code.
 */
export async function POST(req: NextRequest) {
    try {
        console.log("[Reflect API] Starting reflection process...");

        let model = proModel;
        try {
            const body = await req.json();
            if (body && body.model) model = body.model;
        } catch (e) {
            // No body or invalid JSON, ignore
        }
        console.log("[Reflect API] Using model:", model);

        // 1. Fetch recent chat logs (e.g., last 24h)
        const recentLogs = await prisma.chatLog.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        if (recentLogs.length === 0) {
            console.log("[Reflect API] No chat logs found. Skipping.");
            return NextResponse.json({ message: "No logs to reflect on." });
        }
        console.log(`[Reflect API] Found ${recentLogs.length} recent logs.`);

        const logSummary = recentLogs.map((l: any) => `${l.role}: ${l.content}`).join("\n");

        // 2. Fetch current status
        console.log("[Reflect API] Fetching current status...");
        const status = await prisma.personaStatus.findFirst({
            orderBy: { updatedAt: 'desc' }
        });

        if (!status) {
            console.error("[Reflect API] Persona status not found!");
            return NextResponse.json({ error: "Status not found" }, { status: 404 });
        }
        console.log("[Reflect API] Current status:", status);

        // 3. Inference with Pro Model
        console.log("[Reflect API] Sending data to Gemini Pro for reflection...");
        const reflectionPrompt = `
            以下の直近の会話内容を内省し、自分の性格やステータスにどのような影響を与えるべきか考えてください。
            会話履歴:
            ${logSummary}

            現在のステータス:
            身長: ${status.height}, 体重: ${status.weight}, 健康: ${status.health}, 情緒: ${status.mood}, 信頼: ${status.trust}

            内省の結果として、以下のJSON形式で回答してください：
            {
            "thought": "（内省の思考過程）",
            "statusUpdate": { "health": 1, "mood": -5, "trust": 10 },
            "permanentMemory": "（今後忘れてはいけない重要な教訓や記憶）"
            }
            `;

        const resultText = await generateResponse(model, reflectionPrompt, {
            status,
            memories: []
        });
        console.log("[Reflect API] Gemini Pro Raw Response:", resultText);

        // Parse JSON from LLM response (handling potential markdown)
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("[Reflect API] Failed to find JSON in response.");
            throw new Error("Failed to parse reflection result");
        }
        const reflection = JSON.parse(jsonMatch[0]);
        console.log("[Reflect API] Parsed reflection:", reflection);

        // 4. Update Status in RDB
        console.log("[Reflect API] Updating status in Prisma...");
        await prisma.personaStatus.create({
            data: {
                health: Math.min(100, Math.max(0, status.health + (reflection.statusUpdate.health || 0))),
                mood: Math.min(100, Math.max(0, status.mood + (reflection.statusUpdate.mood || 0))),
                trust: Math.min(100, Math.max(0, status.trust + (reflection.statusUpdate.trust || 0))),
                height: status.height, // Physical traits stay relatively same unless logic added
                weight: status.weight
            }
        });

        // 5. Save to ChromaDB (Semantic Memory)
        if (reflection.permanentMemory) {
            console.log("[Reflect API] Saving permanent memory to ChromaDB...");
            await addMemory(
                `ref_${Date.now()}`,
                reflection.permanentMemory,
                { type: "reflection", thought: reflection.thought }
            );
        }

        console.log("[Reflect API] Reflection process completed successfully.");
        return NextResponse.json({ reflection });
    } catch (error: any) {
        console.error("[Reflect API Error] Details:", {
            message: error.message,
            stack: error.stack,
            cause: error.cause
        });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}