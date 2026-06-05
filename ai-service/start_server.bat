@echo off
cd /d "D:\Capstone Dicoding CC26-PSU115\dompet-cerdas-ai\ai-service"
call .\venv\Scripts\activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
