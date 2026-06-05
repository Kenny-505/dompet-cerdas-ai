# DompetCerdas AI - Streamlit Cloud Deployment Guide

## Prerequisites

1. **Akun GitHub** - Pastikan project sudah di-push ke GitHub
2. **Akun Streamlit Cloud** - Daftar di [share.streamlit.io](https://share.streamlit.io)

## Struktur File

```
dompet-cerdas-ai/data-science/
├── streamlit_app.py          # Entry point aplikasi
├── requirements.txt          # Dependencies Python
├── packages.txt              # System dependencies (opsional)
├── .streamlit/
│   └── config.toml          # Konfigurasi Streamlit
├── data/                     # Dataset (harus di-push ke GitHub)
│   ├── 03_clean_final.csv
│   ├── 04_monthly_aggregated.csv
│   ├── 04_category_pivot.csv
│   ├── 05_train.csv
│   ├── 05_test.csv
│   └── ...
└── synthetic_v2/
    └── raw/                  # Raw datasets
```

## Langkah Deployment

### 1. Push ke GitHub

```bash
cd dompet-cerdas-ai/data-science
git add .
git commit -m "Add Streamlit app for deployment"
git push origin main
```

### 2. Deploy ke Streamlit Cloud

1. Buka [share.streamlit.io](https://share.streamlit.io)
2. Login dengan akun GitHub
3. Klik "New app"
4. Pilih repository: `username/dompet-cerdas-ai`
5. **Main file path**: `data-science/streamlit_app.py`
6. Klik "Deploy"

### 3. Environment Variables (Jika Diperlukan)

Jika aplikasi membutuhkan API keys atau secrets:

1. Di Streamlit Cloud dashboard, klik aplikasi → "Settings"
2. Pilih tab "Secrets"
3. Tambahkan secrets dalam format TOML:

```toml
[api]
key = "your-api-key"
```

## Troubleshooting

### Issue: Module Not Found
- Pastikan semua dependencies ada di `requirements.txt`
- TensorFlow membutuhkan spesifikasi versi yang kompatibel

### Issue: File Not Found
- Pastikan folder `data/` dan `synthetic_v2/` di-push ke GitHub
- Cek path di `streamlit_app.py` sudah benar

### Issue: Memory Limit
- Streamlit Cloud free tier memiliki limit 1GB RAM
- Jika dataset terlalu besar, pertimbangkan untuk sampling data

## Dependencies

Dari `requirements.txt`:
- pandas - Data manipulation
- numpy - Numerical computing
- matplotlib - Visualization
- seaborn - Statistical visualization
- scikit-learn - Machine learning utilities
- tensorflow - Deep learning models
- streamlit - Web app framework
- scipy - Scientific computing (untuk A/B testing)

## URL Aplikasi

Setelah deploy, aplikasi akan tersedia di:
```
https://username-dompetcerdas-ai-data-science-streamlit-app-xxxxxx.streamlit.app
```

## Update Aplikasi

Setiap push ke branch yang terdeploy akan otomatis trigger redeploy.

```bash
git add .
git commit -m "Update dashboard"
git push origin main
```

## Fitur Dashboard

- 📊 **Overview**: Summary dataset dan model
- 📁 **Datasets**: Preview raw, clean, dan aggregated data
- 📈 **EDA & Visualisasi**: Interactive charts dan EDA pipeline
- 🔍 **Explanatory Analysis**: 7 pertanyaan bisnis
- 🧪 **A/B Testing**: Simulasi AI recommendation
- 📖 **Data Dictionary**: Dokumentasi kolom
- 🤖 **Model Performance**: Metrics dari semua model
- ⚙️ **Pipeline Info**: Informasi data pipeline

## Catatan Penting

- Aplikasi ini **read-only dashboard**, tidak menyimpan data ke database
- Data berasal dari file CSV yang sudah di-generate
- Untuk update data, jalankan ulang notebook pipeline lalu push ke GitHub
