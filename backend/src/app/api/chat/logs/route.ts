import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { getDefaultPersona } from "@/lib/persona";

export async function GET() {
    try {
        const persona = await getDefaultPersona();
        const logs = await prisma.chatLog.findMany({
            where: { personaId: persona.id },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(logs);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
