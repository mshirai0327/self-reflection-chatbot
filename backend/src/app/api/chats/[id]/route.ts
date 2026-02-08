import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";

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
        if (latestReflection && typeof latestReflection.response === 'object' && latestReflection.response !== null) {
            formattedReflection = {
                ...latestReflection,
                ...(latestReflection.response as object),
            };
            // responseフィールドは重複するため削除（型定義上は残るがJSON出力からは消える）
            delete (formattedReflection as any).response;
        }

        return NextResponse.json({ ...chat, latestReflection: formattedReflection });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
