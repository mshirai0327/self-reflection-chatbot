# DEVモード実装 / 開発・本番環境分離 実装計画

## Phase 1: 環境変数 + docker-compose 分離

### 1-1. 環境変数ファイルの整理
- `.env.development` - 開発用（CORS全許可、Local LLM利用可、デバッグ用設定）
- `.env.production` - 本番用（CORS制限、Local LLM利用不可、セキュリティ設定）
- `.env.example` の更新

### 1-2. docker-compose 分離
- `docker-compose.yml` → 共通ベース設定
- `docker-compose.dev.yml` → 開発用オーバーライド（ソースマウント、dev server、CORS全許可）
- `docker-compose.prod.yml` → 本番用オーバーライド（ビルド済みイメージ、最適化）

### 1-3. Makefile 更新
- `make dev` / `make prod` コマンドの追加

## Phase 2: CORS + SSRF対策

### 2-1. Next.js CORSミドルウェア
- `middleware.ts` をバックエンドに追加
- `ALLOWED_ORIGINS` 環境変数で許可オリジンを制御

### 2-2. SSRF対策 — 本番でLocal LLM無効化
- バックエンド: `llm.ts` で `NODE_ENV=production` 時に `local` プロバイダーを拒否
- バックエンド: `/api/llm/models` と `/api/llm/test` を本番で無効化
- フロントエンド: 本番環境では Local LLM の UI を非表示にする

### 2-3. ChromaDB CORS 制限
- `docker-compose.prod.yml` で CORS のオリジンを制限
