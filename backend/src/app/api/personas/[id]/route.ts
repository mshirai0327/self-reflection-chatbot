import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";

import { getLatestStatus, flattenStatus } from "@/lib/persona";

/**
 * ペルソナのステータスを取得します
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const status = await getLatestStatus(id);
        
        if (!status) {
             // ステータスがない場合はペルソナ自体の存在確認をして、あれば名前だけ返すなどの対応も考えられるが
             // 現状はステータス必須とする
            return NextResponse.json({ error: "Persona status not found" }, { status: 404 });
        }

        const flattened = flattenStatus(status);
        return NextResponse.json(flattened);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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
            data: { 
                name: name !== undefined ? name : undefined,
                systemPrompt: body.systemPrompt !== undefined ? body.systemPrompt : undefined
            },
        });

        return NextResponse.json(updatedPersona);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
