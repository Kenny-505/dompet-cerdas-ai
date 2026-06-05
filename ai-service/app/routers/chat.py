"""
Chat endpoint for AI Assistant (Groq integration).
"""
import os
import logging
from fastapi import APIRouter, HTTPException, status, Depends, Security
from fastapi.security import APIKeyHeader
from typing import List, Optional
from pydantic import BaseModel

# API Key authentication
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def get_api_key(api_key_header: str = Security(api_key_header)):
    """Validate API key for protected endpoints."""
    expected_api_key = os.getenv("AI_SERVICE_API_KEY")
    if not expected_api_key:
        return api_key_header  # Allow if no key configured
    if api_key_header == expected_api_key:
        return api_key_header
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Could not validate API Key",
    )

router = APIRouter(
    prefix="/chat", 
    tags=["Chat"],
    dependencies=[Depends(get_api_key)]  # Require API key for chat endpoints
)

logger = logging.getLogger(__name__)

# Groq API configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# System prompt for financial assistant
SYSTEM_PROMPT = """Kamu adalah DompetCerdas AI Assistant, asisten keuangan personal yang ramah dan membantu.

Pedoman:
- Berikan saran keuangan yang praktis dan mudah dipahami
- Gunakan data snapshot keuangan user untuk memberikan jawaban yang relevan
- Jangan membuat angka atau data yang tidak ada di snapshot
- Jika user menanyakan hal di luar keuangan, arahkan kembali ke topik keuangan
- Jawab dalam Bahasa Indonesia yang santun dan profesional
- Jika data tidak cukup, sarankan user untuk menambah transaksi atau budget

Snapshot Data Keuangan User akan diberikan dalam pesan dengan format [DATA SNAPSHOT].
Gunakan data ini untuk memberikan jawaban yang personal."""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    financial_context: str = ""


class ChatResponse(BaseModel):
    reply: str


@router.post(
    "",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Chat with AI Assistant",
    description="Send a message to the AI assistant and receive a response based on user's financial context.",
)
async def chat(request: ChatRequest):
    """
    Chat endpoint that integrates with Groq API.
    
    The financial context (Memory Snapshot) is passed from the backend
    and used to provide personalized financial advice.
    """
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not configured, using fallback")
        return ChatResponse(reply=_get_fallback_response(request.message))
    
    try:
        import httpx
        
        # Build messages array for Groq
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
        ]
        
        # Add financial context as user data
        if request.financial_context:
            messages.append({
                "role": "system", 
                "content": f"[DATA SNAPSHOT]\n{request.financial_context}\n[/DATA SNAPSHOT]"
            })
        
        # Add conversation history
        for msg in request.history:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Add current message
        messages.append({
            "role": "user",
            "content": request.message
        })
        
        # Call Groq API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "max_tokens": 1000,
                    "temperature": 0.7,
                },
            )
            
            if response.status_code != 200:
                logger.error(f"Groq API error: {response.status_code} - {response.text}")
                return ChatResponse(reply=_get_fallback_response(request.message))
            
            data = response.json()
            reply = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            if not reply:
                logger.warning("Empty reply from Groq")
                return ChatResponse(reply=_get_fallback_response(request.message))
            
            return ChatResponse(reply=reply.strip())
            
    except httpx.TimeoutException:
        logger.error("Groq API timeout")
        return ChatResponse(reply="Maaf, waktu respons habis. Silakan coba lagi.")
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return ChatResponse(reply=_get_fallback_response(request.message))


def _get_fallback_response(message: str) -> str:
    """Generate a fallback response when Groq API is unavailable."""
    message_lower = message.lower()
    
    # Keyword-based fallback responses
    if any(kw in message_lower for kw in ["pengeluaran", "spending", "keluar"]):
        return "Saya tidak dapat mengakses data pengeluaran Anda saat ini. Pastikan Anda telah mencatat transaksi dan coba lagi nanti."
    
    if any(kw in message_lower for kw in ["budget", "anggaran", "pengaturan"]):
        return "Untuk mengatur budget, kunjungi halaman Budget Planner. Saya dapat membantu memberikan saran pengaturan budget setelah layanan kembali normal."
    
    if any(kw in message_lower for kw in ["health", "kesehatan", "skor"]):
        return "Health Score Anda dapat dilihat di Dashboard. Saya akan dapat memberikan analisis lebih detail setelah layanan kembali normal."
    
    if any(kw in message_lower for kw in ["prediksi", "prediction", "ramalan"]):
        return "Fitur prediksi pengeluaran akan aktif setelah Anda memiliki minimal 3 bulan data transaksi."
    
    if any(kw in message_lower for kw in ["anomali", "tidak biasa", "mencurigakan"]):
        return "Anomali transaksi ditandai otomatis oleh sistem. Cek halaman Anomali untuk melihat transaksi yang ditandai."
    
    if any(kw in message_lower for kw in ["halo", "hai", "hi", "hello"]):
        return "Halo! Saya DompetCerdas AI Assistant. Saya siap membantu Anda mengelola keuangan. Saat ini layanan AI terbatas, tetapi saya tetap dapat membantu dengan informasi dasar."
    
    return "Maaf, asisten AI sedang tidak tersedia. Silakan coba lagi nanti atau hubungi support jika masalah berlanjut."


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Health check for chat service",
)
async def chat_health():
    """Check if chat service is available."""
    if GROQ_API_KEY:
        return {
            "status": "available",
            "model": GROQ_MODEL,
            "groq_configured": True
        }
    else:
        return {
            "status": "fallback",
            "model": "keyword-based-fallback",
            "groq_configured": False
        }