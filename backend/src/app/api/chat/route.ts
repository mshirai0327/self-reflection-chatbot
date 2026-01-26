import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flashModel, generateResponse } from "@/lib/gemini";
import { queryMemories, addMemory } from "@/lib/chroma";

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();

        // 1. Get current status (or create default)
        let status = await prisma.personaStatus.findFirst({
            orderBy: { updatedAt: 'desc' }
        });

        if (!status) {
            status = await prisma.personaStatus.create({
                data: { height: 160, weight: 50, health: 100, mood: 50, trust: 50 }
            });
        }

        // 2. Fetch relevant memories from ChromaDB
        const memories = await queryMemories(message);

        // 3. Generate response with Flash
        const aiResponse = await generateResponse(flashModel, message, {
            status,
            memories: (memories as string[]) || []
        });

        // 4. Persistence
        await prisma.chatLog.createMany({
            data: [
                { role: "user", content: message },
                { role: "assistant", content: aiResponse }
            ]
        });

        // 5. Add to vector memory (Fragile memory)
        await addMemory(Date.now().toString(), message, { role: "user" });

        return NextResponse.json({
            response: aiResponse,
            status: status
        });
    } catch (error: any) {
        console.error("Chat API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
