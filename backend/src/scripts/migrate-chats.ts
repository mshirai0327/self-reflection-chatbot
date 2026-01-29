import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
    console.log('Starting migration: orphan chat logs to new Chat...');

    // 1. chatId が null の ChatLog を取得
    const orphanLogs = await prisma.chatLog.findMany({
        where: { chatId: null },
        orderBy: { createdAt: 'asc' },
    });

    if (orphanLogs.length === 0) {
        console.log('No orphan chat logs found.');
        return;
    }

    // 2. ユーザーとペルソナの組み合わせごとに最初のログを見つける
    // シンプルに、全ログを一つの「デフォルトチャット」にまとめるか、
    // ユーザーとペルソナごとに分けるか。ここでは後者。
    const userPersonaPairs = new Set<string>();
    orphanLogs.forEach(log => {
        if (log.userId && log.personaId) {
            userPersonaPairs.add(`${log.userId}:${log.personaId}`);
        }
    });

    for (const pair of userPersonaPairs) {
        const [userId, personaId] = pair.split(':');

        // このペアの最初のログ
        const firstLog = orphanLogs.find(l => l.userId === userId && l.personaId === personaId);

        if (firstLog) {
            // Chat を作成
            const newChat = await prisma.chat.create({
                data: {
                    title: "Migrated Chat " + new Date(firstLog.createdAt).toLocaleDateString(),
                    userId: userId,
                    personaId: personaId,
                    createdAt: firstLog.createdAt,
                }
            });

            console.log(`Created chat: ${newChat.id} for user ${userId} and persona ${personaId}`);

            // このペアの全てのログを更新
            const updateResult = await prisma.chatLog.updateMany({
                where: {
                    chatId: null,
                    userId: userId,
                    personaId: personaId,
                },
                data: {
                    chatId: newChat.id,
                }
            });

            console.log(`Updated ${updateResult.count} logs.`);
        }
    }

    console.log('Migration completed.');
}

migrate()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
