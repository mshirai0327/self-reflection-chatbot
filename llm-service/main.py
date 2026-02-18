from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from chains.chat import ChatService, ChatContext, PersonaStatus
from graph.service import GraphService
from chains.extraction import create_extraction_chain
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

app = FastAPI(title="Reflecta LLM Service")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    import json
    print(f"Validation Error: {json.dumps(exc.errors(), indent=2)}")
    print(f"Body: {await request.body()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(await request.body())},
    )

chat_service = ChatService()
graph_service = GraphService()

# Extraction model
extraction_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro", # Use Pro for better extraction logic
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0
)
extraction_chain = create_extraction_chain(extraction_llm)

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    context: ChatContext

def run_extraction(message: str):
    """Background task to extract knowledge from user message"""
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
    return {"status": "ok", "service": "Reflecta LLM Service"}

@app.post("/chat")
async def chat(request: ChatRequest, background_tasks: BackgroundTasks):
    try:
        # 1. Retrieve Graph Context
        graph_context = graph_service.get_relevant_context(request.message)
        request.context.graph_context = graph_context
        
        # 2. Generate Chat Response
        result = await chat_service.generate_response(
            request.message,
            request.history,
            request.context
        )
        
        # 3. Trigger memory extraction in background
        background_tasks.add_task(run_extraction, request.message)
        
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph")
async def get_graph():
    return graph_service.get_whole_graph()
