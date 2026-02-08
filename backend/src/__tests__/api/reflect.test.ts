
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/reflect/route';
import { NextRequest } from 'next/server';
import { prismaMock } from '../helpers/prisma';

// Mock dependencies
vi.mock('@/lib/chroma', () => ({
    addMemory: vi.fn(),
}));

vi.mock('@/lib/persona', () => ({
    getDefaultPersona: vi.fn(),
    getLatestStatus: vi.fn(),
    flattenStatus: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({
    generateJson: vi.fn(),
}));

import { addMemory } from '@/lib/chroma';
import { getDefaultPersona, getLatestStatus, flattenStatus } from '@/lib/persona';
import { generateJson } from '@/lib/llm';

describe('/api/reflect', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should process reflection successfully', async () => {
        // Setup mocks
        (getDefaultPersona as any).mockResolvedValue({ id: 'persona-123' });
        (getLatestStatus as any).mockResolvedValue({ statusId: 'status-123' });
        (flattenStatus as any).mockReturnValue({
            height: 160, weight: 50, health: 100, mood: 50, trust: 50
        });

        // Mock Prisma findMany for logs
        prismaMock.chatLog.findMany.mockResolvedValue([
            { role: 'user', content: 'Hello', createdAt: new Date() },
            { role: 'assistant', content: 'Hi', createdAt: new Date() }
        ] as any);

        // Mock LLM response
        (generateJson as any).mockResolvedValue({
            thought: 'Thinking...',
            statusUpdate: { health: 0, mood: 5, trust: 2, friendliness: 1 },
            permanentMemory: 'Lesson learned',
            newMemories: ['User likes cats'],
        });

        // Mock Transaction
        prismaMock.$transaction.mockResolvedValue([]);
        prismaMock.reflectionEvent.create.mockResolvedValue({} as any);

        // Create request
        const req = new Request('http://localhost/api/reflect', {
            method: 'POST',
            body: JSON.stringify({ chatId: 'chat-123' }),
        });

        // Execute
        const response = await POST(req as NextRequest);
        const json = await response.json();

        // Verify
        expect(response.status).toBe(200);
        expect(json.reflection).toBeDefined();

        // Verify DB updates
        expect(prismaMock.$transaction).toHaveBeenCalled();
        expect(prismaMock.reflectionEvent.create).toHaveBeenCalled();

        // Verify Memory updates
        expect(addMemory).toHaveBeenCalledTimes(2); // Permanent + New Memory
    });

    it('should require chatId', async () => {
        const req = new Request('http://localhost/api/reflect', {
            method: 'POST',
            body: JSON.stringify({}), // No chatId
        });

        const response = await POST(req as NextRequest);
        expect(response.status).toBe(400);
    });
});
