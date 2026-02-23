from fastapi import APIRouter, Depends
from pydantic import BaseModel
from routes.auth import get_current_user
from repositories.progress_repo import get_mastered, set_mastered

router = APIRouter()

class ToggleBody(BaseModel):
    concept_id: int
    mastered:   bool

@router.get("/{topic_id}")
def load_progress(topic_id: int, user=Depends(get_current_user)):
    ids = get_mastered(user["id"], topic_id)
    return {"mastered_ids": ids}

@router.post("/toggle")
def toggle(body: ToggleBody, user=Depends(get_current_user)):
    set_mastered(user["id"], body.concept_id, body.mastered)
    return {"ok": True}