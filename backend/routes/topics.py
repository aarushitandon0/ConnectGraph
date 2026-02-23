from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.graph_service import (
    get_learning_path,
    get_frontier,
    get_unlocked,
    validate_topic_graph
)

router = APIRouter()

class ProgressRequest(BaseModel):
    mastered_ids: list[int]

@router.get("/{topic_id}/path")
def learning_path(topic_id: int):
    path = get_learning_path(topic_id)
    if not path:
        raise HTTPException(status_code=404, detail="Topic not found")
    return {"topic_id": topic_id, "learning_path": path}

@router.post("/{topic_id}/frontier")
def frontier(topic_id: int, body: ProgressRequest):
    result = get_frontier(topic_id, body.mastered_ids)
    return {"topic_id": topic_id, "frontier": result}

@router.post("/{topic_id}/unlocked")
def unlocked(topic_id: int, body: ProgressRequest):
    result = get_unlocked(topic_id, body.mastered_ids)
    return {"topic_id": topic_id, "unlocked": result}

@router.get("/{topic_id}/validate")
def validate(topic_id: int):
    is_valid = validate_topic_graph(topic_id)
    return {"topic_id": topic_id, "is_valid_dag": is_valid}

@router.get("/{topic_id}/edges")
def get_edges(topic_id: int):
    from repositories.graph_repo import load_graph_data
    _, edges = load_graph_data(topic_id)
    return {"edges": [{"from": f, "to": t} for f, t in edges]}

@router.get("/concept/{concept_id}")
def get_concept(concept_id: int):
    from repositories.graph_repo import get_concept_by_id
    concept = get_concept_by_id(concept_id)
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")
    return concept
