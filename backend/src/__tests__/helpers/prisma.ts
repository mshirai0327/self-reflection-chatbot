
import { prisma } from '@/lib/prisma'
import { DeepMockProxy } from 'vitest-mock-extended'
import { PrismaClient } from '@prisma/client'

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
