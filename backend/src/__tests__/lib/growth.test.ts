
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateGrowthDelta } from '../../lib/persona';
import { buildSystemInstruction } from '../../lib/llm';
import { prismaMock } from '../helpers/prisma';

// Mock dependencies if necessary
// In this case, calculateGrowthDelta depends on prisma, which is mocked by prismaMock
// buildSystemInstruction is a pure function (mostly), or depends on other things we can control via input

describe('Growth Logic', () => {
    describe('calculateGrowthDelta', () => {
        it('should return 0 if persona status is not found', async () => {
            prismaMock.personaStatus.findUnique.mockResolvedValue(null);
            const delta = await calculateGrowthDelta('persona-123');
            expect(delta).toBe(0);
        });

        it('should return 0 if there are less than 2 history records', async () => {
             prismaMock.personaStatus.findUnique.mockResolvedValue({ statusId: 'status-123' } as any);
             prismaMock.quantityIrreversibleStatus.findMany.mockResolvedValue([
                 { height: 160.0 }
             ] as any);
             const delta = await calculateGrowthDelta('persona-123');
             expect(delta).toBe(0);
        });

        it('should correctly calculate positive growth', async () => {
            prismaMock.personaStatus.findUnique.mockResolvedValue({ statusId: 'status-123' } as any);
            prismaMock.quantityIrreversibleStatus.findMany.mockResolvedValue([
                { height: 160.5 }, // Latest
                { height: 160.0 }  // Previous
            ] as any);
            const delta = await calculateGrowthDelta('persona-123');
            expect(delta).toBeCloseTo(0.5);
        });

        it('should correctly calculate zero growth', async () => {
            prismaMock.personaStatus.findUnique.mockResolvedValue({ statusId: 'status-123' } as any);
            prismaMock.quantityIrreversibleStatus.findMany.mockResolvedValue([
                { height: 160.0 },
                { height: 160.0 }
            ] as any);
            const delta = await calculateGrowthDelta('persona-123');
            expect(delta).toBe(0);
        });
        
         it('should return 0 if any height record is null/undefined', async () => {
            prismaMock.personaStatus.findUnique.mockResolvedValue({ statusId: 'status-123' } as any);
            prismaMock.quantityIrreversibleStatus.findMany.mockResolvedValue([
                { height: null },
                { height: 160.0 }
            ] as any);
            const delta = await calculateGrowthDelta('persona-123');
            expect(delta).toBe(0);
        });
    });

    describe('buildSystemInstruction with Growth', () => {
        const mockStatus = {
            name: 'Reflecta',
            gender: 'Female',
            birthDate: new Date('2024-01-01'),
            bloodType: 'A',
            chronotype: 'Morning',
            intelligence: 100,
            ethics: 50,
            passion: 50,
            curiosity: 50,
            aggressiveness: 50,
            extroversion: 50,
            height: 160.5,
            weight: 50,
            boneDensity: 1.0,
            sleepTime: 8,
            sleepQuality: 8,
            bloodPressureSys: 120,
            bloodPressureDia: 80,
            bloodSugar: 90,
            health: 100,
            mood: 50,
            trust: 50,
            friendliness: 50
        };

        it('should include growth message when growthDelta is positive', () => {
            const context = {
                status: mockStatus,
                memories: [],
                history: [],
                growthDelta: 0.5
            };
            const instruction = buildSystemInstruction(context);
            expect(instruction).toContain('前回の計測から 0.5cm背が伸びました');
        });

        it('should NOT include growth message when growthDelta is 0', () => {
            const context = {
                status: mockStatus,
                memories: [],
                history: [],
                growthDelta: 0
            };
            const instruction = buildSystemInstruction(context);
            expect(instruction).not.toContain('前回の計測から');
            expect(instruction).not.toContain('背が伸びました');
        });
    });
});
