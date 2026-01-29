import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { flashModel, generateResponse } from "@/lib/gemini";
import { queryMemories, addMemory } from "@/lib/chroma";

/**
 * 受信したチャットリクエストを処理します。
 * AIレスポンスの生成、チャット内容の保存、およびベクトルメモリの更新を行います。
 *
 * @param req - 受信した NextRequest。JSONボディに処理対象の文字列 `message` を含む必要があります。
 * @returns `response`（アシスタントの返答）と `status`（現在のペルソナステータス）を含む JSON オブジェクト。
 * 失敗した場合は、エラーメッセージ `{ error: string }` と HTTP ステータス 500 を返します。
 */
export async function POST(req: NextRequest) {
    try {
        const { message, model } = await req.json();
        console.log("[Chat API] Received message:", message);
        console.log("[Chat API] Using model:", model || flashModel);

        // 1. Get current status (or create default)
        console.log("[Chat API] Fetching persona status...");// チャット時にデータ取得。フロントでも描画する
        let status = await prisma.personaStatus.findFirst({
            orderBy: { updatedAt: 'desc' }
        });

        if (!status) {
            console.log("[Chat API] No status found, creating default.");
            status = await prisma.personaStatus.create({
                data: { height: 160, weight: 50, health: 100, mood: 50, trust: 50 }
            });
        }
        console.log("[Chat API] Current status:", status);

        // 2. Fetch relevant memories from ChromaDB
        console.log("[Chat API] Querying memories from ChromaDB...");
        const memories = await queryMemories(message);
        console.log("[Chat API] Retrieved memories:", memories);

        // 3. Generate response with Flash
        console.log("[Chat API] Generating response from Gemini...");
        const aiResponse = await generateResponse(model || flashModel, message, {
            status,
            memories: (memories as string[]) || []
        });
        console.log("[Chat API] AI Response:", aiResponse);

        // 4. Persistence
        console.log("[Chat API] Saving chat logs to Prisma...");
        await prisma.chatLog.createMany({
            data: [
                { role: "user", content: message },
                { role: "assistant", content: aiResponse }
            ]
        });

        // 5. Add to vector memory (Fragile memory)
        console.log("[Chat API] Adding message to ChromaDB...");
        await addMemory(Date.now().toString(), message, { role: "user" });

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