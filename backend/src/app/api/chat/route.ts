import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { queryMemories, addMemory } from "@/lib/chroma";
import { getDefaultPersona, getDefaultUser } from "@/lib/persona";
import { generateLLMResponse, LLMConfig } from "@/lib/llm";

/**
 * 受信したチャットリクエストを処理します。
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { message, model, llmConfig } = body;

        // デフォルト設定
        const activeConfig: LLMConfig = llmConfig || {
            provider: "gemini",
            model: model || "gemini-2.5-flash"
        };

        console.log("[Chat API] Received message:", message);
        console.log("[Chat API] LLM Provider:", activeConfig.provider);

        // デフォルトのペルソナとユーザーを取得（独立したエンティティ）
        const persona = await getDefaultPersona();
        const user = await getDefaultUser();

        // 1. 最新のステータスを取得 (なければ作成)
        console.log("[Chat API] Fetching persona status...");
        let status = await prisma.personaStatus.findFirst({
            where: { personaId: persona.id },
            orderBy: { updatedAt: 'desc' }
        });

        if (!status) {
            console.log("[Chat API] No status found, creating default.");
            status = await prisma.personaStatus.create({
                data: {
                    personaId: persona.id,
                    height: 160, weight: 50, health: 100, mood: 50, trust: 50
                }
            });
        }

        // 2. Fetch relevant memories from ChromaDB
        const memories = await queryMemories(message);

        // 3. Generate response with chosen LLM
        console.log("[Chat API] Requesting AI response...");
        const aiResponse = await generateLLMResponse(activeConfig, message, {
            status,
            memories: (memories as string[]) || []
        });
        console.log("[Chat API] AI Response received.");

        // 4. Prismaへの会話ログ保存 (User/Persona 両方のIDを独立して付与)
        console.log("[Chat API] Saving chat logs to Prisma...");
        const chatData = [
            { role: "user", content: message, userId: user.id, personaId: persona.id },
            { role: "assistant", content: aiResponse, userId: user.id, personaId: persona.id }
        ];

        await prisma.chatLog.createMany({
            data: chatData
        });

        // 5. Add to vector memory (Fragile memory)
        console.log("[Chat API] Adding message to ChromaDB...");
        await addMemory(Date.now().toString(), message, {
            role: "user",
            personaId: persona.id // ベクトルストア側にもメタデータを付与可能
        });

        console.log("[Chat API] Success!");
        return NextResponse.json({
            response: aiResponse,
            status: status
        });
    } catch (error: any) {
        console.error("[Chat API Error] Details:", {
            message: error.message,
            stack: error.stack,
            cause: error.cause
        });

        // Gemini APIからの429エラーなどを検知して適切なステータスを返す
        const status = error.message?.includes("429") || error.status === 429 ? 429 : 500;
        const errorMessage = status === 429
            ? "現在アクセスが集中しているか、利用枠を超えています。少し時間を置いてからお試しください。"
            : error.message;

        return NextResponse.json({ error: errorMessage }, { status });
    }
}