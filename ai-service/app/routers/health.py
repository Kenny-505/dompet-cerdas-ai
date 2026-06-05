from fastapi import APIRouter

router = APIRouter()

@router.get("/health-score")
async def health_check():
    """
    Temporary endpoint for health score.
    Will be replaced by actual ML model inference in Phase 4.
    """
    return {"status": "ok", "message": "Health score stub ready"}
