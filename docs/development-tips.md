# 開発・運用 Tips

このドキュメントでは、システムの動作確認やデータの調査に役立つコマンドや手順をまとめています。

## ChromaDB (ベクトルデータベース) の調査

ChromaDBに保存されている現在の記憶データを確認する方法です。

### 全データの確認
保存されているドキュメント数、内容、メタデータを一覧表示します。

```bash
cd backend
npx tsx src/scripts/inspect-chroma.ts
```

### ヘルスチェック
ChromaDBのサーバーが生きているか確認します。

```bash
curl http://localhost:8000/api/v2/heartbeat
```

---

## データベース (MySQL) の調査

Prismaを使用してデータベースの状態を確認する方法です。

### Prisma Studio (GUI)
ブラウザ上でデータを閲覧・編集できます（デフォルトは `localhost:5555`）。

```bash
cd backend
npx prisma studio
```

### 直接クエリ (MySQL経由)
ターミナルから直接SQLを実行する場合。

```bash
mysql -h 127.0.0.1 -P 3306 -u root -prootpassword ai_reflection_db
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

### 全ての情報を取得

```bash
curl 'https://generativelanguage.googleapis.com/v1beta/models?key=***'
```

### nameだけ取得

```bash
curl 'https://generativelanguage.googleapis.com/v1beta/models?key=***' | grep '"name":' | sed 's/.*"name": "\(.*\)".*/\1/'
```