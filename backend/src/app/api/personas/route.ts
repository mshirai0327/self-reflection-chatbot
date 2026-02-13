import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";

/**
 * ペルソナ一覧を取得します
 */
export async function GET() {
    try {
        const personas = await prisma.persona.findMany({
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true }
        });
        return NextResponse.json(personas);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * 新規ペルソナを作成します
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { 
            name, 
            birthDate, 
            gender, 
            intelligence, 
            personality, // { ethics, passion, curiosity, ... }
            vitalData, // { height, weight, ... }
        } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Transaction to ensure all related records are created
        const newPersona = await prisma.$transaction(async (tx) => {
            // 1. Create Persona
            const persona = await tx.persona.create({
                data: { 
                    name: name.trim(),
                    systemPrompt: body.systemPrompt || ""
                }
            });

            // 2. Create Lv1-1: QuantityUnchangeStatus
            await tx.quantityUnchangeStatus.create({
                data: {
                    personaId: persona.id,
                    birthDate: birthDate ? new Date(birthDate) : undefined,
                    gender: gender,
                    intelligence: intelligence ? Number(intelligence) : undefined,
                    // Default values for others if not provided
                    bloodType: 'Unknown',
                    chronotype: 'Unknown',
                    bitternessSense: 50,
                }
            });

            // 3. Create Lv1-2: SemiquantityUnchangeStatus
            await tx.semiquantityUnchangeStatus.create({
                data: {
                    personaId: persona.id,
                    ethics: personality?.ethics ?? 50,
                    passion: personality?.passion ?? 50,
                    curiosity: personality?.curiosity ?? 50,
                    aggressiveness: personality?.aggressiveness ?? 50,
                    extroversion: personality?.extroversion ?? 50,
                }
            });

            // 4. Create Status Hub (PersonaStatus)
            const personaStatus = await tx.personaStatus.create({
                data: {
                    personaId: persona.id,
                }
            });

            // 5. Create Lv2: QuantityIrreversibleStatus (Initial)
            await tx.quantityIrreversibleStatus.create({
                data: {
                    personaStatusId: personaStatus.statusId,
                    version: 1,
                    height: vitalData?.height ? Number(vitalData.height) : 160.0,
                    boneDensity: vitalData?.boneDensity ? Number(vitalData.boneDensity) : 100.0,
                    gripStrength: vitalData?.gripStrength ? Number(vitalData.gripStrength) : 30.0,
                    eyesight: vitalData?.eyesight ? Number(vitalData.eyesight) : 1.0,
                    hearingAbility: vitalData?.hearingAbility ? Number(vitalData.hearingAbility) : 20.0,
                    voicePitch: vitalData?.voicePitch ? Number(vitalData.voicePitch) : 250.0,
                }
            });

            // 6. Create Lv3-1: QuantityReversibleStatus (Initial JSON)
            const initialVitalJson = [
                { label: "weight", value: vitalData?.weight ? Number(vitalData.weight) : 50.0, unit: "kg" },
                { label: "bloodSugar", value: vitalData?.bloodSugar ? Number(vitalData.bloodSugar) : 90.0, unit: "mg/dL" },
                { label: "bloodPressureSys", value: vitalData?.bloodPressureSys ? Number(vitalData.bloodPressureSys) : 110.0, unit: "mmHg" },
                { label: "bloodPressureDia", value: vitalData?.bloodPressureDia ? Number(vitalData.bloodPressureDia) : 70.0, unit: "mmHg" },
                { label: "sleepTime", value: vitalData?.sleepTime ? Number(vitalData.sleepTime) : 7.0, unit: "h" },
                { label: "sleepQuality", value: vitalData?.sleepQuality ? Number(vitalData.sleepQuality) : 70.0, unit: null }
            ];

            await tx.quantityReversibleStatus.create({
                data: {
                    personaStatusId: personaStatus.statusId,
                    version: 1,
                    value: initialVitalJson
                }
            });

            // 7. Create Lv3-2: SemiquantityReversibleStatus (Initial JSON)
            const initialMoodJson = [
                { label: "health", value: 100, unit: null },
                { label: "mood", value: 50, unit: null },
                { label: "trust", value: 50, unit: null },
                { label: "friendliness", value: 50, unit: null }
            ];

            await tx.semiquantityReversibleStatus.create({
                data: {
                    personaStatusId: personaStatus.statusId,
                    version: 1,
                    value: initialMoodJson
                }
            });

            return persona;
        });

        return NextResponse.json(newPersona);
    } catch (error: any) {
        console.error("Failed to create persona:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
