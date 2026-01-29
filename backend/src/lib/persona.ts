import { prisma } from "./prisma";

/**
 * デフォルトのユーザーおよびペルソナを取得または作成します。
 * ユーザーとペルソナは独立したエンティティとして管理されます。
 */
export const DEFAULT_USER_EMAIL = "default-user@example.com";
export const DEFAULT_PERSONA_NAME = "Reflecta";

export async function getDefaultPersona() {
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
    // 1. デフォルトユーザーを取得、なければ作成
    let user = await prisma.user.findUnique({
        where: { email: DEFAULT_USER_EMAIL }
    });

    if (!user) {
        console.log("[PersonaLib] Creating default user...");
        user = await prisma.user.create({
            data: {
                name: "Default User",
                email: DEFAULT_USER_EMAIL,
            }
        });
    }

    return user;
}
