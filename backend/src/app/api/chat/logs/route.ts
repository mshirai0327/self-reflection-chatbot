import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const logs = await prisma.chatLog.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(logs);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
