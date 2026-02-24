import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { queryMemories, addMemory } from "@/lib/chroma";
import { getDefaultPersona, getDefaultUser, getLatestStatus, flattenStatus, calculateGrowthDelta } from "@/lib/persona";
import { generateResponse, LLMConfig } from "@/lib/llm";
import { isProviderAllowed } from "@/lib/env";
import { ulid } from "ulid";

/**
 * 受信したチャットリクエストを処理します。
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { message, model, llmConfig, groupChatId } = body;

        // デフォルト設定
        const activeConfig: LLMConfig = llmConfig || {
            provider: "gemini",
            model: model || "gemini-1.5-flash"
        };

        // SSRF対策: 本番環境では local プロバイダーを拒否
        if (!isProviderAllowed(activeConfig.provider)) {
            return NextResponse.json(
                { error: "Local LLM provider is not available in this environment." },
                { status: 403 }
            );
        }

        console.log("[Chat API] Received message:", message);
        console.log("[Chat API] LLM Provider:", activeConfig.provider);

        // デフォルトのペルソナとユーザーを取得（独立したエンティティ）
        // personaIdが指定されている場合はそのペルソナを使用し、なければデフォルトを使用
        let persona;
        if (body.personaId) {
            persona = await prisma.persona.findUnique({
                where: { id: body.personaId }
            });
            if (!persona) {
                return NextResponse.json({ error: "Persona not found" }, { status: 404 });
            }
        } else {
            persona = await getDefaultPersona();
        }

        const user = await getDefaultUser();

        // 1. 最新のステータスを取得
        console.log("[Chat API] Fetching persona status...");
        const fullStatus = await getLatestStatus(persona.id);
        const status = flattenStatus(fullStatus) || {
            name: persona?.name || 'Reflecta',
            height: 160,
            weight: 50,
            health: 100,
            mood: 50,
            trust: 50
        };

        const growthDelta = await calculateGrowthDelta(persona.id);

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

        // グループチャットの場合は参加者情報を取得
        let participants: { name: string; role: string; status: any; system_prompt: string | null }[] = [];
        let currentSpeakerName: string | null = null;

        if (groupChatId) {
            const groupChat = await prisma.groupChat.findUnique({
                where: { id: groupChatId },
                include: {
                    participants: {
                        include: { persona: true },
                        orderBy: { sortOrder: 'asc' }
                    }
                }
            });

            if (groupChat) {
                // 全参加ペルソナのステータスを取得
                for (const p of groupChat.participants) {
                    const pFullStatus = await getLatestStatus(p.persona.id);
                    const pStatus = flattenStatus(pFullStatus);
                    participants.push({
                        name: p.persona.name,
                        role: p.role,
                        status: pStatus,
                        system_prompt: p.persona.systemPrompt || null,
                    });
                }

                // 交互発言: 直前のassistantメッセージの発言者の次のペルソナを選択
                if (groupChat.participants.length > 0) {
                    const lastAssistantLog = await prisma.chatLog.findFirst({
                        where: { groupChatId, role: 'assistant' },
                        orderBy: { createdAt: 'desc' },
                        include: { persona: { select: { id: true } } }
                    });

                    if (lastAssistantLog) {
                        const lastIdx = groupChat.participants.findIndex(
                            p => p.personaId === lastAssistantLog.personaId
                        );
                        const nextIdx = (lastIdx + 1) % groupChat.participants.length;
                        currentSpeakerName = groupChat.participants[nextIdx].persona.name;
                        // personaを次の発言者に更新
                        persona = groupChat.participants[nextIdx].persona as typeof persona;
                    } else {
                        // 初回発言: 最初のペルソナ
                        currentSpeakerName = groupChat.participants[0].persona.name;
                        persona = groupChat.participants[0].persona as typeof persona;
                    }
                }

                console.log(`[Chat API] Group chat: ${participants.length} participants, next speaker: ${currentSpeakerName}`);
            }
        }

        const { content: aiResponse, systemInstruction } = await generateResponse(activeConfig, message, {
            status,
            memories: memoryStrings,
            history,
            growthDelta,
            systemPrompt: persona?.systemPrompt || undefined,
            participants,
            currentSpeakerName,
        });


        console.log("[Chat API] AI Response received.");

        // 4. Prismaへの会話ログ保存
        console.log("[Chat API] Saving chat logs to Prisma...");
        let targetChatId = body.chatId;
        let targetGroupChatId = groupChatId || null;

        // chatId が指定されていない場合は新規作成（1:1チャットのみ）
        if (!targetChatId && !targetGroupChatId) {
            const firstWords = message.substring(0, 15);
            const newChat = await prisma.chat.create({
                data: {
                    title: firstWords + (message.length > 15 ? "..." : ""),
                    userId: user.id,
                    personaId: persona.id,
                }
            });
            targetChatId = newChat.id;
        } else if (targetChatId) {
            // 既存1:1チャットの更新日時を更新
            await prisma.chat.update({
                where: { id: targetChatId },
                data: { updatedAt: new Date() }
            });
        } else if (targetGroupChatId) {
            // グループチャットの更新日時を更新
            await prisma.groupChat.update({
                where: { id: targetGroupChatId },
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
                chatId: targetChatId || null,
                groupChatId: targetGroupChatId || null,
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
                chatId: targetChatId || null,
                groupChatId: targetGroupChatId || null,
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
            groupChatId: targetGroupChatId,
            name: persona.name,
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