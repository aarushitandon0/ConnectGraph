from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.ai_service import generate_roadmap
from graph_engine.dag import ConceptGraph
from repositories.topic_repo import save_generated_topic, get_all_topics

router = APIRouter()

class GenerateRequest(BaseModel):
    topic: str

@router.get("/")
def list_topics():
    return {"topics": get_all_topics()}

@router.post("/generate")
def generate(body: GenerateRequest):
    if not body.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    try:
        data = generate_roadmap(body.topic.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    # Validate DAG before saving
    concepts = {c["id"]: c["name"] for c in data["concepts"]}
    edges    = [(d["from"], d["to"]) for d in data["dependencies"]]
    graph    = ConceptGraph(concepts, edges)

    if not graph.is_valid_dag():
        raise HTTPException(status_code=422, detail="Generated graph contains cycles — please try again")

    topic_id = save_generated_topic(
        data["topic"],
        data["description"],
        data["concepts"],
        data["dependencies"]
    )

    return {
        "topic_id":    topic_id,
        "topic_name":  data["topic"],
        "concept_count": len(data["concepts"]),
        "edge_count":    len(data["dependencies"]),
        "is_valid_dag":  True,
    }