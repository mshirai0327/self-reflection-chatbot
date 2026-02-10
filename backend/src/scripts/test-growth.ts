
import { prisma } from "../lib/prisma";
import { getDefaultPersona, calculateGrowthDelta, getLatestStatus, flattenStatus } from "../lib/persona";
import { buildSystemInstruction } from "../lib/llm";

async function main() {
    console.log("Starting Growth System Verification...");

    const persona = await getDefaultPersona();
    console.log(`Persona ID: ${persona.id}`);

    // Get current status ID
    let statusInfo = await getLatestStatus(persona.id);
    
    if (!statusInfo) {
        console.log("No status found. Creating initial status...");
        const newStatus = await prisma.personaStatus.create({
            data: {
                personaId: persona.id,
                // Create minimal required history for the code to work
                quantityIrreversible: {
                    create: { height: 160.0 }
                }
            }
        });
        statusInfo = await getLatestStatus(persona.id);
    }

    if (!statusInfo) {
         console.error("Failed to create/fetch status.");
         return;
    }

    const statusId = statusInfo.statusId; // flattenStatus returns 'id' as statusId    
    console.log(`Status ID: ${statusId}`);

    // Clean up existing height records for testing
    // await prisma.quantityIrreversibleStatus.deleteMany({ where: { personaStatusId: statusId } });

    // Insert past record (Version N-1)
    console.log("Inserting past record (207.5cm)...");
    await prisma.quantityIrreversibleStatus.create({
        data: {
            personaStatusId: statusId,
            height: 207.5,
            version: 900, // High version to distinguish test data
            recordedAt: new Date(Date.now() + 10000) // 10 seconds later
        }
    });

    // Insert current record (Version N)
    console.log("Inserting current record (208.0cm)...");
    await prisma.quantityIrreversibleStatus.create({
        data: {
            personaStatusId: statusId,
            height: 208.0,
            version: 901,
            recordedAt: new Date(Date.now() + 20000) // 20 seconds later
        }
    });

    // 1. Verify calculateGrowthDelta
    const delta = await calculateGrowthDelta(persona.id);
    console.log(`Calculated Delta: ${delta} cm`);

    if (Math.abs(delta - 0.5) < 0.001) {
        console.log("✅ calculateGrowthDelta passed!");
    } else {
        console.error(`❌ calculateGrowthDelta failed! Expected 0.5, got ${delta}`);
    }

    // 2. Verify System Prompt
    const latestStatus = flattenStatus(await getLatestStatus(persona.id));
    const context = {
        status: latestStatus!,
        memories: ["Memory 1", "Memory 2"],
        growthDelta: delta
    };

    const prompt = buildSystemInstruction(context);
    console.log("--- Generated System Prompt Partial ---");
    // Extract relevant parts
    if (prompt.includes("前回の計測から 0.5cm背が伸びました")) {
        console.log("✅ Growth message found in prompt!");
    } else {
        console.error("❌ Growth message NOT found in prompt!");
        console.log(prompt);
    }

    if (prompt.includes("ドアの高さは200cm")) {
        console.log("✅ Physical constraint message found in prompt!");
    } else {
        console.error("❌ Physical constraint message NOT found in prompt!");
    }

    console.log("Verification finished.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
