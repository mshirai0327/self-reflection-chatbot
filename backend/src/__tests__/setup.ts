
import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import { vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => {
    const mock = mockDeep<PrismaClient>()
    return {
        __esModule: true,
        prisma: mock,
    }
})

import { prisma } from '@/lib/prisma'

beforeEach(() => {
    mockReset(prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>)
})
