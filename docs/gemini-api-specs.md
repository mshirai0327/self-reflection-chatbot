# Gemini API 実装仕様ガイド

このアプリにおける Gemini API の使用方法と、モデルごとのパラメータ指定の仕様についてまとめています。

## 基本設定

- **SDK**: `@google/generative-ai`
- **API Version**: `v1beta`
- **共通設定**:
  - `MAX_RETRIES`: 3回
  - `RETRY_DELAY_MS`: 2000ms (指数バックオフ適用)
  - 429 エラー (Rate Limit) 発生時に自動リトライを行います。

## モデルごとの挙動の違い

使用するモデルの種類によって、システム指示（人格設定）の渡し方が自動的に切り替わります。

### 1. Gemini シリーズ (Pro / Flash)
`gemini-` で始まるモデル。

- **人格設定の渡し方**: `systemInstruction` パラメータを使用。
- **特徴**: 会話本文と人格設定が API レベルで分離されているため、指示に忠実な応答が得られやすく、コンテキストウィンドウを効率的に使用できます。
- **JSON リクエスト例 (SDK 内部)**:
  ```json
  {
    "model": "models/gemini-2.5-flash",
    "systemInstruction": {
      "parts": [{ "text": "あなたは自己進化型AI「Reflecta」です。現在のステータス: 身長160cm..." }]
    },
    "contents": [
      {
        "role": "user",
        "parts": [{ "text": "こんにちは" }]
      }
    ]
  }
  ```

### 2. Gemma シリーズ (Open Weights)
`gemma-` で始まるモデル。

- **人格設定の渡し方**: ユーザープロンプトの冒頭に結合（Prompt Injection 形式）。
- **理由**: Gemma 3 を含む現在の API 仕様では、`systemInstruction` パラメータがサポートされていないため。
- **JSON リクエスト例 (SDK 内部)**:
  ```json
  {
    "model": "models/gemma-3-27b-it",
    "contents": [
      {
        "role": "user",
        "parts": [{ 
          "text": "System Instruction:\nあなたは自己進化型AI「Reflecta」です...\n\nUser Message: こんにちは" 
        }]
      }
    ]
  }
  ```

---

## 主要なパラメータ

### generateResponse (チャット生成)

| パラメータ名 | 役割 | 備考 |
| :--- | :--- | :--- |
| `modelName` | モデル ID | `gemini-2.5-flash`, `gemma-3-27b-it` など |
| `prompt` | ユーザーの入力 | フロントエンドから送信された文字列 |
| `context` | ペルソナ情報 | `status` (数値データ) と `memories` (関連記憶) |

### embedText (ベクトル化)

- **使用モデル**: `gemini-embedding-001`
- **用途**: ユーザーの発言をベクトル化し、ChromaDB に保存・検索するために使用します。
- **API Version**: `v1beta`

---

## 制限事項と注意点

1. **APIキーの管理**: `.env` ファイルの `GOOGLE_GENERATIVE_AI_API_KEY` を参照します。
2. **モデルの可用性**: 使用可能なモデルの一覧は、`npx tsx src/scripts/list-models.ts` で確認できます。
3. **Gemma の指示**: プロンプト結合方式をとっているため、非常に長い記憶データが含まれる場合、ユーザーの本来の質問が埋もれる可能性があります。重要な指示はプロンプトの最後にも繰り返すなどの調整が将来的に必要になる場合があります。
