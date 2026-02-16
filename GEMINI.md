# プロジェクト: Reflecta - 自己内省型AIチャットボット

## 概要

このプロジェクトは、自己進化型のAIチャットボット「Reflecta」を開発するものです。対話を通じてAI自身が「内省」し、自らのステータス（人格・感情・記憶）を更新していくことで、より人間らしい応答の生成を目指します。

バックエンドはNext.js、フロントエンドはReact (Vite)で構成され、Dockerを使用して全体の環境を管理しています。

## 主要技術スタック

- **フロントエンド**: React (Vite), TypeScript, Tailwind CSS, Framer Motion
- **バックエンド**: Next.js, TypeScript, Prisma
- **AI**: Google Gemini API
- **データベース**:
  - **PostgreSQL**: `PersonaStatus`（人格ステータス）や `ChatLog`（会話履歴）などの構造化データを永続化します。PrismaをORMとして使用します。
  - **ChromaDB**: 会話の埋め込みベクトルを保存し、類似性検索によって関連する過去の記憶を文脈に含めるために使用します。
- **インフラ**: Docker, Docker Compose

## 起動と実行

### 前提条件

- Docker および Docker Compose がインストールされていること。
- Google Gemini API キーを取得していること。

### 手順

1.  **APIキーの設定**:
    プロジェクトのルートディレクトリに `.env` ファイルを作成（または `.env.example` をコピー）し、Gemini APIキーを記述します。

    ```env
    GOOGLE_GENERATIVE_AI_API_KEY="ここにあなたのAPIキーを入力"
    ```

2.  **Dockerコンテナの起動**:

    **開発環境の場合:**
    ```bash
    make dev
    # または: docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
    ```

    **本番環境の場合:**
    ```bash
    make prod
    # または: docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
    ```

    **コンテナの停止:**
    ```bash
    make stop
    ```

3.  **アプリケーションへのアクセス**:
    - **フロントエンド**: [http://localhost:5173](http://localhost:5173)
    - **バックエンドAPI**: [http://localhost:3001](http://localhost:3001)

## 開発コマンド

各サービスはDockerコンテナ内で実行されますが、ローカルでの開発やデバッグのために以下のコマンドが利用できます。

### バックエンド (`/backend`)

- **開発サーバー起動**: `npm run dev`
- **ビルド**: `npm run build`
- **本番サーバー起動**: `npm run start`
- **Linter実行**: `npm run lint`
- **DBマイグレーション**: `npx prisma migrate dev`
- **DBシード実行**: `npx prisma db seed` (実行には `tsx` が必要です)

### フロントエンド (`/frontend`)

- **開発サーバー起動**: `npm run dev`
- **ビルド**: `npm run build`
- **ビルドプレビュー**: `npm run preview`
- **Linter実行**: `npm run lint`

## 開発規約

- **コードフォーマット**: PrettierやESLintの規約に従ってください（設定ファイル参照）。
- **型チェック**: TypeScriptを全面的に採用しています。静的型付けの恩恵を最大限に活用してください。anyは可能な限り使わないでください
- **データベーススキーマ**: データベースの変更は、`/backend/prisma/schema.prisma` ファイルを編集し、`npx prisma migrate dev` コマンドでマイグレーションファイルを生成してください。
- **コメント**: コードに処理に関するコメントをJSDoc形式で、日本語で記載してください。

## コミットルール

共同作業であることを明示するため、AIエージェントがコミットするときは、コミットメッセージの末尾に次の`Co-authored-byトレーラー`を加えてどのAIエージェントが作業したか分かるようにしてください。
空行を挟んでください。
```
feat: commit message

Co-Authored-By: gemini <218195315+gemini-cli@users.noreply.github.com>
```

geminiの場合は以下でお願いします

- Co-Authored-By: gemini <218195315+gemini-cli@users.noreply.github.com>


## コマンド操作について

現在は開発環境しかないので、トータルでのプラスととらえてそのディレクトリ以下でのコマンド操作は原則許可しています
ただし、ghコマンドは例外です。githubをタスク管理に使っているので、ghコマンドを実行すると予期しないタスク遷移がされます
ghコマンドを使う場合は必ずユーザの許可を得てください

## タスク管理について

issueを使って管理をしています。`gh issue list`で確認できます。

## TaskとPlan, Walkthroughについて

Taskを提示するときは日本語で記述してください
Implementation Planを提示するときは、日本語で記述してください
Walkthroughを提示するときは、日本語で記述してください

## コメントについて

コードに書かれているコメントは原則消さないでください。特にtodoやNoteは消さないでください、解消した場合はユーザに報告してください

## TODO

いくつか気になる箇所があります
- すでにあるペルソナがわからない
- 画面のNew Personaのところをプルダウンにして、既存のペルソナをリストにして、末尾に新規作成とかしたい
- chat historyで＋ボタンで追加するときに、ペルソナを選択できるようにしたい
- システムプロンプトに、ペルソナの名前が入っていない。「あなたは自己進化型AI「Reflecta」です。と固定になっている


追加
- 生年月日選択カレンダーが使いにくいので、フリーテキストやプルダウンなどにしたい
