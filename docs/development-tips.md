# 開発・運用 Tips

このドキュメントでは、システムの動作確認やデータの調査に役立つコマンドや手順をまとめています。

---

## スクリプトによる調査

詳細なスクリプト一覧と使用方法は [scripts-guide.md](./scripts-guide.md) を参照してください。

### よく使うコマンド

- **記憶データの確認**: `npx tsx src/scripts/inspect-chroma.ts`
- **モデル一覧の取得**: `npx tsx src/scripts/list-models.ts`
- **レスポンス生成テスト**: `npx tsx src/scripts/test-response.ts`


---

## データベース (PostgreSQL) の調査

Prismaを使用してデータベースの状態を確認する方法です。

### Prisma Studio (GUI)
ブラウザ上でデータを閲覧・編集できます（デフォルトは `localhost:5555`）。

```bash
cd backend
npx prisma studio
```

### 直接クエリ (psql経由)
ターミナルから直接SQLを実行する場合。

```bash
psql -h 127.0.0.1 -p 5432 -U user -d ai_reflection_db
```

---

## バックエンド API の動作確認

### チャットエンドポイントのテスト
直接APIを叩いてレスポンスを確認します。

```bash
curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "こんにちは", "personaId": "test-user"}'
```

## API モデルの確認方法

Google API Keyが必要です。

スクリプトを使用した詳細な確認方法は [scripts-guide.md](./scripts-guide.md#1-gemini-api-関連) を参照してください。

### cURLによる直接確認

```bash
# 全ての情報を取得
curl 'https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY'

# nameだけ取得して一覧表示
curl 'https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY' | grep '"name":'
```