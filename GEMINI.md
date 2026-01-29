# プロジェクト: Reflecta - 自己内省型AIチャットボット

## 概要

このプロジェクトは、自己進化型のAIチャットボット「Reflecta」を開発するものです。対話を通じてAI自身が「内省」し、自らのステータス（人格・感情・記憶）を更新していくことで、より人間らしい応答の生成を目指します。

バックエンドはNext.js、フロントエンドはReact (Vite)で構成され、Dockerを使用して全体の環境を管理しています。

## 主要技術スタック

-   **フロントエンド**: React (Vite), TypeScript, Tailwind CSS, Framer Motion
-   **バックエンド**: Next.js, TypeScript, Prisma
-   **AI**: Google Gemini API
-   **データベース**:
    -   **MySQL**: `PersonaStatus`（人格ステータス）や `ChatLog`（会話履歴）などの構造化データを永続化します。PrismaをORMとして使用します。
    -   **ChromaDB**: 会話の埋め込みベクトルを保存し、類似性検索によって関連する過去の記憶を文脈に含めるために使用します。
-   **インフラ**: Docker, Docker Compose

## 起動と実行

### 前提条件

-   Docker および Docker Compose がインストールされていること。
-   Google Gemini API キーを取得していること。

### 手順

1.  **APIキーの設定**:
    プロジェクトのルートディレクトリに `.env` ファイルを作成（または `.env.example` をコピー）し、Gemini APIキーを記述します。

    ```env
    GOOGLE_GENERATIVE_AI_API_KEY="ここにあなたのAPIキーを入力"
    ```

2.  **Dockerコンテナの起動**:
    以下のコマンドを実行して、すべてのサービス（フロントエンド、バックエンド、データベース）を起動します。初回起動時はイメージのビルドに時間がかかります。

    ```bash
    docker-compose up --build
    ```

3.  **アプリケーションへのアクセス**:
    -   **フロントエンド**: [http://localhost:5173](http://localhost:5173)
    -   **バックエンドAPI**: [http://localhost:3001](http://localhost:3001)

## 開発コマンド

各サービスはDockerコンテナ内で実行されますが、ローカルでの開発やデバッグのために以下のコマンドが利用できます。

### バックエンド (`/backend`)

-   **開発サーバー起動**: `npm run dev`
-   **ビルド**: `npm run build`
-   **本番サーバー起動**: `npm run start`
-   **Linter実行**: `npm run lint`
-   **DBマイグレーション**: `npx prisma migrate dev`
-   **DBシード実行**: `npx prisma db seed` (実行には `tsx` が必要です)

### フロントエンド (`/frontend`)

-   **開発サーバー起動**: `npm run dev`
-   **ビルド**: `npm run build`
-   **ビルドプレビュー**: `npm run preview`
-   **Linter実行**: `npm run lint`

## 開発規約

-   **コードフォーマット**: PrettierやESLintの規約に従ってください（設定ファイル参照）。
-   **型チェック**: TypeScriptを全面的に採用しています。静的型付けの恩恵を最大限に活用してください。
-   **データベーススキーマ**: データベースの変更は、`/backend/prisma/schema.prisma` ファイルを編集し、`npx prisma migrate dev` コマンドでマイグレーションファイルを生成してください。
-   **コミットメッセージ**: Conventional Commits の形式を推奨します (例: `feat: 新しいチャット機能を追加`)。

## TODO

ここには直近でやるべきTODOを記載します。

- [ ] 
