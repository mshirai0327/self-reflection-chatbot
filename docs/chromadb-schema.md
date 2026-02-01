# ChromaDB データスキーマと操作リファレンス

本プロジェクトでは、AI の長期記憶と文脈理解のために ChromaDB を使用しています。「ユーザーの発言」と「内省による重要な気づき」の 2 種類をベクトル化して保存し、会話の文脈に応じて類似検索を行っています。

> Note: 長期記憶として使ってはいますが、削除する処理が現状ないため、RDBとに保存される不変データに近いものになっています。また、類似度によるフィルタリングなどもしていないため、検索精度が悪いです 

## 1. コレクション設定

- **コレクション名**: `persona_memories`
  - 環境変数 `CHROMA_COLLECTION_NAME` で変更可能。
  - 定義ファイル: `backend/src/lib/chroma.ts`
- **Embedding モデル**: `text-embedding-004` (Gemini API)
  - 定義ファイル: `backend/src/lib/llm.ts`, `backend/src/lib/chroma.ts`

## 2. データ登録 (Data Ingestion)

データを登録する際は `collection.add()` を使用します。データの種類に応じてメタデータの構造が異なります。

### A. ユーザーメッセージ (短期記憶/文脈)

ユーザーからのチャットメッセージを保存する場合の形式です。

**JSON 構造例:**

```json
{
  "ids": ["01HMKS85G820..."],
  "documents": ["最近仕事でミスが続いて落ち込んでいるんだ..."],
  "metadatas": [
    {
      "role": "user",
      "personaId": "cm1xxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "chatId": "cm1yyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
    }
  ]
}
```

| フィールド | 説明 |
| :--- | :--- |
| `ids` | ULID (ソート可能な26文字の一意なID) |
| `documents` | ユーザーの発言テキスト |
| `metadatas.role` | 常に `"user"` |
| `metadatas.personaId` | ペルソナの UUID |
| `metadatas.chatId` | チャットセッションの UUID |

- **実装箇所**: `backend/src/app/api/chat/route.ts`

### B. 内省による恒久記憶 (Permanent Memory)

内省プロセス (`/api/reflect`) で生成された重要な教訓を保存する場合の形式です。

**JSON 構造例:**

```json
{
  "ids": ["01HMKS90X240..."],
  "documents": ["ユーザーが落ち込んでいる時は、解決策よりも先に共感を示すことが信頼関係構築に重要だ。"],
  "metadatas": [
    {
      "type": "reflection",
      "thought": "ユーザーへの初期応答が冷たく感じられたが、共感的な言葉をかけた後に反応が良化したため。",
      "personaId": "cm1xxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  ]
}
```

| フィールド | 説明 |
| :--- | :--- |
| `ids` | ULID |
| `documents` | 内省によって得られた教訓・記憶 |
| `metadatas.type` | `"reflection"` (内省データであることを識別) |
| `metadatas.thought` | 教訓に至るまでの思考プロセス |
| `metadatas.personaId` | ペルソナの UUID |

- **実装箇所**: `backend/src/app/api/reflect/route.ts`

## 3. データ検索 (Data Querying)

ユーザーの発言をクエリテキストとして、関連する記憶を検索します。

**クエリ例**: `"また失敗しちゃったよ..."`

### アプリケーション内での利用形式 (整形後)

`backend/src/lib/chroma.ts` の `queryMemories` 関数は、ChromaDB のレスポンスを以下の形式に整形して返します。

```json
[
  {
    "content": "ユーザーが落ち込んでいる時は、解決策よりも先に共感を示すことが信頼関係構築に重要だ。",
    "distance": 0.3524
  },
  {
    "content": "最近仕事でミスが続いて落ち込んでいるんだ...",
    "distance": 0.4102
  }
]
```

- **content**: ドキュメントの内容 (`documents`)
- **distance**: クエリとの距離 (値が小さいほど類似度が高い)
  - 0.0 は完全一致
  - 一般的に 0.3 - 0.5 程度が関連性の高い範囲

### ChromaDB からの生レスポンス (参考)

`collection.query()` から返却される生の JSON 構造です。

```json
{
  "ids": [["ref_1706755200000", "1706755200000"]],
  "distances": [[0.3524, 0.4102]],
  "metadatas": [[
    {
      "type": "reflection",
      "thought": "...",
      "personaId": "..."
    },
    {
      "role": "user",
      "personaId": "...",
      "chatId": "..."
    }
  ]],
  "documents": [[
    "ユーザーが落ち込んでいる時は、解決策よりも先に共感を示すことが信頼関係構築に重要だ。",
    "最近仕事でミスが続いて落ち込んでいるんだ..."
  ]],
  "embeddings": null,
  "uris": null,
  "data": null
}
```

## 4. デバッグ・検査用スクリプト

ChromaDB の内容を直接確認するためのユーティリティスクリプトが用意されています。

### `backend/src/scripts/inspect-chroma.ts`

ChromaDB に接続し、保存されているコレクションの一覧、アイテム数、およびサンプルデータを表示します。

**実行方法:**

```bash
cd backend
npx tsx src/scripts/inspect-chroma.ts
```

**機能概要:**

1.  **接続確認**: ローカルまたは Docker コンテナ上の ChromaDB に接続を試みます。
2.  **コレクション統計**: 存在するコレクション名と、保存されているデータ総数 (`Items`) を表示します。
3.  **データサンプリング**: データが存在する場合、設定された件数（`SAMPLE_LIMIT`、デフォルトはコード内で定義）のレコードを取得し、以下を表示します。
  - ドキュメント内容 (`documents`)
  - メタデータ (`metadatas`)
  - Embedding ベクトルの次元数

**出力例:**

```text
Connecting to ChromaDB at: http://localhost:8000
Collections found: 1
- Collection: persona_memories, Items: 15
  Embedding dimension: 768
  Sample records:
    [0] 最近仕事でミスが続いて落ち込んでいるんだ...
        Metadata: {"chatId":"...","personaId":"...","role":"user"}
    ...
```
