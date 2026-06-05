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
COPY tests/ ./tests/

# Copy model files from ml-models sibling directory
# In Railway, we deploy from monorepo root, so ml-models is a sibling
COPY ../ml-models/*.keras ./ml-models/
COPY ../ml-models/*.pkl ./ml-models/
COPY ../ml-models/*.json ./ml-models/

# Set models directory env var
ENV MODELS_DIR=/app/ml-models

# Expose port
EXPOSE 8000

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]