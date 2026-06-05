FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy AI service code
COPY app/ ./app/
# tests/ tidak perlu di-copy untuk production deployment

# Copy model files (now inside ai-service/ml-models/)
COPY ml-models/ ./ml-models/

# Set models directory env var
ENV MODELS_DIR=/app/ml-models

# Expose port
EXPOSE 8000

# Start command - use $PORT from Railway environment
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
