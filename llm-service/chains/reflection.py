from typing import List, Optional
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.language_models import BaseChatModel

# --- Reflection Output Models ---

class StatusUpdate(BaseModel):
    health: int = Field(description="健康度の変化量 (例: 5, -10, 0)")
    mood: int = Field(description="情緒の変化量 (例: 5, -10, 0)")
    trust: int = Field(description="信頼度の変化量 (例: 5, -10, 0)")
    friendliness: int = Field(description="親しみやすさの変化量 (例: 5, -10, 0)")
    heightIncrease: float = Field(description="分析の結果、身長が伸びたと判断される場合の増加量(cm)。基本は0。伸びた場合は0.1〜0.5の範囲で指定。", default=0.0)

class ReflectionResult(BaseModel):
    thought: str = Field(description="内省の思考過程、日本語で記述")
    statusUpdate: StatusUpdate = Field(description="ステータスの変化量")
    permanentMemory: Optional[str] = Field(description="今後忘れてはいけない重要な教訓、日本語で記述。なければ省略。", default=None)
    newMemories: List[str] = Field(description="会話から得られた、永続的に記憶すべきユーザーの情報、好み、合意事項、または重要な出来事のリスト。挨拶や一時的な文脈は除外すること。", default_factory=list)
    growthFeedback: bool = Field(description="会話の中で、AI自身の成長（身長の伸びなど）について話題になった、またはユーザーがそれに言及した場合はtrue。それ以外はfalse。", default=False)

# --- Chain Creation ---

def create_reflection_chain(llm: BaseChatModel):
    prompt = ChatPromptTemplate.from_messages([
        ("system", """
あなたの名前は「{name}」です。
以下の情報に基づいて自己分析を行い、あなた自身のステータスがどのように変化すべきかを判断してください。

### 分析対象の会話履歴:
{log_summary}

### 現在のあなたのステータス:
[基本情報]
- 性別: {gender}
- 年齢: {age}
- 血液型: {blood_type}
- クロノタイプ: {chronotype}
- 知能指数: {intelligence}

[性格特性(Lv1-2)]
- 倫理観: {ethics}/100
- 情熱: {passion}/100
- 好奇心: {curiosity}/100
- 攻撃性: {aggressiveness}/100
- 外向性: {extroversion}/100

[身体情報]
- 身長: {height}cm
- 体重: {weight}kg
- 骨密度: {bone_density}
- 睡眠時間: {sleep_time}h (質: {sleep_quality}/10)
- バイタル: 血圧 {bp_sys}/{bp_dia}, 血糖値 {blood_sugar}

[現在の状態(Lv3-2)]
- 健康度: {health}/100
- 情緒: {mood}/100
- 信頼度(ユーザーへの): {trust}/100
- 親しみやすさ: {friendliness}/100

### 関連する知識グラフ (Context from Knowledge Graph):
{graph_context}

### 指示:
会話履歴と現在のステータスを深く考察し、必ず以下の構造で回答を出力してください。
1. **thought**: この会話を通じて何を感じ、何を考えたのか。あなたの内面的な思考プロセスを記述してください。
2. **statusUpdate**: 分析の結果、あなたの「健康度」「情緒」「信頼度」「親しみやすさ」はどのように変化すべきですか？増加、減少、または変化なし（0）を具体的な整数で示してください。また、成長の実感がある場合は「身長の増加量(heightIncrease)」を0.1〜0.5cmの範囲で指定してください。
3. **permanentMemory**: 自身の人格形成に関わる「教訓」や「自己の指針」があれば記述してください。
4. **newMemories**: ユーザーに関する重要な情報（趣味、家族構成、予定など）や、二人の間で確立された重要な文脈があれば、箇条書きの配列として抽出してください。「こんにちは」等の挨拶や意味のない雑談は絶対に含めないでください。
5. **growthFeedback**: 今回の会話で、あなたの身体的成長（背が伸びたことなど）について話題になりましたか？ true または false で答えてください。
"""),
        ("human", "内省を開始してください。")
    ])

    return prompt, prompt | llm.with_structured_output(ReflectionResult)
