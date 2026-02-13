import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";

/**
 * ペルソナの不可逆データ（Lv2）の履歴を時系列で取得します。
 * 人格ログページのグラフ表示に使用されます。
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // ペルソナの存在確認
        const persona = await prisma.persona.findUnique({
            where: { id },
            include: {
                status: true
            }
        });

        if (!persona) {
            return NextResponse.json({ error: "Persona not found" }, { status: 404 });
        }

        if (!persona.status) {
            return NextResponse.json({ error: "Persona status not found" }, { status: 404 });
        }

        // Lv2: 不可逆データの履歴を時系列順で取得
        const irreversibleHistory = await prisma.quantityIrreversibleStatus.findMany({
            where: { personaStatusId: persona.status.statusId },
            orderBy: { recordedAt: 'asc' },
        });

        // Lv3-1: 可逆定量データの履歴
        const reversibleHistory = await prisma.quantityReversibleStatus.findMany({
            where: { personaStatusId: persona.status.statusId },
            orderBy: { recordedAt: 'asc' },
        });

        // Lv3-2: 可逆半定量データ（感情等）の履歴
        const semiquantityHistory = await prisma.semiquantityReversibleStatus.findMany({
            where: { personaStatusId: persona.status.statusId },
            orderBy: { recordedAt: 'asc' },
        });

        return NextResponse.json({
            personaId: id,
            personaName: persona.name,
            irreversibleHistory,
            reversibleHistory,
            semiquantityHistory,
        });
    } catch (error: any) {
        console.error("[API Persona History] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
