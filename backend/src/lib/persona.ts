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
                    quantityIrreversible: true,
                    quantityReversible: true,
                    semiquantityReversible: true,
                }
            }
        }
    });

    if (!persona?.status) return null;

    // 以前のインターフェースと互換性を持たせるため、または扱いやすくするために
    // PersonaStatusオブジェクトに不変ステータスをマージしたような形、あるいは複合オブジェクトを返す
    return {
        ...persona.status,
        quantityUnchange: persona.quantityUnchange,
        semiquantityUnchange: persona.semiquantityUnchange,
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

    // JSONデータの取得
    const reversibleVal = fullStatus.quantityReversible?.value;
    const semiReversibleVal = fullStatus.semiquantityReversible?.value;

    return {
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
