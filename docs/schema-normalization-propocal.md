# データベース正規化提案 (Database Normalization Proposal)

ユーザー様のご要望に基づき、現在の「カラム固定（横持ち）」のステータステーブルを、「項目マスタ＋値テーブル（縦持ち）」に正規化する設計案を作成しました。

## 変更の概要

各ステータスカテゴリ（Lv1-1 〜 Lv3-2）において、以下の2種類のテーブルに分割します。

1.  **項目定義テーブル (Item/Master)**
    *   管理する項目の定義（名前、データ型など）を保持します。
    *   ユーザー様が言及された `...Name` テーブルに相当します。
2.  **値テーブル (Value)**
    *   実際の値を保持します。
    *   `PersonaStatus` と `Item` の両方に紐付きます。
    *   データ型（Int, String, Float, DateTime）ごとにカラムを分け、型安全性を維持します。

## スキーマ変更案 (Prisma)

### Lv1-1: QuantityUnchange (不変・定量)

```prisma
/// Lv1-1 項目定義マスタ
model QuantityUnchangeItem {
  id        String   @id @default(uuid())
  name      String   @unique // コード上の識別子 (例: "birth_date", "gender")
  label     String?  // 表示名 (例: "生年月日")
  dataType  String   // "date", "string", "int", "float"

  values    QuantityUnchangeValue[]

  @@map("quantity_unchange_items")
}

/// Lv1-1 値データ
model QuantityUnchangeValue {
  id              String               @id @default(uuid())
  personaStatusId String               @map("persona_status_id")
  personaStatus   PersonaStatus        @relation(fields: [personaStatusId], references: [statusId])
  
  itemId          String               @map("item_id")
  item            QuantityUnchangeItem @relation(fields: [itemId], references: [id])

  // 型ごとに値を格納するカラム
  valDate         DateTime?
  valString       String?
  valInt          Int?
  valFloat        Float?

  @@unique([personaStatusId, itemId]) // 同じステータス内で同じ項目は1つのみ
  @@map("quantity_unchange_values")
}
```

### Lv1-2: SemiquantityUnchange (不変・半定量)

```prisma
/// Lv1-2 項目定義マスタ
model SemiquantityUnchangeItem {
  id        String   @id @default(uuid())
  name      String   @unique // 例: "ethics", "passion"
  label     String?
  
  values    SemiquantityUnchangeValue[]

  @@map("semiquantity_unchange_items")
}

/// Lv1-2 値データ (このカテゴリは Int 0-100 が主ですが、汎用性のために他も用意します)
model SemiquantityUnchangeValue {
  id              String                   @id @default(uuid())
  personaStatusId String                   @map("persona_status_id")
  personaStatus   PersonaStatus            @relation(fields: [personaStatusId], references: [statusId])
  
  itemId          String                   @map("item_id")
  item            SemiquantityUnchangeItem @relation(fields: [itemId], references: [id])

  valInt          Int?    @default(50)
  // 必要に応じて他も追加

  @@unique([personaStatusId, itemId])
  @@map("semiquantity_unchange_values")
}
```

(Lv2, Lv3-1, Lv3-2 も同様のパターンで作成します)

## 考慮事項

1.  **データアクセスの変化**:
    *   変更前: `status.quantityUnchange.gender`
    *   変更後: `status.quantityUnchangeValues.find(v => v.item.name === 'gender').valString`
    *   コード側での値の取り出しが少し複雑になりますが、項目の増減には非常に強くなります。

2.  **型安全性**:
    *   Prisma上では `valString` や `valInt` が Nullable になるため、取り出した後に適切な型の値が入っているかチェックが必要になります。

この方針で `schema.prisma` を書き換えてよろしいでしょうか？
また、初期データ（Seed）もこの構造に合わせて大幅に修正する必要があります。
