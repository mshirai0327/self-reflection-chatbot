import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { getLatestStatus, flattenStatus } from "@/lib/persona";

/**
 * 特定のチャット（セッション）のログを取得します
 * 
 * クエリパラメータ:
 * - take: 取得件数 (デフォルト: 20)
 * - cursor: カーソル（chatLogのid）。指定した場合、そのidより古いログを取得する
 * 
 * レスポンスには hasMore（追加データ有無）と nextCursor（次回取得用カーソル）を含む
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = new URL(req.url);
        const take = Math.min(Number(url.searchParams.get('take') || '20'), 100);
        const cursor = url.searchParams.get('cursor') || undefined;

        const chat = await prisma.chat.findUnique({
            where: { id },
            select: { id: true, title: true, personaId: true, createdAt: true, updatedAt: true }
        });

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        // カーソルベースのページネーションでチャットログを取得
        // 最新のメッセージから逆順（desc）で取得し、フロント側で反転して表示する
        const chatLogs = await prisma.chatLog.findMany({
            where: { chatId: id },
            orderBy: { createdAt: 'desc' },
            take: take + 1, // 次ページの有無を判定するために1件多く取得
            ...(cursor ? {
                cursor: { id: cursor },
                skip: 1, // カーソル自体はスキップする
            } : {}),
        });

        // 追加データの有無を判定
        const hasMore = chatLogs.length > take;
        if (hasMore) {
            chatLogs.pop(); // 判定用の余分な1件を除去
        }

        // 次回取得用のカーソル（最も古いログのid）
        const nextCursor = hasMore && chatLogs.length > 0
            ? chatLogs[chatLogs.length - 1].id
            : null;

        // 時系列順（asc）に戻す
        chatLogs.reverse();

        // 初回取得時（カーソルなし）のみ内省結果とステータスを返す
        let latestReflection = null;
        let status = null;

        if (!cursor) {
            const reflectionEvent = await prisma.reflectionEvent.findFirst({
                where: { personaId: chat.personaId },
                orderBy: { createdAt: 'desc' }
            });

            if (reflectionEvent) {
                const { response, ...base } = reflectionEvent;
                latestReflection = {
                    ...base,
                    response: typeof response === 'object' && response !== null ? { ...response } : response
                };
            }

            const fullStatus = await getLatestStatus(chat.personaId);
            status = flattenStatus(fullStatus);
        }

        return NextResponse.json({
            ...chat,
            chatLogs,
            hasMore,
            nextCursor,
            latestReflection,
            status,
        });
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
