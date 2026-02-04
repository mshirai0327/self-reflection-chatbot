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

    const existingStatus = await prisma.persona.findUnique({
        where: { id: persona.id },
        include: { status: true, quantityUnchange: true, semiquantityUnchange: true }
    })

    if (!existingStatus?.quantityUnchange) {
        console.log('Creating immutable statuses...')
        await prisma.quantityUnchangeStatus.create({
            data: {
                personaId: persona.id,
                birthDate: new Date('2024-01-01'),
                gender: 'Female',
                bloodType: 'A',
                chronotype: 'Morning',
                bitternessSense: 50,
                intelligence: 120,
            }
        })
    }

    if (!existingStatus?.semiquantityUnchange) { // Assuming we check via include if added, or just rely on logic
        await prisma.semiquantityUnchangeStatus.create({
            data: {
                personaId: persona.id,
                ethics: 80,
                passion: 60,
                curiosity: 90,
                aggressiveness: 40,
                extroversion: 70,
            }
        })
    }

    if (!existingStatus?.status) {
        console.log('Creating initial status history...')
        const personaStatus = await prisma.personaStatus.create({
            data: {
                personaId: persona.id,

                quantityIrreversible: {
                    create: {
                        height: 160.0,
                        boneDensity: 1.0,
                        version: 1,
                    }
                },

                quantityReversible: {
                    create: {
                        value: [
                            { label: "weight", value: 50.0, unit: "kg" },
                            { label: "bloodSugar", value: 90.0, unit: "mg/dL" },
                            { label: "bloodPressureSys", value: 110.0, unit: "mmHg" },
                            { label: "bloodPressureDia", value: 70.0, unit: "mmHg" },
                            { label: "sleepTime", value: 7.5, unit: "h" },
                            { label: "sleepQuality", value: 80.0, unit: null }
                        ],
                        version: 1,
                    }
                },

                semiquantityReversible: {
                    create: {
                        value: [
                            { label: "trust", value: 50, unit: null },
                            { label: "friendliness", value: 50, unit: null },
                            { label: "mood", value: 50, unit: null },
                            { label: "health", value: 100, unit: null }
                        ],
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
