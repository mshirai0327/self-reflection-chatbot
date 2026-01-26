import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { proModel, generateResponse } from "@/lib/gemini";
import { addMemory } from "@/lib/chroma";

export async function POST(req: NextRequest) {
    try {
        // 1. Fetch recent chat logs (e.g., last 24h)
        const recentLogs = await prisma.chatLog.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        if (recentLogs.length === 0) {
            return NextResponse.json({ message: "No logs to reflect on." });
        }

        const logSummary = recentLogs.map((l: any) => `${l.role}: ${l.content}`).join("\n");

        // 2. Fetch current status
        const status = await prisma.personaStatus.findFirst({
            orderBy: { updatedAt: 'desc' }
        });

        if (!status) return NextResponse.json({ error: "Status not found" }, { status: 404 });

        // 3. Inference with Pro Model
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

        const resultText = await generateResponse(proModel, reflectionPrompt, {
            status,
            memories: []
        });

        // Parse JSON from LLM response (handling potential markdown)
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Failed to parse reflection result");
        const reflection = JSON.parse(jsonMatch[0]);

        // 4. Update Status in RDB
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
            await addMemory(
                `ref_${Date.now()}`,
                reflection.permanentMemory,
                { type: "reflection", thought: reflection.thought }
            );
        }

        return NextResponse.json({ reflection });
    } catch (error: any) {
        console.error("Reflection API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
