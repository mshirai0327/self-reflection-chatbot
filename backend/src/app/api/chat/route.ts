import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { queryMemories, addMemory } from "@/lib/chroma";
import { getDefaultPersona, getDefaultUser } from "@/lib/persona";
import { generateResponse, LLMConfig } from "@/lib/llm";

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
            model: model || "gemini-1.5-flash"
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
        const aiResponse = await generateResponse(activeConfig, message, {
            status,
            memories: (memories as string[]) || []
        });
        console.log("[Chat API] AI Response received.");

        // 4. Prismaへの会話ログ保存
        console.log("[Chat API] Saving chat logs to Prisma...");
        let targetChatId = body.chatId;

        // chatId が指定されていない場合は新規作成
        if (!targetChatId) {
            const firstWords = message.substring(0, 15);
            const newChat = await prisma.chat.create({
                data: {
                    title: firstWords + (message.length > 15 ? "..." : ""),
                    userId: user.id,
                    personaId: persona.id,
                }
            });
            targetChatId = newChat.id;
        } else {
            // 既存チャットの更新日時を更新
            await prisma.chat.update({
                where: { id: targetChatId },
                data: { updatedAt: new Date() }
            });
        }

        // ログ。トランザクションで一括保存するか、個別に作成
        // ログ保存。順序を保証するために直列実行し、createdAtの重複を避ける
        await prisma.chatLog.create({
            data: {
                role: "user",
                content: message,
                userId: user.id,
                personaId: persona.id,
                chatId: targetChatId,
                // AIの応答より確実に前にするために現在時刻を使用
                createdAt: new Date()
            }
        });

        // わずかに時間をずらす（DBの精度によっては同時刻扱いになるのを防ぐ）
        await new Promise(resolve => setTimeout(resolve, 50));

        await prisma.chatLog.create({
            data: {
                role: "assistant",
                content: aiResponse,
                userId: user.id,
                personaId: persona.id,
                chatId: targetChatId,
                createdAt: new Date()
            }
        });

        // 5. Add to vector memory (Fragile memory)
        console.log("[Chat API] Adding message to ChromaDB...");
        await addMemory(Date.now().toString(), message, {
            role: "user",
            personaId: persona.id,
            chatId: targetChatId // メタデータにchatIdを保持
        });

        console.log("[Chat API] Success!");
        return NextResponse.json({
            response: aiResponse,
            status: status,
            chatId: targetChatId
        });
    } catch (error: unknown) {
        let errorMessage = "An unknown error occurred";
        let errorStatus = 500;
        let errorDetails: Record<string, unknown> = {};

        if (error instanceof Error) {
            errorMessage = error.message;
            errorDetails = { message: error.message, stack: error.stack, cause: (error as any).cause };

            const errorAny = error as any;
            const isRateLimit = errorAny.message?.includes("429") || errorAny.status === 429;
            
            if (isRateLimit) {
                errorStatus = 429;
                errorMessage = "現在アクセスが集中しているか、利用枠を超えています。少し時間を置いてからお試しください。";
            }
        } else {
            errorDetails = { error };
        }
        
        console.error("[Chat API Error] Details:", errorDetails);

        return NextResponse.json({ error: errorMessage }, { status: errorStatus });
    }
}