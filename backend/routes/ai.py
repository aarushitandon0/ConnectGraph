from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.ai_service import explain_concept, suggest_next, generate_quiz

router = APIRouter()

class ExplainRequest(BaseModel):
    concept_name: str
    concept_description: str
    mastered_names: list[str]

class SuggestRequest(BaseModel):
    mastered_names: list[str]
    unlocked_names: list[str]
    frontier_names: list[str]

class ChatRequest(BaseModel):
    concept_name: str
    explanation: str
    question: str
    mastered_names: list[str]
    history: list[dict] = []

@router.post("/explain")
def explain(body: ExplainRequest):
    text = explain_concept(body.concept_name, body.concept_description, body.mastered_names)
    return {"explanation": text}

@router.post("/suggest")
def suggest(body: SuggestRequest):
    text = suggest_next(body.mastered_names, body.unlocked_names, body.frontier_names)
    return {"suggestion": text}

class QuizRequest(BaseModel):
    concept_name: str
    mastered_names: list[str]
    previous_questions: list[str] = []

@router.post("/quiz")
def quiz(body: QuizRequest):
    result = generate_quiz(body.concept_name, body.mastered_names, body.previous_questions)
    return result

@router.post("/chat")
def chat(body: ChatRequest):
    from services.ai_service import answer_question
    return {"answer": answer_question(body.concept_name, body.explanation, body.question, body.mastered_names, body.history)}
