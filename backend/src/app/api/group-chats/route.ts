import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { getDefaultUser } from "@/lib/persona";

/**
 * グループチャット一覧を取得します。
 * クエリパラメータ `personaId` を指定すると、そのペルソナが参加しているグループチャットのみ返却します。
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const personaId = searchParams.get('personaId');
        const user = await getDefaultUser();

        const whereClause: any = { userId: user.id };
        if (personaId) {
            whereClause.participants = {
                some: { personaId }
            };
        }

        const groupChats = await prisma.groupChat.findMany({
            where: whereClause,
            orderBy: { updatedAt: 'desc' },
            include: {
                participants: {
                    include: { persona: { select: { id: true, name: true } } },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });

        return NextResponse.json(groupChats);
    } catch (error: any) {
        console.error("[API GroupChats GET] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * 新しいグループチャットを作成します。
 *
 * @param req.body.title - グループチャットのタイトル
 * @param req.body.personaIds - 参加させるペルソナIDの配列（2つ以上）
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, personaIds } = body;
        const user = await getDefaultUser();

        if (!personaIds || !Array.isArray(personaIds) || personaIds.length < 2) {
            return NextResponse.json(
                { error: "グループチャットには2つ以上のペルソナが必要です。" },
                { status: 400 }
            );
        }

        const groupChat = await prisma.groupChat.create({
            data: {
                title: title || "New Group Chat",
                userId: user.id,
                participants: {
                    create: personaIds.map((personaId: string, index: number) => ({
                        personaId,
                        role: index === 0 ? "main" : "guest",
                        sortOrder: index,
                    })),
                },
            },
            include: {
                participants: {
                    include: { persona: { select: { id: true, name: true } } },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });

        return NextResponse.json(groupChat, { status: 201 });
    } catch (error: any) {
        console.error("[API GroupChats POST] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
