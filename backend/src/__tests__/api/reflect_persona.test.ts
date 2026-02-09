
import { POST } from '@/app/api/reflect/route';
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../helpers/prisma';
import { getDefaultPersona, getLatestStatus, flattenStatus } from '@/lib/persona';
import { generateJson } from '@/lib/llm';

// Mock dependencies
vi.mock('@/lib/llm', () => ({
    generateJson: vi.fn().mockResolvedValue({
        thought: 'Thinking...',
        statusUpdate: { health: 0, mood: 5, trust: 2, friendliness: 1 },
        permanentMemory: 'Lesson learned',
        newMemories: ['User likes cats']
    }),
    LLMConfig: {},
    createEmbeddingModel: vi.fn(),
    embedTexts: vi.fn().mockResolvedValue([[0.1, 0.2]])
}));

vi.mock('@/lib/chroma', () => ({
    addMemory: vi.fn()
}));

vi.mock('@/lib/persona', () => ({
    getDefaultPersona: vi.fn(),
    getLatestStatus: vi.fn(),
    flattenStatus: vi.fn(),
}));

describe('/api/reflect reproduction', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should reflect on the correct persona based on chatId', async () => {
        const chatId = 'chat-123';
        const targetPersonaId = 'target-persona-id';
        const defaultPersonaId = 'default-persona-id';

        // Setup Mocks
        // 1. Mock Default Persona (Should NOT be used or at least not strictly required if everything is via chatId)
        (getDefaultPersona as any).mockResolvedValue({ id: defaultPersonaId });

        // 2. Mock Chat retrieval
        prismaMock.chat.findUnique.mockResolvedValue({ 
            id: chatId, 
            personaId: targetPersonaId,
            title: 'Test Chat' 
        } as any);

        // 3. Mock Chat Logs
        prismaMock.chatLog.findMany.mockImplementation(async (args: any) => {
            // Should be called with targetPersonaId
            if (args.where.personaId === targetPersonaId) {
                return [{ role: 'user', content: 'test logs for reflection' }];
            }
            return [];
        });

        // 4. Mock Status methods
        (getLatestStatus as any).mockImplementation(async (id: string) => {
            if (id === targetPersonaId) {
                return { 
                    statusId: 'status-123',
                    // Add nested objects to avoid undefined errors if code accesses them
                    quantityIrreversible: { boneDensity: 1.0, version: 1 },
                    quantityReversible: { version: 1, value: [] },
                    semiquantityReversible: { version: 1, value: [] }
                };
            }
            return null;
        });
        (flattenStatus as any).mockReturnValue({ 
            health: 100,
            mood: 50,
            trust: 50,
            friendliness: 50,
            height: 160,
            weight: 50
        });

        // Mock Transaction
        prismaMock.$transaction.mockResolvedValue([{}, {}, {}] as any);
        prismaMock.reflectionEvent.create.mockResolvedValue({} as any);

        // Mock LLM
        (generateJson as any).mockResolvedValue({
            thought: 'Thinking...',
            statusUpdate: { health: 0, mood: 5, trust: 2, friendliness: 1 },
            permanentMemory: 'Lesson learned',
            newMemories: ['User likes cats']
        });

        // Execute
        const req = new NextRequest('http://localhost/api/reflect', {
            method: 'POST',
            body: JSON.stringify({ chatId })
        });

        const res = await POST(req);
        const data = await res.json();

        if (res.status !== 200) {
            console.error('Test Failed with Status:', res.status);
            console.error('Error Response:', JSON.stringify(data, null, 2));
        }

        // Verification
        expect(res.status).toBe(200);
        expect(data).toHaveProperty('reflection');
        
        // Verify that chat was looked up
        expect(prismaMock.chat.findUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: chatId }
        }));

        // Verify that logs were fetched for TARGET persona
        expect(prismaMock.chatLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                personaId: targetPersonaId,
                chatId: chatId
            })
        }));
        
        // Verify that Default Persona was NOT used for critical steps (optional, but good to check)
        expect(getLatestStatus).toHaveBeenCalledWith(targetPersonaId);
    });
});

