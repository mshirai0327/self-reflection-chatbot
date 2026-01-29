# 運用・検証用スクリプト (backend/src/scripts)

`backend/src/scripts` 配下にあるスクリプト群は、システムの動作検証やデータの調査を個別に行うためのツールです。これらは `npx tsx` を使用して直接実行できます。

## 実行方法の基本

すべてのスクリプトは `backend/` ディレクトリに移動してから実行してください。

```bash
cd backend
npx tsx src/scripts/[スクリプト名].ts
```

---

## スクリプト一覧

### 1. Gemini API 関連

#### `list-models.ts`
現在使用している API キーで利用可能な Gemini モデルの一覧を REST API (`v1beta`) 経由で取得します。
- **用途**: `frontend/src/components/BotSidebar.tsx` のモデルリストを更新する際の確認に使用します。
- **実行**: `npx tsx src/scripts/list-models.ts`

#### `test-response.ts`
特定のモデルを使用して、実際に AI からのレスポンスが返ってくるかをテストします。
- **用途**: API キーやモデル名の設定が正しいか、Persona コンテキストが正しく渡されているかの確認。
- **実行**: `npx tsx src/scripts/test-response.ts`

#### `test-embedding.ts`
Gemini の埋め込み API (`text-embedding-004` など) が正常に動作するかをテストします。
- **用途**: ベクトル検索（記憶機能）が動作しない場合の、API 特有の不具合の切り分け。
- **実行**: `npx tsx src/scripts/test-embedding.ts`

---

### 2. ChromaDB (ベクトル検索) 関連

#### `inspect-chroma.ts`
ChromaDB に現在保存されている「記憶データ」の件数と内容を確認します。
- **用途**: チャットを通じて AI が記憶を正しく保存しているか、検索が機能しそうかを確認。
- **実行**: `npx tsx src/scripts/inspect-chroma.ts`

#### `reset-chroma.ts`
ChromaDB 内のすべてのコレクションを削除します。
- **用途**: 開発中にベクトルデータのスキーマが変更された場合や、すべての記憶をクリアしたい場合に使用。
- **実行**: `npx tsx src/scripts/reset-chroma.ts`
- **注意**: **実行すると保存された記憶は元に戻せません。**

---

### 3. その他（デバッグ用・補助）

- **`list-models-direct.ts`**: `list-models.ts` と同様ですが、異なる実装やエンドポイントを試すために使用されます。
- **`find-model.ts`**: 特定のモデルがリストに含まれているかを確認するための簡易ツールです。
- **`list-v1beta.ts`**: `v1beta` エンドポイントの内容をそのまま出力してデバッグする際に使用します。

---

## 注意事項

- これらのスクリプトは `.env` ファイルに記述された環境変数（特に `GOOGLE_GENERATIVE_AI_API_KEY`）を使用します。
- スクリプトを追加した場合は、このドキュメントも更新するようにしてください。
