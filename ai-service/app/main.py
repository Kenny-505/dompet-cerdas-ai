import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load env vars
load_dotenv()

# Define API Key header for internal backend communication
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def get_api_key(api_key_header: str = Security(api_key_header)):
    expected_api_key = os.getenv("AI_SERVICE_API_KEY")
    if not expected_api_key:
        # If no key configured in env, allow all (useful for local dev before setup)
        return api_key_header
        
    if api_key_header == expected_api_key:
        return api_key_header
    raise HTTPException(
        status_code=403,
        detail="Could not validate API Key",
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load ML models here (Phase 4)
    print("🚀 Starting AI Service...")
    
    # Load all ML models
    from app.models.loader import model_manager
    load_results = model_manager.load_all_models()
    
    print(f"✅ Model loading complete: {load_results}")
    
    yield
    
    # Shutdown: Clean up resources here
    print("🔌 Shutting down AI Service...")

app = FastAPI(
    title="DompetCerdas AI Service",
    description="Microservice for ML inferences and LLM integration",
    version="1.0.0",
    lifespan=lifespan
    # Auth is applied per-router, not globally, to allow health check bypass
)

# CORS configuration
_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3001,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from app.routers import health, predict, chat
from app.models.loader import model_manager

app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(predict.router, prefix="/api/v1", tags=["Prediction"])
app.include_router(chat.router, prefix="/api/v1", tags=["Chat"])

@app.get("/health", dependencies=[]) # Bypass auth for base health check
async def root_health_check():
    """Base health check for the FastAPI service itself."""
    return {"status": "ok", "service": "dompet-cerdas-ai-service"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
