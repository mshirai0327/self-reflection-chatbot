
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/chat/route';
import { NextRequest } from 'next/server';
import { prismaMock } from '../helpers/prisma';

// Mock dependencies
vi.mock('@/lib/chroma', () => ({
    queryMemories: vi.fn(),
    addMemory: vi.fn(),
}));

vi.mock('@/lib/persona', () => ({
    getDefaultPersona: vi.fn(),
    getDefaultUser: vi.fn(),
    getLatestStatus: vi.fn(),
    flattenStatus: vi.fn(),
    calculateGrowthDelta: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({
    generateResponse: vi.fn(),
}));

// Import mocked functions to define return values
import { queryMemories } from '@/lib/chroma';
import { getDefaultPersona, getDefaultUser, getLatestStatus, flattenStatus, calculateGrowthDelta } from '@/lib/persona';
import { generateResponse } from '@/lib/llm';

describe('/api/chat', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should process a chat message successfully', async () => {
        // Setup mocks
        (getDefaultPersona as any).mockResolvedValue({ id: 'persona-123' });
        (getDefaultUser as any).mockResolvedValue({ id: 'user-123' });
        (getLatestStatus as any).mockResolvedValue({}); // simplistic mock
        (calculateGrowthDelta as any).mockResolvedValue(0);
        (flattenStatus as any).mockReturnValue({
            height: 160, weight: 50, health: 100, mood: 50, trust: 50
        });
        (queryMemories as any).mockResolvedValue([]);
        (generateResponse as any).mockResolvedValue({
            content: 'Hello, world!',
            systemInstruction: 'System prompt'
        });

        // Mock prisma responses
        prismaMock.chat.create.mockResolvedValue({ id: 'chat-123', updatedAt: new Date() } as any);
        prismaMock.chatLog.create.mockResolvedValue({} as any);

        // Create request
        const req = new Request('http://localhost/api/chat', {
            method: 'POST',
            body: JSON.stringify({ message: 'Hi' }),
        });

        // Execute
        const response = await POST(req as NextRequest);
        const json = await response.json();

        // Verify
        expect(response.status).toBe(200);
        expect(json.response).toBe('Hello, world!');
        expect(json.chatId).toBe('chat-123');

        // Verify interactions
        expect(prismaMock.chat.create).toHaveBeenCalled();
        expect(prismaMock.chatLog.create).toHaveBeenCalledTimes(2); // User + AI
    });
});
