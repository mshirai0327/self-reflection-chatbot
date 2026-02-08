# 人格再構築システム：内省処理 (Self-Reflection Process)

Reflecta の最大の特徴は、AI が自らの対話を振り返り、自らの性格（数値ステータス）や長期的な記憶を自律的に更新する「内省処理」にあります。

## 1. 内省の目的

通常の LLM は対話が終わるとその内容を「知識」として定着させることはできません。Reflecta では、Gemini 1.5 Pro の高い論理推論能力を活用し、以下の 3 点を実現しています。

- **性格の動的な変化**: 会話の内容（優しくされた、無視された等）に応じて、情緒や信頼度を変化させる。
- **恒久記憶の抽出**: 膨大な会話から、将来役に立つ「教訓」や「重要な事実」だけを抽出し、ベクトルストアに永続化する。
- **一貫性の維持**: 自分の今の気分や健康状態を客観的に分析し、次回の対話に反映させる。

---

## 2. 処理フロー (7ステップ)

内省は以下の 7 ステップで実行されます。詳細は [シークエンス図](./sequence.md) も参照してください。

### ① 対話ログの集約

**実装箇所:** `route.ts` L46-50

RDB (MySQL) の `ChatLog` テーブルから、対象ペルソナに紐づく直近の最大 **20件** の会話ログを取得します。

```typescript
const recentLogs = await prisma.chatLog.findMany({
    where: { personaId: persona.id },
    take: 20,
    orderBy: { createdAt: 'desc' }
});
```

> **⚠ 現状の課題:**  
> 「前回の内省以降のログに限定する」というフィルタリングが **未実装** です。現在は単純に直近20件を取得しているため、同じ会話が複数回内省対象となる可能性があります。

### ② 現在のステータス取得

**実装箇所:** `route.ts` L61-73

`getLatestStatus()` 関数（`lib/persona.ts`）を使用して、ペルソナの現在の全ステータス（Lv1〜Lv3の各テーブル）を取得し、`flattenStatus()` で1つのオブジェクトにマージします。

```typescript
const fullStatus = await getLatestStatus(persona.id);
const status = flattenStatus(fullStatus);
// status: { height, weight, health, mood, trust, ... }
```

### ③ プロンプト構築とLLM呼び出し

**実装箇所:** `route.ts` L78-130

LangChain の `generateJson()` 関数を使用し、Zod スキーマに基づいた構造化 JSON を生成させます。

#### プロンプト構造

```
あなたは自己進化型AI「Reflecta」です。以下の情報に基づいて自己分析を行い...

### 分析対象の会話履歴:
user: こんにちは
assistant: こんにちは！お話できてうれしいです。
...

### 現在のあなたのステータス:
- 身長: ${status.height}cm
- 体重: ${status.weight}kg
- 健康度: ${status.health}/100
- 情緒: ${status.mood}/100
- 信頼度: ${status.trust}/100

### 指示:
会話履歴と現在のステータスを深く考察し、必ず以下の**JSON形式**で回答を出力してください。
1. thought: 思考プロセス
2. statusUpdate: { health, mood, trust, friendliness } の変動値
3. permanentMemory: 自己の指針となる教訓
4. newMemories: **ユーザーに関する重要な情報や合意事項のリスト** (記憶の蒸留)
```

#### 出力スキーマ (Zod)

```typescript
const reflectionSchema = z.object({
    thought: z.string().describe("内省の思考過程、日本語で記述"),
    statusUpdate: z.object({
        health: z.number().int().describe("健康度の変化量 (例: 5, -10, 0)"),
        mood: z.number().int().describe("情緒の変化量 (例: 5, -10, 0)"),
        trust: z.number().int().describe("信頼度の変化量 (例: 5, -10, 0)"),
        friendliness: z.number().int().describe("親しみやすさの変化量 (例: 5, -10, 0)"),
    }),
    permanentMemory: z.string().optional().describe("今後忘れてはいけない重要な教訓..."),
    newMemories: z.array(z.string()).describe("会話から得られた、永続的に記憶すべきユーザーの情報...リスト"),
});
```

### ④ ステータスの更新 (RDB)

**実装箇所:** `route.ts` L133-206

**Hub パターン (1:N)** を採用しています。
`PersonaStatus` (Hub) 自体は更新せず、その配下の履歴テーブル (`QuantityIrreversibleStatus`, `QuantityReversibleStatus`, `SemiquantityReversibleStatus`) に**新しいバージョンのレコードを追加**します。

1.  現在の最新ステータス値を取得。
2.  LLM が算出した変動値 (`statusUpdate`) を加算し、0-100 にクランプ。
3.  `prisma.$transaction` を使用して、各サブテーブルに新規レコードを一括作成。

これにより、ペルソナIDは変わらずに、ステータスの履歴だけが積み上がっていきます。

### ⑤ 内省イベントの記録

**実装箇所:** `route.ts` L208-216

内省の結果全体（思考、ステータス、抽出された記憶含む）を `ReflectionEvent` テーブルに JSON として保存します。これはデバッグや履歴表示に使用されます。

```typescript
await prisma.reflectionEvent.create({
    data: {
        personaId: persona.id,
        response: reflection, // JSON全体
        prompt: reflectionPrompt
    }
});
```

### ⑥ 記憶の蒸留と保存 (ベクトルストア)

**実装箇所:** `route.ts` L218-247

Reflecta の核心機能です。LLM が「重要」と判断した情報だけを ChromaDB に保存します。

1.  **教訓 (permanentMemory)**:
    *   自己の人格形成に関わる教訓がある場合、`type: "reflection"` として保存。
2.  **事実記憶 (newMemories)**:
    *   ユーザーの趣味や約束事など、リストアップされた各アイテムを個別にベクトル化し、`type: "fact"` として保存。
    *   次回以降のチャットで、関連する話題が出たときにピンポイントで呼び出せるようになります。

```typescript
if (reflection.newMemories && reflection.newMemories.length > 0) {
    for (const memory of reflection.newMemories) {
        await addMemory(ulid(), memory, { type: "fact", source: "reflection", ... });
    }
}
```

### ⑦ 対話へのフィードバック

内省が完了すると、最新のステータスデータが API レスポンスに含まれて返却されます。フロントエンドはこれを受け取り、サイドバーのステータス表示を即座に更新します。ユーザーは「自分の発言でAIの機嫌が変わった」ことを可視化されたパラメータで実感できます。

---

## 3. 推論結果の例

内部的に Gemini Pro は以下のような出力を生成しています。

```json
{
  "thought": "最近のユーザーは私をペンギンと呼んでからかっている。私は Reflecta であることを根気強く伝えたが、少し困惑している。信頼度は維持するが、情緒はわずかに下げて、少し戸惑っている様子を見せるべきだ。",
  "statusUpdate": {
    "health": 0,
    "mood": -10,
    "trust": 2
  },
  "permanentMemory": "ユーザーは私の名前を間違える癖があるようだ。しかし、悪意はないように見えるため、根気強く自己紹介を続ける必要がある。"
}
```

---

## 4. データベーステーブルとの対応

| カテゴリ | テーブル名 | 内省での変動 | 現状 |
| :--- | :--- | :---: | :--- |
| Lv1-1 基本情報 | `QuantityUnchangeStatus` | ❌ 不変 | 不変 |
| Lv1-2 性格特性 | `SemiquantityUnchangeStatus` | ❌ 不変 | 不変 |
| Lv2 成長記録 | `QuantityIrreversibleStatus` | ⚠ 未対応 | 履歴を記録。不可逆性は表現できていない |
| Lv3-1 バイタル | `QuantityReversibleStatus` | ⚠ 未対応 | 変動ロジック未実装 (`weight`, `sleepTime` などは常にコピー) |
| Lv3-2 心理状態 | `SemiquantityReversibleStatus` | ✅ 対応済み | `health`, `mood`, `trust` のみ変動 |

---

## 5. 現状の課題と今後の改善点

1.  **ログのフィルタリング**: 前回の内省以降のログのみを対象とするフィルタを実装する。
2.  **プロンプトの精緻化**: Lv1 の性格特性（好奇心、攻撃性など）をプロンプトに含め、応答の傾向に影響させる。
3.  **Lv3-1 の変動ロジック**: 会話の時間帯や長さに応じて `sleepQuality` や `bloodPressure` を変動させるルールを追加する。
4.  **Lv1/Lv2 のデータコピー問題**: 不変データは毎回コピーせず、`connect` で既存レコードに紐付ける設計に変更する。
5.  **エラーハンドリング**: LLM が不正な JSON を返した場合のリトライロジック実装（現状は `// todo` コメントあり）。

---

## 6. 今後の拡張

現在は手動ボタンによるトリガーですが、将来的には「一定時間会話が途切れたら自動的に実行」や「特定のイベントが発生した際に裏側で実行」するような、より自律的なエージェント化を予定しています。
