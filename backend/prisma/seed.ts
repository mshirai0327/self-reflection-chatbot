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
        where: { id: 'default-persona-id' },
        update: {},
        create: {
            id: 'default-persona-id',
            name: 'Reflecta',
        },
    })

    // 3. 初期ステータス (Hub) の作成
    // 最新ステータスはstatusHistoryから取得する（循環参照解消のため）
    const existingPersona = await prisma.persona.findUnique({
        where: { id: persona.id },
        include: {
            statusHistory: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
    })

    if (!existingPersona?.statusHistory?.length) {
        console.log('Creating initial status...')
        await prisma.personaStatus.create({
            data: {
                personaId: persona.id,

                quantityUnchange: {
                    create: {
                        birthDate: new Date('2024-01-01'),
                        gender: 'Female',
                        bloodType: 'A',
                        chronotype: 'Morning',
                        bitternessSense: 50,
                        intelligence: 120,
                    }
                },

                semiquantityUnchange: {
                    create: {
                        ethics: 80,
                        passion: 60,
                        curiosity: 90,
                        aggressiveness: 40,
                        extroversion: 70,
                    }
                },

                quantityIrreversible: {
                    create: {
                        height: 160.0,
                        boneDensity: 1.0,
                        version: 1,
                    }
                },

                quantityReversible: {
                    create: {
                        weight: 50.0,
                        bloodSugar: 90.0,
                        bloodPressureSys: 110,
                        bloodPressureDia: 70,
                        sleepTime: 7.5,
                        sleepQuality: 80,
                        version: 1,
                    }
                },

                semiquantityReversible: {
                    create: {
                        trust: 50,
                        friendliness: 50,
                        mood: 50,
                        health: 100,
                        version: 1,
                    }
                }
            }
        })
    } else {
        console.log('Initial status already exists. Skipping.')
    }

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
