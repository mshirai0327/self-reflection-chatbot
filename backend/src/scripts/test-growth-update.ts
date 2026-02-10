
import { prisma } from "../lib/prisma";
import { getDefaultPersona, getLatestStatus, flattenStatus } from "../lib/persona";

// Mocking reflection result for testing
const mockReflection = {
    thought: "Test thought",
    statusUpdate: {
        health: 0,
        mood: 0,
        trust: 0,
        friendliness: 0,
        heightIncrease: 0.3 // Increasing height by 0.3cm
    },
    permanentMemory: "Test memory",
    newMemories: [],
    growthFeedback: true
};

async function main() {
    console.log("Starting Height Update Logic Verification...");

    const persona = await getDefaultPersona();
    console.log(`Persona ID: ${persona.id}`);

    // Get current status
    let fullStatus = await getLatestStatus(persona.id);
    if (!fullStatus) {
        console.error("No status found.");
        return;
    }

    const currentHeight = fullStatus.quantityIrreversible?.height || 160.0;
    console.log(`Current Height: ${currentHeight} cm`);

    // Simulate Height Update Logic (extracted from route.ts)
    const heightIncrease = mockReflection.statusUpdate.heightIncrease ?? 0;
    const newHeight = parseFloat((currentHeight + heightIncrease).toFixed(1));

    console.log(`Simulated Height Increase: +${heightIncrease} cm`);
    console.log(`Expected New Height: ${newHeight} cm`);

    // Perform DB Update
    const irreversibleData = {
        personaStatusId: fullStatus.statusId,
        height: newHeight,
        boneDensity: fullStatus.quantityIrreversible?.boneDensity ?? 1.0,
        version: (fullStatus.quantityIrreversible?.version || 0) + 1,
    };

    console.log("Updating DB with new height record...");
    await prisma.quantityIrreversibleStatus.create({ data: irreversibleData });

    // Verify
    const updatedStatus = await getLatestStatus(persona.id);
    const updatedHeight = updatedStatus?.quantityIrreversible?.height;
    
    console.log(`Updated Height from DB: ${updatedHeight} cm`);

    if (updatedHeight === newHeight) {
        console.log("✅ Height update verification passed!");
    } else {
        console.error(`❌ Height update verification failed! Expected ${newHeight}, got ${updatedHeight}`);
    }

    console.log("Verification finished.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
