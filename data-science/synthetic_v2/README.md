# DompetCerdas AI Synthetic Dataset v2

Folder ini berisi generator dan raw dataset sintetis baru yang mengikuti keputusan terbaru pada `Brainstorm/DompetCerdas_AI_Context_Discussion.md`.

## Tujuan

Dataset ini dibuat sebagai **raw foundation**, bukan dataset yang langsung siap training.

Alur yang diharapkan:

```text
raw synthetic data
-> data assessing
-> data cleaning
-> EDA
-> feature engineering
-> export dataset turunan untuk tiap model
```

## File Raw

Generator menghasilkan tiga file utama:

```text
raw/synthetic_users.csv
raw/synthetic_transactions_raw.csv
raw/synthetic_budgets.csv
```

## Target Awal

- 175 user sintetis.
- Periode transaksi 12 bulan: Juni 2025 sampai Mei 2026.
- 3 segment user:
  - `pelajar_mahasiswa`
  - `pekerja_tetap`
  - `freelancer`
- 12 kategori transaksi:
  - pengeluaran: `makanan`, `transportasi`, `belanja`, `tagihan`, `hiburan`, `kesehatan`, `pendidikan`, `kos_sewa`, `lainnya`
  - pemasukan: `gaji`, `freelance_bonus`, `pemasukan_lain`
- 3 akun demo:
  - `demo.empty@dompetcerdas.test`: tidak punya transaksi.
  - `demo.limited@dompetcerdas.test`: punya data terbatas.
  - `demo.ready@dompetcerdas.test`: punya data cukup.

## Catatan Penting

- `category` ada di raw transactions sebagai label untuk CNN auto-kategorisasi.
- `is_synthetic_anomaly` ada untuk evaluasi Autoencoder, tetapi tidak boleh dipakai sebagai target training Autoencoder.
- Health score tidak tersedia di raw dataset. Proxy label health score harus dibuat pada tahap feature engineering user-month.
- Dataset LSTM harus dibuat dari agregasi transaksi bulanan, bukan dibuat langsung manual.
- Data ini tetap harus melewati jobdesc Data Science: assessing, cleaning, EDA, feature engineering, data dictionary, dan dokumentasi.

## Cara Generate

Jalankan dari root workspace atau dari folder ini:

```bash
python "Data Science/synthetic_v2/scripts/generate_raw_synthetic_data.py"
```

Script memakai random seed tetap sehingga output bisa direproduksi.

