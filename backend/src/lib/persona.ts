import { prisma } from "@/lib/prisma";

/**
 * デフォルトのユーザーおよびペルソナを取得または作成します。
 * ユーザーとペルソナは独立したエンティティとして管理されます。
 */
export const DEFAULT_USER_EMAIL = "default-user@example.com";
export const DEFAULT_PERSONA_NAME = "Reflecta";

export async function getDefaultPersona() {
    if (!prisma.persona) {
        console.error("[PersonaLib] CRITICAL ERROR: prisma.persona is undefined! Available keys:", Object.keys(prisma));
        throw new Error("Prisma Client is not synced with schema. Please restart containers.");
    }
    // 1. デフォルトペルソナを取得、なければ作成
    let persona = await prisma.persona.findFirst({
        where: { name: DEFAULT_PERSONA_NAME }
    });

    if (!persona) {
        console.log("[PersonaLib] Creating default persona...");
        persona = await prisma.persona.create({
            data: {
                name: DEFAULT_PERSONA_NAME
            }
        });
    }

    return persona;
}

export async function getDefaultUser() {
    // レースコンディションを避けるため upsert を使用
    return await prisma.user.upsert({
        where: { email: DEFAULT_USER_EMAIL },
        update: {},
        create: {
            name: "Default User",
            email: DEFAULT_USER_EMAIL,
        }
    });
}

/**
 * ペルソナの最新ステータスを、リレーションを含めて取得します。
 */
export async function getLatestStatus(personaId: string) {
    const persona = await prisma.persona.findUnique({
        where: { id: personaId },
        select: { statusId: true }
    });

    if (!persona?.statusId) return null;

    return await prisma.personaStatus.findUnique({
        where: { statusId: persona.statusId },
        include: {
            quantityUnchange: true,
            semiquantityUnchange: true,
            quantityIrreversible: true,
            quantityReversible: true,
            semiquantityReversible: true,
        }
    });
}

/**
 * 複雑なStatus構造を、フロントエンドやLLMが扱いやすいフラットな形式に変換します。
 */
export function flattenStatus(fullStatus: any) {
    if (!fullStatus) return null;

    return {
        // Lv1
        birthDate: fullStatus.quantityUnchange?.birthDate,
        gender: fullStatus.quantityUnchange?.gender,
        bloodType: fullStatus.quantityUnchange?.bloodType,
        chronotype: fullStatus.quantityUnchange?.chronotype,
        intelligence: fullStatus.quantityUnchange?.intelligence,

        ethics: fullStatus.semiquantityUnchange?.ethics,
        passion: fullStatus.semiquantityUnchange?.passion,
        curiosity: fullStatus.semiquantityUnchange?.curiosity,

        // Lv2
        height: fullStatus.quantityIrreversible?.height,
        boneDensity: fullStatus.quantityIrreversible?.boneDensity,

        // Lv3
        weight: fullStatus.quantityReversible?.weight,
        health: fullStatus.semiquantityReversible?.health,
        mood: fullStatus.semiquantityReversible?.mood,
        trust: fullStatus.semiquantityReversible?.trust,
        friendliness: fullStatus.semiquantityReversible?.friendliness,
    };
}
