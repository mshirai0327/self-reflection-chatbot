import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";

/**
 * 特定のグループチャットのログと参加者情報を取得します。
 *
 * クエリパラメータ:
 * - take: 取得件数 (デフォルト: 20)
 * - cursor: カーソル（chatLogのid）。指定した場合、そのidより古いログを取得する
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = new URL(req.url);
        const rawTake = parseInt(url.searchParams.get('take') ?? '20', 10);
        const parsedTake = (Number.isNaN(rawTake) || !Number.isFinite(rawTake)) ? 20 : rawTake;
        const take = Math.min(Math.max(parsedTake, 1), 100);
        const cursor = url.searchParams.get('cursor') || undefined;

        const groupChat = await prisma.groupChat.findUnique({
            where: { id },
            include: {
                participants: {
                    include: { persona: { select: { id: true, name: true } } },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });

        if (!groupChat) {
            return NextResponse.json({ error: "Group chat not found" }, { status: 404 });
        }

        // カーソルベースのページネーションでチャットログを取得
        const chatLogs = await prisma.chatLog.findMany({
            where: { groupChatId: id },
            orderBy: { createdAt: 'desc' },
            take: take + 1,
            include: { persona: { select: { name: true } } },
            ...(cursor ? {
                cursor: { id: cursor },
                skip: 1,
            } : {}),
        });

        const hasMore = chatLogs.length > take;
        if (hasMore) {
            chatLogs.pop();
        }

        const nextCursor = hasMore && chatLogs.length > 0
            ? chatLogs[chatLogs.length - 1].id
            : null;

        // 時系列順（asc）に戻す
        chatLogs.reverse();

        return NextResponse.json({
            ...groupChat,
            chatLogs,
            hasMore,
            nextCursor,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * グループチャットのタイトルやオプションを更新します。
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { title, options } = body;

        const data: any = {};
        if (title !== undefined) data.title = title;
        if (options !== undefined) data.options = options;

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        const updatedGroupChat = await prisma.groupChat.update({
            where: { id },
            data,
            include: {
                participants: {
                    include: { persona: { select: { id: true, name: true } } },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });

        return NextResponse.json(updatedGroupChat);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * グループチャットを削除します（参加者も Cascade で削除される）。
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await prisma.groupChat.delete({
            where: { id }
        });

        return NextResponse.json({ message: "Group chat deleted" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
