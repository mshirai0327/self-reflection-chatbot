# Reflecta プロジェクト便利コマンド

.PHONY: studio help

# デフォルトのヘルプ表示
help:
	@echo "利用可能なコマンド:"
	@echo "  make studio    - Prisma Studio を起動します (localhost接続用)"

# Prisma Studio の起動
# ホストマシンから Docker 内の DB に接続するため、DATABASE_URL を localhost に上書きしています。
studio:
	@echo "Starting Prisma Studio..."
	@cd backend && DATABASE_URL="mysql://root:rootpassword@localhost:3306/ai_reflection_db" npx prisma studio --browser none --port 5555
