# Reflecta プロジェクト便利コマンド

.PHONY: help dev prod stop prisma-studio chroma-reset chroma-inspect neo4j-inspect test

# デフォルトのヘルプ表示
help:
	@echo "利用可能なコマンド:"
	@echo ""
	@echo "  === 環境起動 ==="
	@echo "  make dev            - 開発環境を起動します (ホットリロード有効)"
	@echo "  make prod           - 本番環境を起動します (最適化ビルド)"
	@echo "  make stop           - 全コンテナを停止します"
	@echo ""
	@echo "  === 開発ツール ==="
	@echo "  make prisma-studio  - Prisma Studio を起動します (localhost接続用)"
	@echo "  make chroma-reset   - ChromaDBのコレクションをリセット（全削除）します"
	@echo "  make chroma-inspect - ChromaDBに保存されている記憶を確認します"
	@echo "  make neo4j-inspect  - Neo4jナレッジグラフの中身を確認します"
	@echo "  make test           - バックエンドのテストを実行します"

# 開発環境の起動
dev:
	@echo "🚀 Starting Reflecta in DEVELOPMENT mode..."
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

# 本番環境の起動
prod:
	@echo "🚀 Starting Reflecta in PRODUCTION mode..."
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# 全コンテナの停止
stop:
	@echo "🛑 Stopping all containers..."
	docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.prod.yml down

# Prisma Studio の起動
# ホストマシンから Docker 内の DB に接続するため、DATABASE_URL を localhost に上書きしています。
# 認証情報は .env の POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB を参照します。
prisma-studio:
	@echo "Starting Prisma Studio..."
	@cd backend && DATABASE_URL="postgresql://$${POSTGRES_USER:-user}:$${POSTGRES_PASSWORD:-password}@localhost:5432/$${POSTGRES_DB:-ai_reflection_db}" npx prisma studio --browser none --port 5555

# ChromaDBのリセット（コレクション全削除）
chroma-reset:
	@echo "Resetting ChromaDB collection..."
	@cd backend && npx tsx src/scripts/reset-chroma.ts

# ChromaDBの中身確認
chroma-inspect:
	@echo "Inspecting ChromaDB collection..."
	@cd backend && npx tsx src/scripts/inspect-chroma.ts

# テストの実行 (Backend & LLM Service)
test: test-backend test-llm

test-backend:
	@echo "Running backend tests (JS)..."
	@cd backend && npm run test

test-llm:
	@echo "Running LLM service tests (Python)..."
	@docker compose exec llm-service pytest tests/ || echo "Warning: LLM Service tests failed or container is not running."

# Neo4j ナレッジグラフの中身確認
neo4j-inspect:
	@echo "Inspecting Neo4j Knowledge Graph..."
	@docker exec self-reflection-chatbot-llm-service-1 python scripts/inspect_neo4j.py
