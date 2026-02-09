import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { getLatestStatus, flattenStatus } from "@/lib/persona";

/**
 * 特定のチャット（セッション）のログを取得します
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const chat = await prisma.chat.findUnique({
            where: { id },
            include: {
                chatLogs: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        // このチャットに関連するペルソナの最新の内省結果を取得
        const latestReflection = await prisma.reflectionEvent.findFirst({
            where: { personaId: chat.personaId },
            orderBy: { createdAt: 'desc' }
        });

        let formattedReflection = null;
        if (latestReflection) {
            const { response, ...base } = latestReflection;
            formattedReflection = {
                ...base,
                response: typeof response === 'object' && response !== null ? { ...response } : response
            };
        }

        // ペルソナの最新ステータスを取得
        const fullStatus = await getLatestStatus(chat.personaId);
        const status = flattenStatus(fullStatus);


        return NextResponse.json({ ...chat, latestReflection: formattedReflection, status });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * チャットのタイトルを更新します
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { title } = body;

        if (!title) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        const updatedChat = await prisma.chat.update({
            where: { id },
            data: { title },
        });

        return NextResponse.json(updatedChat);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
