import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";

/**
 * ペルソナの情報を更新します
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name } = body;

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const updatedPersona = await prisma.persona.update({
            where: { id },
            data: { name },
        });

        return NextResponse.json(updatedPersona);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
