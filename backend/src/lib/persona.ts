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
 * ペルソナの最新ステータスを、リレーション (不変・可変含む) を含めて取得します。
 */
export async function getLatestStatus(personaId: string) {
    const persona = await prisma.persona.findUnique({
        where: { id: personaId },
        include: {
            quantityUnchange: true,
            semiquantityUnchange: true,
            status: {
                include: {
                    quantityIrreversible: { orderBy: { version: 'desc' }, take: 1 },
                    quantityReversible: { orderBy: { version: 'desc' }, take: 1 },
                    semiquantityReversible: { orderBy: { version: 'desc' }, take: 1 },
                }
            }
        }
    });

    if (!persona?.status) return null;

    // 最新の1件を取得してマージ
    return {
        ...persona.status,
        name: persona.name, // Include persona name
        systemPrompt: persona.systemPrompt, // Include system prompt (Added)
        quantityUnchange: persona.quantityUnchange,
        semiquantityUnchange: persona.semiquantityUnchange,
        // 配列の最初の要素（最新）を展開
        quantityIrreversible: persona.status.quantityIrreversible[0] || null,
        quantityReversible: persona.status.quantityReversible[0] || null,
        semiquantityReversible: persona.status.semiquantityReversible[0] || null,
    };
}

/**
 * JSON配列から特定のラベルの値を取得するヘルパー関数
 */
function getVal(json: any, label: string): number | undefined {
    if (!Array.isArray(json)) return undefined;
    const item = json.find((i: any) => i.label === label);
    return item ? Number(item.value) : undefined;
}

/**
 * 複雑なStatus構造を、フロントエンドやLLMが扱いやすいフラットな形式に変換します。
 */
export function flattenStatus(fullStatus: any) {
    if (!fullStatus) return null;

    // JSONデータの取得 (fullStatusには既に最新の1件が入っている前提)
    const reversibleVal = fullStatus.quantityReversible?.value;
    const semiReversibleVal = fullStatus.semiquantityReversible?.value;

    return {
        id: fullStatus.statusId, // Status ID explicitly included
        personaId: fullStatus.personaId, // Persona ID explicitly included
        name: fullStatus.name, // Include persona name
        systemPrompt: fullStatus.systemPrompt, // Include system prompt (Added)
        // Lv1-1: QuantityUnchange
        birthDate: fullStatus.quantityUnchange?.birthDate,
        gender: fullStatus.quantityUnchange?.gender,
        bloodType: fullStatus.quantityUnchange?.bloodType,
        chronotype: fullStatus.quantityUnchange?.chronotype,
        bitternessSense: fullStatus.quantityUnchange?.bitternessSense,
        intelligence: fullStatus.quantityUnchange?.intelligence,

        // Lv1-2: SemiquantityUnchange
        ethics: fullStatus.semiquantityUnchange?.ethics,
        passion: fullStatus.semiquantityUnchange?.passion,
        curiosity: fullStatus.semiquantityUnchange?.curiosity,
        aggressiveness: fullStatus.semiquantityUnchange?.aggressiveness,
        extroversion: fullStatus.semiquantityUnchange?.extroversion,

        // Lv2: QuantityIrreversible
        height: fullStatus.quantityIrreversible?.height,
        boneDensity: fullStatus.quantityIrreversible?.boneDensity,
        gripStrength: fullStatus.quantityIrreversible?.gripStrength,
        voicePitch: fullStatus.quantityIrreversible?.voicePitch,
        eyesight: fullStatus.quantityIrreversible?.eyesight,
        hearingAbility: fullStatus.quantityIrreversible?.hearingAbility,

        // Lv3-1: QuantityReversible (JSON parsing)
        weight: getVal(reversibleVal, "weight"),
        bloodSugar: getVal(reversibleVal, "bloodSugar"),
        bloodPressureSys: getVal(reversibleVal, "bloodPressureSys"),
        bloodPressureDia: getVal(reversibleVal, "bloodPressureDia"),
        sleepTime: getVal(reversibleVal, "sleepTime"),
        sleepQuality: getVal(reversibleVal, "sleepQuality"),

        // Lv3-2: SemiquantityReversible (JSON parsing)
        health: getVal(semiReversibleVal, "health"),
        mood: getVal(semiReversibleVal, "mood"),
        trust: getVal(semiReversibleVal, "trust"),
        friendliness: getVal(semiReversibleVal, "friendliness"),
    };
}

/**
 * Lv2 (QuantityIrreversibleStatus) から最新2件の身長を取得し、その差分（成長量）を計算します。
 * 0.1cm以上の増加がある場合に有意な値として扱われることを想定しています。
 */
export async function calculateGrowthDelta(personaId: string): Promise<number> {
    const personaStatus = await prisma.personaStatus.findUnique({
        where: { personaId },
        select: { statusId: true }
    });

    if (!personaStatus) return 0;

    const records = await prisma.quantityIrreversibleStatus.findMany({
        where: { personaStatusId: personaStatus.statusId },
        orderBy: { recordedAt: 'desc' },
        take: 2,
        select: { height: true }
    });

    if (records.length < 2) return 0;

    const current = records[0].height;
    const previous = records[1].height;

    if (current === null || previous === null || current === undefined || previous === undefined) return 0;

    return current - previous;
}
