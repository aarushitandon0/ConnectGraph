from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.topics import router as topics_router
from routes.ai import router as ai_router
from routes.roadmap import router as roadmap_router
from routes.auth     import router as auth_router
from routes.progress import router as progress_router

app = FastAPI(title="ConceptGraph API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topics_router, prefix="/topics", tags=["topics"])
app.include_router(ai_router, prefix="/ai", tags=["ai"])
app.include_router(roadmap_router, prefix="/roadmap", tags=["roadmap"])
app.include_router(auth_router,     prefix="/auth",     tags=["auth"])
app.include_router(progress_router, prefix="/progress", tags=["progress"])

@app.get("/")
def root():
    return {"status": "ok", "message": "ConceptGraph API is running"}

