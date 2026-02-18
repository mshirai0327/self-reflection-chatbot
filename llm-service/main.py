"""
Reflecta LLM Service - メインアプリケーション
FastAPIベースのLLMサービス。チャット応答生成とナレッジグラフ管理を提供します。
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from chains.chat import ChatService, ChatContext, PersonaStatus, LLMConfig, create_chat_model
from graph.service import GraphService
from chains.extraction import create_extraction_chain

load_dotenv()

app = FastAPI(title="Reflecta LLM Service")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """バリデーションエラーの詳細をログ出力するハンドラ"""
    import json
    print(f"Validation Error: {json.dumps(exc.errors(), indent=2)}")
    print(f"Body: {await request.body()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(await request.body())},
    )


chat_service = ChatService()
graph_service = GraphService()

# 知識抽出用モデル（バックグラウンドタスクで使用）
# 環境変数で設定可能。デフォルトは Gemini Pro。
extraction_llm_config = LLMConfig(
    provider=os.getenv("EXTRACTION_LLM_PROVIDER", "gemini"),
    model=os.getenv("EXTRACTION_LLM_MODEL", "gemini-2.5-pro"),
    base_url=os.getenv("EXTRACTION_LLM_ENDPOINT"),
)
extraction_llm = create_chat_model(extraction_llm_config)
print(f"[Extraction] Using provider={extraction_llm_config.provider}, model={extraction_llm_config.model}")
extraction_chain = create_extraction_chain(extraction_llm)


class ChatRequest(BaseModel):
    """チャットリクエストのスキーマ"""
    message: str
    history: list[dict] = []
    context: ChatContext
    # フロントエンドから渡されるLLM接続設定（省略時はデフォルトのGeminiを使用）
    llm_config: LLMConfig | None = None


def run_extraction(message: str):
    """バックグラウンドタスク: ユーザーメッセージからナレッジトリプルを抽出"""
    try:
        print(f"Running extraction for: {message}")
        result = extraction_chain.invoke({"input": message})
        if result and result.triples:
            print(f"Extracted {len(result.triples)} triples")
            graph_service.add_triples(result.triples)
    except Exception as e:
        print(f"Extraction failed: {e}")


@app.get("/")
async def root():
    """ヘルスチェックエンドポイント"""
    return {"status": "ok", "service": "Reflecta LLM Service"}


@app.post("/chat")
async def chat(request: ChatRequest, background_tasks: BackgroundTasks):
    """チャット応答生成エンドポイント"""
    try:
        # 1. ナレッジグラフから関連コンテキストを取得
        graph_context = graph_service.get_relevant_context(request.message)
        request.context.graph_context = graph_context

        # 2. チャット応答を生成（llm_configが指定されていればそのプロバイダーを使用）
        result = await chat_service.generate_response(
            request.message,
            request.history,
            request.context,
            llm_config=request.llm_config,
        )

        # 3. バックグラウンドで知識抽出を実行
        print("[DEBUG] neo4j insert")
        background_tasks.add_task(run_extraction, request.message)

        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph")
async def get_graph():
    """ナレッジグラフ全体を取得するエンドポイント"""
    return graph_service.get_whole_graph()
