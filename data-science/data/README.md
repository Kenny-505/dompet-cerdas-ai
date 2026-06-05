# Data Artifacts - DompetCerdas AI

## Daftar File

| File | Rows | Deskripsi |
|------|------|-----------|
| `03_clean_final.csv` | 110,320 | Dataset lengkap setelah cleaning + feature engineering |
| `04_monthly_aggregated.csv` | 1,930 | Agregasi per user/bulan (untuk Health Score model) |
| `04_category_pivot.csv` | 1,930 | Pivot spending per kategori per user/bulan (untuk LSTM) |
| `05_train.csv` | 88,178 | Train set (chronological split, 80%) |
| `05_test.csv` | 22,142 | Test set (chronological split, 20%) |
| `scaler.pkl` | - | MinMaxScaler (fit ONLY dari train set) |
| `category_label_mapping.json` | 12 | Mapping kategori → integer |
| `segment_label_mapping.json` | 3 | Mapping segment → integer |
| `payment_label_mapping.json` | 5 | Mapping payment method → integer |
| `data_dictionary.csv` | 36 | Dokumentasi lengkap semua kolom |
| `eda_*.png` | 7 | Visualisasi EDA |
| `ab_testing_result.png` | 1 | Visualisasi A/B Testing |

## ⚠️ ANTI DATA LEAKAGE GUIDE (WAJIB BACA)

### Kolom TARGET (JANGAN masuk ke fitur training!)

| Kolom | Model Target |
|-------|-------------|
| `is_anomaly` | Target untuk **Anomaly Detection** (Autoencoder) |
| `is_synthetic_anomaly` | Flag asli (string), JUGA jangan jadi fitur |

### Kolom yang BOLEH jadi FITUR

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `amount` | numeric | Jumlah transaksi |
| `monthly_income` | numeric | Income user |
| `spending_ratio` | numeric | amount / monthly_income |
| `is_large_transaction` | binary | 1 jika > 50% income |
| `days_since_salary` | numeric | Hari sejak gajian |
| `quarter` | numeric | Kuartal (1-4) |
| `day_of_week` | numeric | 0=Senin, 6=Minggu |
| `is_weekend` | binary | 1 jika Sabtu/Minggu |
| `month` | numeric | Bulan (1-12) |
| `cat_makanan` ... `cat_pendidikan` | binary (7 kolom) | One-hot kategori |
| `segment_encoded` | integer | Label encoded segment |
| `category_encoded` | integer | Label encoded kategori |
| `tx_type_encoded` | integer | Label encoded tipe transaksi |
| `payment_encoded` | integer | Label encoded payment |
| `has_savings` | binary | Punya tabungan |
| `has_debt` | binary | Punya hutang |

### Kolom NON-FITUR (identifiers, bukan target)

| Kolom | Alasan |
|-------|--------|
| `transaction_id` | Identifier unik |
| `user_id` | Identifier user |
| `transaction_date` | Timestamp (sudah diekstrak fiturnya) |
| `description` | Free text |
| `merchant` | Free text |
| `month_year` | Redundan dengan month/year |
| `year` | Bisa dipakai optional |
| `day_of_month` | Bisa dipakai optional |

### Scaler


