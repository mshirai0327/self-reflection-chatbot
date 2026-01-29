import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { getDefaultPersona, getDefaultUser } from "@/lib/persona";

/**
 * チャット（セッション）の一覧を取得します
 */
export async function GET() {
    try {
        const persona = await getDefaultPersona();
        console.log(`[API Chats GET] Fetching chats for persona: ${persona.id}`);

        const chats = await prisma.chat.findMany({
            where: { personaId: persona.id },
            orderBy: { updatedAt: 'desc' }
        });
        console.log(`[API Chats GET] Found ${chats.length} chats.`);
        return NextResponse.json(chats);
    } catch (error: any) {
        console.error("[API Chats GET] CRITICAL ERROR:", error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}

/**
 * 新しいチャット（セッション）を作成します
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title } = body;

        const persona = await getDefaultPersona();
        const user = await getDefaultUser();

        const newChat = await prisma.chat.create({
            data: {
                title: title || "New Chat",
                userId: user.id,
                personaId: persona.id,
            }
        });

        return NextResponse.json(newChat);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
