import { PrismaClient } from '@prisma/client';
import { describe, it, expect } from 'vitest';

// 実際のDB接続を使用するPrisma Client
// テスト実行環境（ホスト側）からDB（Dockerコンテナ）に接続できる必要がある
const prisma = new PrismaClient({
    datasources: {
        db: {
            // CI環境（GitHub Actions等）では設定されたDATABASE_URLを使用
            // ローカル環境（CI=false/undefined）では、.envが"db:5432"となっていてもホスト側から接続できるようにlocalhostを強制
            url: process.env.CI ? process.env.DATABASE_URL : "postgresql://user:password@localhost:5432/ai_reflection_db"
        }
    }
});

/**
 * DBスキーマとPrisma Clientの整合性を確認するための統合テスト
 * 実際のDBに対してクエリを実行し、カラムが存在するか確認する
 */
describe('Database Schema Integration (Real DB Connection)', () => {
    
    it('should have systemPrompt column in Persona table', async () => {
        try {
            // 実際にクエリを発行して、カラムが存在することを確認
            // データがなくても、SELECTクエリ自体は成功するはず
            // カラムがない場合は、PrismaClientKnownRequestErrorが発生する
            await prisma.persona.findFirst({
                select: {
                    id: true,
                    name: true,
                    // systemPromptが存在しないと型エラーまたはランタイムエラーになる
                    systemPrompt: true 
                }
            });
            expect(true).toBe(true);
        } catch (error) {
            console.error("Schema Mismatch Detected:", error);
            throw error;
        }
    });

    it('should be able to query ChatLog with relation to Persona', async () => {
        try {
            // リレーションクエリのテスト
            await prisma.chatLog.findFirst({
                include: {
                    persona: true
                }
            });
            expect(true).toBe(true);
        } catch (error) {
            console.error("Relation Mismatch Detected:", error);
            throw error;
        }
    });

    it('should disconnect after tests', async () => {
        await prisma.$disconnect();
    });
});
