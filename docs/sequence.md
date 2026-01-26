# Reflecta シークエンス図

このドキュメントでは、Reflecta の主要な処理フロー（チャットと内省）を Mermaid 形式のシークエンス図で定義します。

## 1. チャット処理 (Chat Interaction)

ユーザーとの対話時のフローです。Gemini 1.5 Flash を使用して高速に応答を生成し、ステータスや記憶を考慮します。

```mermaid
sequenceDiagram
    participant U as ユーザー (Frontend)
    participant B as Backend (Next.js API)
    participant P as Prisma (MySQL)
    participant C as ChromaDB (Vector)
    participant G as Gemini 1.5 Flash

    U->>B: POST /api/chat { message }
    
    activate B
    B->>P: 現在のステータスを取得 (PersonaStatus)
    P-->>B: status
    
    B->>C: 関連する過去の記憶を検索 (queryMemories)
    C-->>B: memories
    
    B->>G: 応答生成リクエスト (status + memories + message)
    G-->>B: aiResponse
    
    B->>P: 会話ログを保存 (ChatLog)
    B->>C: メッセージを記憶に保存 (addMemory)
    
    B-->>U: { response, status }
    deactivate B
```

## 2. 内省処理 (Self Reflection)

「Self Reflect」ボタン押下時のフローです。Gemini 1.5 Pro を使用して論理的な推論を行い、自己のステータスや恒久的な記憶を更新します。

```mermaid
sequenceDiagram
    participant U as ユーザー (Frontend)
    participant B as Backend (Next.js API)
    participant P as Prisma (MySQL)
    participant C as ChromaDB (Vector)
    participant G as Gemini 1.5 Pro

    U->>B: POST /api/reflect
    
    activate B
    B->>P: 直近の会話ログ(ChatLog)を取得
    P-->>B: recentLogs
    
    B->>P: 現在のステータスを取得 (PersonaStatus)
    P-->>B: status
    
    B->>G: 内省リクエスト (logs + status)
    Note over G: 性格やステータスへの影響を論理推論
    G-->>B: { thought, statusUpdate, permanentMemory }
    
    B->>P: ステータスを更新 (PersonaStatus.create)
    
    alt 恒久的な記憶がある場合
        B->>C: 重要な教訓を記憶に保存 (addMemory with type: "reflection")
    end
    
    B-->>U: { reflection }
    
    Note over U, B: フロントエンド側で完了通知とAIからの自動コメントをトリガー
    U->>B: POST /api/chat (内省完了後の挨拶)
    B-->>U: AI応答
    deactivate B
```
