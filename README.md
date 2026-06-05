# 💰 DompetCerdas AI

> Aplikasi web pengelolaan keuangan cerdas berbasis AI untuk generasi muda Indonesia.

[![Frontend](https://img.shields.io/badge/Frontend-React%2018-61DAFB?logo=react)](./frontend)
[![Backend](https://img.shields.io/badge/Backend-Express.js-339933?logo=node.js)](./backend)
[![AI Service](https://img.shields.io/badge/AI-FastAPI-009688?logo=fastapi)](./ai-service)
[![Database](https://img.shields.io/badge/DB-Supabase%20PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Streamlit](https://img.shields.io/badge/Analytics-Streamlit-FF4B4B?logo=streamlit)](https://dompet-cerdas-ai-kcdbiqytafkyiepznsa475.streamlit.app/)

---

## 📊 Live Dashboard

Akses **Data Science Dashboard** (Streamlit):  
👉 **[https://dompet-cerdas-ai-kcdbiqytafkyiepznsa475.streamlit.app/](https://dompet-cerdas-ai-kcdbiqytafkyiepznsa475.streamlit.app/)**

Dashboard menampilkan:
- 📈 EDA & Visualisasi dataset
- 🔍 Explanatory Analysis (7 pertanyaan bisnis)
- 🧪 A/B Testing simulasi AI recommendation
- 🤖 Model Performance metrics

---

## 🏗️ Arsitektur

```
[Browser] → [Vercel/React] → [Railway/Express /api/v1/*] → [Supabase PostgreSQL]
                                        ↓
                              [Railway/FastAPI AI Service] ← 4 custom ML models
                                        ↓
                              [Groq API] ← AI Financial Assistant
```

## 📁 Struktur Monorepo

```
dompet-cerdas-ai/
├── frontend/         ← React 18 + Vite + Tailwind CSS + Recharts
├── backend/          ← Express.js + Prisma ORM + JWT Auth
│   └── prisma/       ← Schema (11 tabel) + migrations + seed
├── ai-service/       ← FastAPI + TensorFlow (4 custom models)
├── ml-models/        ← Jupyter notebooks + training scripts
├── data-science/     ← Streamlit analytics dashboard
├── docs/             ← Dokumen rancangan proyek
└── .github/          ← CI/CD workflows
```

## 🚀 Fitur Utama

| Fitur | Teknologi |
|-------|-----------|
| 🏷️ Auto-kategorisasi transaksi | CNN 1D (12 kategori fixed) |
| 📈 Prediksi pengeluaran bulan depan | LSTM Time Series |
| 💯 Financial Health Score (0–100) | Dense Neural Network |
| 🚨 Deteksi anomali pengeluaran | Autoencoder |
| 🤖 AI Financial Assistant | Groq API (LLaMA 3.1) + Memory Snapshot |
| 📊 Dashboard analytics | Recharts |
| 💰 Budget Planner 50/30/20 | Per-kategori tracking |

## ⚙️ Tech Stack

| Layer | Stack |
|-------|-------|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Axios, Recharts |
| **Backend** | Express.js 4, Prisma ORM, JWT (bcrypt), express-validator |
| **AI Service** | FastAPI, TensorFlow 2.x, Pydantic, Uvicorn |
| **Database** | PostgreSQL via Supabase (500MB) |
| **LLM** | Groq API — llama-3.1-8b-instant |
| **Deploy** | Vercel (FE), Railway (BE + AI) |

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- npm / pip

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Isi DATABASE_URL di .env
npx prisma migrate dev
npx prisma db seed
node src/server.js
```

### AI Service
```bash
cd ai-service
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## 📋 API Endpoints

Semua endpoint backend: `http://localhost:3001/api/v1/*`
AI Service: `http://localhost:8000/*`

Lihat [docs/Technical_Spec.md](../docs/Technical_Spec.md) untuk detail lengkap.

## ⚠️ Catatan: Model Files (CSV)

File `.csv` dataset tidak disertakan dalam repository karena ukurannya besar. Untuk menjalankan AI service secara lokal, Anda perlu:
1. Menjalankan notebook `data-science/synthetic_v2/notebooks/` untuk menghasilkan dataset
2. Menjalankan training notebook di `ml-models/` untuk menghasilkan model `.keras`
3. Atau mengunduh model yang sudah di-train dari storage eksternal (akan ditambahkan)

> **Production backlog**: Model `.keras` dan `.csv` akan di-deploy ke Railway persistent storage atau Google Drive.

## 👨‍💻 Developer

Proyek Capstone Dicoding — CC26-PSU115
Timeline: 9 Mei – 5 Juni 2026
