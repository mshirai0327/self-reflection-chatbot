import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { queryMemories, addMemory } from "@/lib/chroma";
import { getDefaultPersona, getDefaultUser, getLatestStatus, flattenStatus } from "@/lib/persona";
import { generateResponse, LLMConfig } from "@/lib/llm";
import { ulid } from "ulid";

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

        // 1. 最新のステータスを取得
        console.log("[Chat API] Fetching persona status...");
        const fullStatus = await getLatestStatus(persona.id);
        const status = flattenStatus(fullStatus) || {
            height: 160, weight: 50, health: 100, mood: 50, trust: 50
        };

        // 2. Fetch relevant memories from ChromaDB
        // chatIdがある場合は、そのチャットの記憶のみを検索対象にする
        // 新規チャット(chatIdなし)の場合は、他のチャットの文脈が混ざらないように検索しない
        let memories: Awaited<ReturnType<typeof queryMemories>> = [];
        if (body.chatId) {
            memories = await queryMemories(message, body.chatId);
        }

        // 2.5 Fetch conversation history (Short-term memory)
        let history: { role: string; content: string }[] = [];
        if (body.chatId) {
            try {
                const logs = await prisma.chatLog.findMany({
                    where: { chatId: body.chatId },
                    orderBy: { createdAt: 'desc' },
                    take: 10,// 直近10件のチャットログを送る。
                });
                history = logs.reverse().map(log => ({
                    role: log.role,
                    content: log.content
                }));
                console.log(`[Chat API] Fetched ${history.length} history items for context.`);
            } catch (err) {
                console.error("[Chat API] Failed to fetch chat history:", err);
            }
        }

        // 3. Generate response with chosen LLM
        console.log("[Chat API] Requesting AI response...");
        const memoryStrings = memories.map(m => m.content).filter((c): c is string => c !== null);
        const { content: aiResponse, systemInstruction } = await generateResponse(activeConfig, message, {
            status,
            memories: memoryStrings,
            history
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
        // Phase 2: 全ての会話を無条件に保存するのを停止。内省(Reflect)時に重要な記憶のみを保存する方針に変更。
        /*
        console.log("[Chat API] Adding message to ChromaDB...");
        await addMemory(ulid(), message, {
            role: "user",
            personaId: persona.id,
            chatId: targetChatId // メタデータにchatIdを保持
        });
        */

        console.log("[Chat API] Success!");
        return NextResponse.json({
            response: aiResponse,
            status: status,
            chatId: targetChatId,
            debug: {
                systemPrompt: systemInstruction,
                userPrompt: message,
                contextMemories: memories || []
            }
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