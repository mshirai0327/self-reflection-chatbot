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

**実装箇所:** `route.ts` L77-105

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
...JSON形式で回答を出力してください...
```

> **⚠ 現状の課題:**  
> - **`height` と `weight` は内省で変化しないデータ**であり、プロンプトに含める必要性は低いです。さらに、これらの値は **`null` の場合がほとんど** です（シードデータでデフォルト値を設定していない場合）。
> - LLM に渡しているステータスは **Lv3-2 (`SemiquantityReversibleStatus`) のみ** です。Lv1 の性格特性（好奇心、倫理観など）は現在プロンプトに含まれていません。
> - プロンプト内で `height: nullcm` のような不格好な表示になる場合があります。

#### 出力スキーマ (Zod)

```typescript
const reflectionSchema = z.object({
    thought: z.string().describe("内省の思考過程、日本語で記述"),
    statusUpdate: z.object({
        health: z.number().int().describe("健康度の変化量 (例: 5, -10, 0)"),
        mood: z.number().int().describe("情緒の変化量 (例: 5, -10, 0)"),
        trust: z.number().int().describe("信頼度の変化量 (例: 5, -10, 0)"),
    }),
    permanentMemory: z.string().optional().describe("今後忘れてはいけない重要な教訓..."),
});
```

> **⚠ 現状の課題:**  
> - `statusUpdate` に含まれるのは `health`, `mood`, `trust` の3項目のみです。`friendliness`（親しみやすさ）や Lv3-1 の `bloodPressure`（血圧）などへの影響は現在考慮されていません。

### ④ ステータスの更新 (RDB)

**実装箇所:** `route.ts` L111-165

推論された `statusUpdate` を現在のステータスに加算し、新しい `PersonaStatus` レコードをDBに作成します（イミュータブルな履歴管理）。

#### クランプ処理

プログラム側で **0 〜 100 の範囲に収める（クランプ処理）** を行い、数値が破綻しないように制御します。

```typescript
health: Math.min(100, Math.max(0, (status.health ?? 100) + (reflection.statusUpdate.health || 0))),
mood: Math.min(100, Math.max(0, (status.mood ?? 50) + (reflection.statusUpdate.mood || 0))),
trust: Math.min(100, Math.max(0, (status.trust ?? 50) + (reflection.statusUpdate.trust || 0))),
```

#### Lv1/Lv2 データの扱い

現在の実装では、Lv1 (`QuantityUnchangeStatus`, `SemiquantityUnchangeStatus`) および Lv2 (`QuantityIrreversibleStatus`) のデータは、内省のたびに **既存データをコピーして新規レコードを作成** しています。

> **⚠ 現状の課題:**  
> - 本来 Lv1 は「不変」のため、レコードを毎回作成する必要はありません。理想的には、既存レコードへの `connect` のみで済むべきです。
> - Lv3-1 (`QuantityReversibleStatus`) の `weight`, `bloodSugar`, `sleepTime` なども現在は変動計算されず、**前の値がそのままコピーされるだけ**（または `null`）です。

### ⑤ 内省イベントの記録

**実装箇所:** `route.ts` L168-176

内省の結果を `ReflectionEvent` テーブルに永続化します。

```typescript
await prisma.reflectionEvent.create({
    data: {
        personaId: persona.id,
        thought: reflection.thought,
        statusUpdate: reflection.statusUpdate, // JSON
        permanentMemory: reflection.permanentMemory
    }
});
```

### ⑥ 恒久記憶の保存 (ベクトルストア)

**実装箇所:** `route.ts` L178-190

`permanentMemory` が生成された場合、それを ChromaDB（ベクトルストア）に保存します。

```typescript
if (reflection.permanentMemory) {
    await addMemory(
        `ref_${Date.now()}`,
        reflection.permanentMemory,
        {
            type: "reflection",
            thought: reflection.thought,
            personaId: persona.id
        }
    );
}
```

メタデータとして内省時の思考 (`thought`) もあわせて保存されます。これにより、将来の検索時に AI が「なぜこれを覚えているか」を思い出せるようになっています。

### ⑦ 対話へのフィードバック (フロントエンド側)

内省完了後、フロントエンドは自動的に「今の気分はどうですか？」というシステムメッセージを送信します。これにより、AI は更新されたばかりのステータスに基づいて、内省後の新しい反応を返します。

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
| Lv1-1 基本情報 | `QuantityUnchangeStatus` | ❌ 不変 | 毎回コピー（非効率） |
| Lv1-2 性格特性 | `SemiquantityUnchangeStatus` | ❌ 不変 | 毎回コピー（非効率） |
| Lv2 成長記録 | `QuantityIrreversibleStatus` | ⚠ 未対応 | 変動ロジック未実装 |
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
