# Neo4j ナレッジグラフ仕様

## 概要

Reflecta は会話を通じて知識を自動的に蓄積するナレッジグラフ（Knowledge Graph）を持っています。
グラフデータベースとして **Neo4j** を使用し、会話から抽出した因果関係・事実関係をトリプル形式で保存します。
チャット応答時に **GraphRAG**（Graph Retrieval-Augmented Generation）として活用され、より文脈に即した応答を生成します。

---

## データが保存されるタイミング

**ユーザーがチャットメッセージを送信したとき**に、バックグラウンドで自動的に知識が抽出・保存されます。

```
ユーザーがメッセージを送信
    │
    ▼
/api/chat (backend) → /chat (llm-service)
    │
    ├─→ チャット応答を生成してフロントエンドに返す（メイン処理）
    │
    └─→ バックグラウンドタスクを起動（非同期・ノンブロッキング）
            │
            ▼
        run_extraction(message)
            │
            ▼
        LLM が因果関係トリプルを抽出
            │
            ▼
        graph_service.add_triples(result.triples)
            │
            ▼
        Neo4j に保存
```

### 重要な仕様

| 項目 | 仕様 |
|---|---|
| **対象** | ユーザーのメッセージのみ（AI の返答は対象外） |
| **タイミング** | チャット応答を返した後、バックグラウンドで実行 |
| **失敗時の挙動** | エラーをログ出力して無視（チャット応答には影響しない） |
| **トリプルが0件の場合** | 保存しない |
| **言語** | 英語（抽出プロンプトが英語のため） |

---

## データ構造

### ノード（Node）

```
(Concept {name: "...", embedding: [...]})
```

| プロパティ | 型 | 説明 |
|---|---|---|
| `name` | string | コンセプト名（例: `"Lack of sleep"`） |
| `embedding` | float[] | ベクトル埋め込み（類似検索用） |

ラベルは `Concept` 固定。

### リレーション（Relationship）

```
(Concept)-[CAUSES {weight, is_personal, updated_at}]->(Concept)
```

| プロパティ | 型 | 説明 |
|---|---|---|
| `weight` | float | 関係の確信度（0.0〜1.0） |
| `is_personal` | bool | `true` = 個人的な事実 / `false` = 一般的な事実 |
| `updated_at` | string | 最終更新日時（ISO 8601形式） |

リレーション種別（述語）は LLM が動的に決定します。代表的なもの：

| 種別 | 意味 |
|---|---|
| `CAUSES` | 原因・結果の関係 |
| `RELATED_TO` | 関連している |
| `HAS_PART` | 部分・全体の関係 |
| その他 | LLM が適切と判断した任意の述語 |

### 制約・インデックス

```cypher
CREATE CONSTRAINT IF NOT EXISTS FOR (c:Concept) REQUIRE c.name IS UNIQUE
```

`Concept.name` はユニーク制約あり。同じコンセプトが複数回登場した場合は `MERGE` で更新されます。

---

## 知識抽出の仕組み

### 抽出モデル

`llm-service/chains/extraction.py` で定義されたプロンプトを使い、LLM が構造化出力（JSON）でトリプルを生成します。

**抽出プロンプト（要約）：**
```
You are a knowledge extractor for a self-reflection AI.
Extract causal relationships and facts from the user's conversation.

Focus on:
1. Physical/Biological causes (e.g., "Lack of sleep" causes "Poor concentration")
   → is_personal=False (一般的な事実)
2. Personal habits/Learned patterns (e.g., "Working late" causes "Overeating")
   → is_personal=True (個人的な事実)
```

### 抽出例

| ユーザー発言 | subject | predicate | object | is_personal |
|---|---|---|---|---|
| 「最近睡眠不足で集中できない」 | `Lack of sleep` | `CAUSES` | `Poor concentration` | false |
| 「夜遅くまで働くと食べ過ぎる」 | `Working late` | `CAUSES` | `Overeating` | true |
| 「運動すると気分が良くなる」 | `Exercise` | `CAUSES` | `Improved mood` | false |

### 抽出モデルの設定

`llm-service/.env` で設定可能：

```env
EXTRACTION_LLM_PROVIDER="gemini"       # gemini / openai / local
EXTRACTION_LLM_MODEL="gemini-2.5-pro"  # 使用するモデル名
# EXTRACTION_LLM_ENDPOINT="http://host.docker.internal:1234/v1"  # Local LLM の場合
```

---

## GraphRAG（グラフ検索拡張生成）

チャット応答を生成する際、ユーザーのメッセージに関連する知識をグラフから検索し、システムプロンプトに追加します。

### 検索フロー

```
ユーザーメッセージ
    │
    ▼
1. ベクトル類似検索（Neo4jVector）
   → メッセージに意味的に近い Concept ノードを最大3件取得
    │
    ▼
2. グラフトラバーサル（1ホップ）
   → 取得した Concept から隣接するノードとリレーションを最大5件取得
    │
    ▼
3. コンテキスト文字列を生成
   → システムプロンプトの「関連する知識・因果関係」セクションに追加
```

### システムプロンプトへの組み込み例

```
### 関連する知識・因果関係 (Knowledge Graph)
- 個人的な事実: Working late は Overeating と CAUSES という関係です (確信度: 0.9)
- 一般的な事実: Lack of sleep は Poor concentration と CAUSES という関係です (確信度: 1.0)
```

### 検索が失敗した場合

ベクトルインデックスが未作成（データが0件）の場合など、エラーが発生しても無視されます。
グラフコンテキストなしでチャット応答が生成されます。

---

## 環境変数

| 変数名 | デフォルト | 説明 |
|---|---|---|
| `NEO4J_URI` | `bolt://neo4j:7687` | Neo4j 接続 URI |
| `NEO4J_USER` | `neo4j` | Neo4j ユーザー名 |
| `NEO4J_PASSWORD` | `password` | Neo4j パスワード |
| `GOOGLE_API_KEY` | - | Gemini API キー（埋め込み生成用） |
| `GOOGLE_EMBEDDING_MODEL` | `gemini-embedding-001` | 埋め込みモデル名 |
| `EXTRACTION_LLM_PROVIDER` | `gemini` | 抽出モデルのプロバイダー |
| `EXTRACTION_LLM_MODEL` | `gemini-2.5-pro` | 抽出モデル名 |
| `EXTRACTION_LLM_ENDPOINT` | - | Local LLM エンドポイント（任意） |

---

## 開発ツール

### グラフの中身を確認する

```bash
make neo4j-inspect
```

出力例：
```
Connecting to Neo4j at: bolt://neo4j:7687
Connected!

=== ノード数: 5 ===
  [Concept]: 5 件

=== リレーション数: 3 ===
  [CAUSES]: 3 件

=== サンプルトリプル（最大 20 件）===
  [00] Lack of sleep  --[CAUSES]-->  Poor concentration
  [01] Working late  --[CAUSES]-->  Overeating
  [02] Exercise  --[CAUSES]-->  Improved mood
```

### グラフ全体を API で取得する

```bash
curl http://localhost:8080/graph
```

レスポンス例：
```json
{
  "nodes": [
    {"id": "Lack of sleep", "group": "Concept"},
    {"id": "Poor concentration", "group": "Concept"}
  ],
  "links": [
    {
      "source": "Lack of sleep",
      "target": "Poor concentration",
      "label": "CAUSES",
      "weight": 1.0,
      "is_personal": false
    }
  ]
}
```

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `llm-service/chains/extraction.py` | 知識抽出プロンプトと `KnowledgeTriple` モデルの定義 |
| `llm-service/graph/service.py` | Neo4j への保存・検索ロジック（`GraphService`） |
| `llm-service/main.py` | バックグラウンドタスクの起動（`run_extraction`） |
| `llm-service/scripts/inspect_neo4j.py` | デバッグ用検査スクリプト |
| `llm-service/.env` | 環境変数設定 |

---

## グラフ描画 (Visualization)

フロントエンド (`frontend/src/components/GraphViewer.tsx`) では、Neo4j に蓄積された知識グラフを可視化しています。

### 使用ライブラリ

*   **[react-force-graph-2d](https://github.com/vasturiano/react-force-graph)**: HTML5 Canvas を使用した Force-Directed Graph の描画ライブラリ。
    *   物理演算によりノードが自然に配置されます。
    *   ズーム、パン、ノードドラッグなどのインタラクションが可能です。

### データフロー

1.  **React App** (`GraphViewer.tsx`)
    *   コンポーネントマウント時に `/api/graph` を呼び出します。
    *   `ResizeObserver` を使用して親コンテナのサイズ変更を検知し、グラフの描画領域を動的に調整します（タブ切り替え時の描画崩れ防止）。

2.  **Next.js Backend** (`/api/graph`)
    *   リクエストを `llm-service` にプロキシします。

3.  **Python LLM Service** (`/graph`)
    *   Neo4j から全ノードとリレーションを取得します。
    *   `react-force-graph-2d` が解釈可能な形式 (`{ nodes: [], links: [] }`) に変換して返します。

### 描画の仕組み

*   **ノード**: `Concept` ラベルを持つノードが表示されます。
    *   グループ (`group`) によって自動的に色分けされます（現在はすべて `Concept`）。
*   **リンク**: リレーションシップが表示されます。
    *   矢印（Directional Arrow）として描画され、因果関係の方向を示します。
    *   リレーションタイプ（`CAUSES` など）がラベルとして表示されます。
