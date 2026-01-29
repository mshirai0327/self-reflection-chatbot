import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('Start seeding...')

    // 1. デフォルトユーザー
    const user = await prisma.user.upsert({
        where: { email: 'default-user@example.com' },
        update: {},
        create: {
            email: 'default-user@example.com',
            name: 'Default User',
        },
    })

    // 2. デフォルトペルソナ
    const persona = await prisma.persona.upsert({
        where: { id: 'default-persona-id' }, // 通常はUUIDだが、シード用に固定IDを試みるか、findFirstで代用
        update: {},
        create: {
            id: 'default-persona-id',
            name: 'Reflecta',
        },
    })

    // 3. 初期ステータス
    await prisma.personaStatus.create({
        data: {
            personaId: persona.id,
            height: 160.0,
            weight: 50.0,
            health: 100,
            mood: 50,
            trust: 50,
        },
    })

    console.log('Seeding finished.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
