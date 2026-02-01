# Reflecta プロジェクト便利コマンド

.PHONY: studio help

# デフォルトのヘルプ表示
help:
	@echo "利用可能なコマンド:"
	@echo "  make studio         - Prisma Studio を起動します (localhost接続用)"
	@echo "  make chroma-reset   - ChromaDBのコレクションをリセット（全削除）します"
	@echo "  make chroma-inspect - ChromaDBに保存されている記憶を確認します"

# Prisma Studio の起動
# ホストマシンから Docker 内の DB に接続するため、DATABASE_URL を localhost に上書きしています。
studio:
	@echo "Starting Prisma Studio..."
	@cd backend && DATABASE_URL="mysql://root:rootpassword@localhost:3306/ai_reflection_db" npx prisma studio --browser none --port 5555

# ChromaDBのリセット（コレクション全削除）
chroma-reset:
	@echo "Resetting ChromaDB collection..."
	@cd backend && npx tsx src/scripts/reset-chroma.ts

# ChromaDBの中身確認
chroma-inspect:
	@echo "Inspecting ChromaDB collection..."
	@cd backend && npx tsx src/scripts/inspect-chroma.ts
