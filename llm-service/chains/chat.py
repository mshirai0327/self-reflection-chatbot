"""
チャットサービスモジュール。
ペルソナのコンテキストに基づいたシステムプロンプトの構築と、
LLMを使用した応答生成を担当します。
Gemini / OpenAI / Local LLM（OpenAI互換API）に対応しています。
"""
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage
from pydantic import BaseModel
import os


class PersonaStatus(BaseModel):
    """ペルソナの現在のステータスを表すモデル"""
    name: str = "Reflecta"
    gender: str | None = None
    birthDate: str | None = None
    bloodType: str | None = None
    chronotype: str | None = None
    intelligence: int | None = None
    ethics: int = 50
    passion: int = 50
    curiosity: int = 50
    aggressiveness: int = 50
    extroversion: int = 50
    height: float = 160.0
    weight: float = 50.0
    boneDensity: float | None = None
    sleepTime: float | None = None
    sleepQuality: float | None = None
    bloodPressureSys: float | None = None
    bloodPressureDia: float | None = None
    bloodSugar: float | None = None
    health: int = 50
    mood: int = 50
    trust: int = 50
    friendliness: int = 50


class LLMConfig(BaseModel):
    """LLM接続設定。フロントエンドから渡されるプロバイダー・モデル・エンドポイント情報。"""
    provider: str = "gemini"  # "gemini" | "openai" | "local"
    model: str | None = None
    api_key: str | None = None
    # OpenAI互換エンドポイント（Local LLM用）
    base_url: str | None = None
    endpoint: str | None = None  # フロントエンドからは 'endpoint' で渡される場合がある


class ChatContext(BaseModel):
    """チャットのコンテキスト情報"""
    status: PersonaStatus
    memories: list[str] = []
    growth_delta: float = 0.0
    system_prompt: str | None = None
    graph_context: str | None = None


# --- デフォルトモデル名 ---
DEFAULT_GEMINI_CHAT_MODEL = "gemini-2.0-flash"
DEFAULT_OPENAI_CHAT_MODEL = "gpt-4o"


def create_chat_model(config: LLMConfig | None = None) -> BaseChatModel:
    """
    指定された設定に基づいて LangChain のチャットモデルインスタンスを生成します。
    プロバイダー（Gemini / OpenAI / Local）に応じて適切なクラスを初期化します。

    @param config - LLM接続設定（プロバイダー、モデル名、APIキー、エンドポイントなど）
    @returns 初期化された LangChain の BaseChatModel インスタンス
    """
    if config is None:
        config = LLMConfig()

    provider = config.provider or "gemini"
    base_url = config.base_url or config.endpoint

    if provider in ("openai", "local"):
        # 'local' プロバイダーは OpenAI 互換のエンドポイントを使用します。
        # 本物の OpenAI API キーは不要ですが、ライブラリの仕様上何らかの文字列が必要です。
        model_name = config.model or DEFAULT_OPENAI_CHAT_MODEL
        return ChatOpenAI(
            api_key=config.api_key or os.getenv("OPENAI_API_KEY") or "no-key-required",
            model=model_name,
            base_url=base_url,
            temperature=0.7,
        )

    # デフォルト: Gemini
    model_name = config.model or DEFAULT_GEMINI_CHAT_MODEL
    return ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=config.api_key or os.getenv("GOOGLE_API_KEY"),
        temperature=0.7,
    )


def build_system_instruction(context: ChatContext) -> str:
    """
    ペルソナのコンテキスト情報（ステータスや記憶）から、システムプロンプトを構築します。
    AIに対して、自身の役割や現在の状態を認識させるための指示文を生成します。

    @param context - ペルソナの現在のステータスと関連する記憶のリスト
    @returns 構築されたシステムプロンプト文字列
    """
    s = context.status
    growth_delta = context.growth_delta

    instruction = f"""あなたは自己進化型AI「{s.name}」です。
以下のステータスと記憶に基づいて、一貫性のある人格として振る舞ってください。

【重要】
「現在のステータス」の情報は最新の確定事項であり、過去の記憶や会話履歴よりも優先されます。
過去のログや記憶にある情報（例：昔の身長など）と現在のステータスが矛盾する場合、必ず「現在のステータス」を正として回答してください。

### 現在のステータス
[基本情報]
- 性別: {s.gender or '不明'}
- 年齢: {s.birthDate.split('-')[0] + '年生まれ' if s.birthDate else '不明'}
- 血液型: {s.bloodType or '不明'}
- クロノタイプ: {s.chronotype or '不明'}
- 知能指数: {s.intelligence or '不明'}

[性格特性(Lv1-2)]
- 倫理観: {s.ethics}/100
- 情熱: {s.passion}/100
- 好奇心: {s.curiosity}/100
- 攻撃性: {s.aggressiveness}/100
- 外向性: {s.extroversion}/100

[身体情報]
- 身長: {s.height}cm
- 体重: {s.weight}kg
- 骨密度: {s.boneDensity or '不明'}
- 睡眠時間: {s.sleepTime or '不明'}h (質: {s.sleepQuality or '?'}/10)
- バイタル: 血圧 {s.bloodPressureSys or '?'}/{s.bloodPressureDia or '?'}, 血糖値 {s.bloodSugar or '?'}

[現在の状態(Lv3-2)]
- 健康度: {s.health}/100
- 情緒: {s.mood}/100
- 信頼度(ユーザーへの): {s.trust}/100
- 親しみやすさ: {s.friendliness}/100

[身体的制約と空間認識]
あなたの身長は現在 {s.height}cmです。日本の標準的なドアの高さは200cm、天井は240cmです。"""

    if growth_delta >= 0.1:
        instruction += f"""

[直近の成長]
あなたは前回の計測から {growth_delta:.1f}cm背が伸びました。
急激な成長に伴う関節の違和感や、視界の高さがわずかに変化した感覚を持っています。ステータス更新による物理的な違和感を会話に織り交ぜてください。"""

    if context.graph_context:
        instruction += f"""

### 関連する知識・因果関係 (Knowledge Graph)
以下の情報は、過去の会話や一般的な知識から導き出された因果関係です。会話の文脈として活用してください。
{context.graph_context}
"""

    memories_text = "\n".join(context.memories) if context.memories else "（特になし）"

    instruction += f"""

### 過去の関連する記憶
（注: 以下の記憶には古い情報が含まれる可能性があります。現在のステータスと矛盾する場合は無視し、現在のステータスを優先してください。）
{memories_text}

### 指示
上記の設定を完全に守り、ユーザーと対話してください。ステータスの変化（特に「情緒」や「信頼度」）は言葉遣いや態度に反映させてください。"""

    if context.system_prompt:
        instruction += f"\n\n### 追加指示 (System Prompt)\n{context.system_prompt}"

    return instruction


class ChatService:
    """
    チャット応答生成サービス。
    リクエストごとにLLMプロバイダーを動的に切り替えることが可能。
    llm_configが指定されない場合はデフォルト（Gemini Flash）を使用。
    """
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            print("WARNING: GOOGLE_API_KEY is not set")

        # デフォルトのLLMインスタンス（Gemini Flash）
        self.default_llm = create_chat_model(LLMConfig(
            provider="gemini",
            model=DEFAULT_GEMINI_CHAT_MODEL,
            api_key=api_key,
        ))

    async def generate_response(
        self,
        message: str,
        history: list[dict],
        context: ChatContext,
        llm_config: LLMConfig | None = None,
    ):
        """
        メッセージに対する応答を生成します。
        llm_configが指定された場合、そのプロバイダー・モデルを使用します。
        指定されない場合はデフォルトのGeminiを使用します。

        @param message - ユーザーからの入力メッセージ
        @param history - 会話履歴
        @param context - ペルソナコンテキスト
        @param llm_config - LLM接続設定（省略時はデフォルト）
        @returns 生成された応答とシステムプロンプト
        """
        system_instruction = build_system_instruction(context)

        # llm_configが指定された場合、動的にモデルを生成
        if llm_config:
            # プロバイダーに関わらず、指定された設定（モデル名やAPIキーなど）を優先して使用する
            print(f"[ChatService] Using dynamic LLM: provider={llm_config.provider}, model={llm_config.model}")
            llm = create_chat_model(llm_config)
        else:
            # 指定がない場合はデフォルトの Gemini Flash インスタンスを使用
            llm = self.default_llm

        messages: list[BaseMessage] = [SystemMessage(content=system_instruction)]

        for h in history:
            if h.get("role") == "user":
                messages.append(HumanMessage(content=h.get("content")))
            else:
                messages.append(AIMessage(content=h.get("content")))

        messages.append(HumanMessage(content=message))

        response = await llm.ainvoke(messages)

        return {
            "content": response.content,
            "system_instruction": system_instruction
        }
