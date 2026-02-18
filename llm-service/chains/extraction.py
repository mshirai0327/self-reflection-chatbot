from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field
from typing import List, Optional

class KnowledgeTriple(BaseModel):
    subject: str = Field(description="The source concept or event (e.g., 'Lack of sleep')")
    predicate: str = Field(description="The relationship type (e.g., 'CAUSES', 'RELATED_TO', 'HAS_PART')")
    object: str = Field(description="The target concept or event (e.g., 'Fatigue')")
    weight: float = Field(description="Confidence or strength of the relationship (0.0 to 1.0)", default=1.0)
    is_personal: bool = Field(description="True if this is a personal/learned fact, False if it is a universal/invariant fact", default=True)

class ExtractionResult(BaseModel):
    triples: List[KnowledgeTriple] = Field(description="List of extracted relationships")

def create_extraction_chain(llm: ChatGoogleGenerativeAI):
    prompt = ChatPromptTemplate.from_messages([
        ("system", """
You are a knowledge extractor for a self-reflection AI.
Your goal is to extract causal relationships and facts from the user's conversation that explain "why" things happen or "how" the user/AI functions.

Focus on:
1. Physical/Biological causes (e.g., "Lack of sleep" causes "Poor concentration") - Flag these as is_personal=False if universal.
2. Personal habits/Learned patterns (e.g., "Working late" causes "Overeating") - Flag these as is_personal=True.

Return a list of triples.
"""),
        ("human", "{input}")
    ])
    
    return prompt | llm.with_structured_output(ExtractionResult)
