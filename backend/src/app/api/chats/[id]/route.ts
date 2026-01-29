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

        return NextResponse.json(chat);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
