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
from chains.reflection import create_reflection_chain, ReflectionResult

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

# 知識抽出用モデルのデフォルト設定（環境変数から読み込み）
# チャットリクエストで llm_config が渡された場合は、そちらを優先して使用する。
_default_extraction_llm_config = LLMConfig(
    provider=os.getenv("EXTRACTION_LLM_PROVIDER", "gemini"),
    model=os.getenv("EXTRACTION_LLM_MODEL", "gemini-2.5-pro"),
    base_url=os.getenv("EXTRACTION_LLM_ENDPOINT"),
)
print(f"[Extraction] Default config: provider={_default_extraction_llm_config.provider}, model={_default_extraction_llm_config.model}")


class ChatRequest(BaseModel):
    """チャットリクエストのスキーマ"""
    message: str
    history: list[dict] = []
    context: ChatContext
    # フロントエンドから渡されるLLM接続設定（省略時はデフォルトのGeminiを使用）
    llm_config: LLMConfig | None = None


class ReflectionRequest(BaseModel):
    """内省リクエストのスキーマ"""
    log_summary: str
    status: PersonaStatus
    # フロントエンドから渡されるLLM接続設定（省略時はデフォルトのGeminiを使用）
    llm_config: LLMConfig | None = None


def run_extraction(message: str, llm_config: LLMConfig | None = None):
    """
    バックグラウンドタスク: ユーザーメッセージからナレッジトリプルを抽出してNeo4jに保存する。

    llm_config が指定された場合はそのプロバイダー・モデルを使用する。
    指定されない場合は環境変数のデフォルト設定（_default_extraction_llm_config）を使用する。
    これにより、フロントエンドで Local LLM を選択している場合は、
    知識抽出も同じ Local LLM で行われ、Gemini API のクォータを消費しない。

    @param message - 抽出対象のユーザーメッセージ
    @param llm_config - 使用するLLM設定（省略時はデフォルト設定を使用）
    """
    # リクエストで使われた llm_config を優先。なければデフォルト設定を使用。
    active_config = llm_config if llm_config else _default_extraction_llm_config
    try:
        print(f"[Extraction] Running for: {message}")
        print(f"[Extraction] Using provider={active_config.provider}, model={active_config.model}")
        # リクエストごとにモデルを動的生成（Local LLM の場合は endpoint も含む）
        extraction_llm = create_chat_model(active_config)
        chain = create_extraction_chain(extraction_llm)
        result = chain.invoke({"input": message})
        if result and result.triples:
            print(f"[Extraction] Extracted {len(result.triples)} triples")
            graph_service.add_triples(result.triples)
        else:
            print("[Extraction] No triples extracted.")
    except Exception as e:
        print(f"[Extraction] Failed: {e}")


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
        # チャットで使用した llm_config を抽出にも流用することで、
        # Local LLM 使用時は Gemini API のクォータを消費しない。
        background_tasks.add_task(run_extraction, request.message, request.llm_config)

        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reflect")
async def reflect(request: ReflectionRequest):
    """内省を実行するエンドポイント"""
    try:
        print(f"[Reflection] Starting reflection with provider: {request.llm_config.provider if request.llm_config else 'default'}")
        
        # 1. ナレッジグラフから関連コンテキストを取得
        # 会話ログの要約をクエリとして、関連する過去の知識を引き出す
        graph_context = graph_service.get_relevant_context(request.log_summary[:200]) # 長すぎるので制限
        print(f"[Reflection] Graph context retrieved: {len(graph_context)} chars")

        # 2. LLMモデルの初期化
        llm = create_chat_model(request.llm_config)
        
        # 3. 内省チェーンの実行
        chain = create_reflection_chain(llm)
        
        # ステータス情報の展開
        s = request.status
        
        result = await chain.ainvoke({
            "name": s.name or "Reflecta",
            "log_summary": request.log_summary,
            "gender": s.gender or "不明",
            "age": (s.birthDate.split('-')[0] + '年生まれ') if s.birthDate else "不明",
            
            # Pydanticモデルのフィールドに合わせて展開
            "blood_type": s.bloodType or "不明",
            "chronotype": s.chronotype or "不明",
            "intelligence": s.intelligence or "不明",
            "ethics": s.ethics or 50,
            "passion": s.passion or 50,
            "curiosity": s.curiosity or 50,
            "aggressiveness": s.aggressiveness or 50,
            "extroversion": s.extroversion or 50,
            "height": s.height or 160.0,
            "weight": s.weight or 50.0,
            "bone_density": s.boneDensity or 100.0,
            "sleep_time": s.sleepTime or 7.0,
            "sleep_quality": s.sleepQuality or 80,
            "bp_sys": s.bloodPressureSys or 120,
            "bp_dia": s.bloodPressureDia or 80,
            "blood_sugar": s.bloodSugar or 90,
            "health": s.health or 80,
            "mood": s.mood or 50,
            "trust": s.trust or 50,
            "friendliness": s.friendliness or 50,
            "graph_context": graph_context,
       })

        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph")
async def get_graph():
    """ナレッジグラフ全体を取得するエンドポイント"""
    import time
    start_time = time.time()
    print("[Graph] Fetching whole graph...")
    try:
        result = graph_service.get_whole_graph()
        duration = time.time() - start_time
        print(f"[Graph] Successfully fetched graph in {duration:.3f}s")
        return result
    except Exception as e:
        duration = time.time() - start_time
        print(f"[Graph] Failed to fetch graph after {duration:.3f}s: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

