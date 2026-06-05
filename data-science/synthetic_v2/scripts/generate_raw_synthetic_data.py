"""Generate raw synthetic datasets for DompetCerdas AI.

This script creates raw foundation data only:
- synthetic_users.csv
- synthetic_transactions_raw.csv
- synthetic_budgets.csv

The outputs are intentionally not model-ready. Data Science should still run
assessment, cleaning, EDA, feature engineering, and model-specific exports.
"""

from __future__ import annotations

import csv
import math
import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Tuple


SEED = 260523
N_USERS = 175
START_MONTH = date(2025, 6, 1)
END_MONTH = date(2026, 5, 1)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "raw"

EXPENSE_CATEGORIES = [
    "makanan",
    "transportasi",
    "belanja",
    "tagihan",
    "hiburan",
    "kesehatan",
    "pendidikan",
    "kos_sewa",
    "lainnya",
]

INCOME_CATEGORIES = [
    "gaji",
    "freelance_bonus",
    "pemasukan_lain",
]

ALL_CATEGORIES = EXPENSE_CATEGORIES + INCOME_CATEGORIES

PAYMENT_METHODS = ["cash", "debit", "e_wallet", "bank_transfer", "credit_card"]

FIRST_NAMES = [
    "Raka", "Sinta", "Adi", "Nadia", "Bima", "Dewi", "Fajar", "Alya",
    "Rizky", "Maya", "Dimas", "Putri", "Andi", "Tari", "Yoga", "Intan",
    "Bayu", "Citra", "Reno", "Lala", "Ilham", "Rani", "Dika", "Nisa",
]

LAST_NAMES = [
    "Pratama", "Lestari", "Saputra", "Wibowo", "Santoso", "Hidayat",
    "Permata", "Wijaya", "Nugroho", "Ramadhan", "Anggraini", "Kusuma",
]

CITIES = [
    "Jakarta", "Bandung", "Yogyakarta", "Surabaya", "Semarang", "Malang",
    "Medan", "Denpasar", "Bogor", "Depok",
]

SEGMENT_CONFIG = {
    "pelajar_mahasiswa": {
        "income_min": 900_000,
        "income_max": 3_500_000,
        "monthly_tx_min": 24,
        "monthly_tx_max": 42,
        "expense_ratio_min": 0.68,
        "expense_ratio_max": 0.94,
        "category_weights": {
            "makanan": 0.31,
            "transportasi": 0.14,
            "belanja": 0.12,
            "tagihan": 0.07,
            "hiburan": 0.10,
            "kesehatan": 0.04,
            "pendidikan": 0.09,
            "kos_sewa": 0.08,
            "lainnya": 0.05,
        },
    },
    "pekerja_tetap": {
        "income_min": 4_500_000,
        "income_max": 14_000_000,
        "monthly_tx_min": 34,
        "monthly_tx_max": 58,
        "expense_ratio_min": 0.55,
        "expense_ratio_max": 0.88,
        "category_weights": {
            "makanan": 0.25,
            "transportasi": 0.13,
            "belanja": 0.14,
            "tagihan": 0.15,
            "hiburan": 0.09,
            "kesehatan": 0.05,
            "pendidikan": 0.03,
            "kos_sewa": 0.12,
            "lainnya": 0.04,
        },
    },
    "freelancer": {
        "income_min": 3_000_000,
        "income_max": 18_000_000,
        "monthly_tx_min": 28,
        "monthly_tx_max": 54,
        "expense_ratio_min": 0.50,
        "expense_ratio_max": 0.95,
        "category_weights": {
            "makanan": 0.24,
            "transportasi": 0.10,
            "belanja": 0.13,
            "tagihan": 0.13,
            "hiburan": 0.08,
            "kesehatan": 0.05,
            "pendidikan": 0.08,
            "kos_sewa": 0.14,
            "lainnya": 0.05,
        },
    },
}

MERCHANTS = {
    "makanan": [
        "Warteg Bahari", "Nasi Padang Sederhana", "Kopi Kenangan", "Janji Jiwa",
        "Ayam Geprek Bensu", "Bakso Mas Joko", "Indomaret Point", "Kantin Kampus",
    ],
    "transportasi": [
        "Gojek", "Grab", "KRL Commuter", "TransJakarta", "Pertamina",
        "Bluebird", "Parkir Mall", "Bengkel Motor",
    ],
    "belanja": [
        "Tokopedia", "Shopee", "Alfamart", "Indomaret", "Uniqlo",
        "Matahari", "Miniso", "Gramedia",
    ],
    "tagihan": [
        "PLN", "PDAM", "Telkomsel", "Indihome", "Biznet", "BPJS",
        "Pulsa Data", "Pascabayar",
    ],
    "hiburan": [
        "Netflix", "Spotify", "XXI", "CGV", "Timezone", "Steam",
        "Konser Lokal", "Cafe Live Music",
    ],
    "kesehatan": [
        "Apotek K24", "Kimia Farma", "Halodoc", "Klinik Medika",
        "Optik Melawai", "Laboratorium Prodia",
    ],
    "pendidikan": [
        "Dicoding", "Coursera", "Udemy", "Gramedia", "Fotokopi Kampus",
        "Kursus Bahasa", "Perpustakaan",
    ],
    "kos_sewa": [
        "Ibu Kos", "Sewa Apartemen", "Kontrakan Pak Budi", "Co-living Space",
        "Bayar Kos",
    ],
    "lainnya": [
        "Donasi", "Hadiah Teman", "Admin Bank", "Biaya Transfer",
        "Perlengkapan Rumah", "Laundry",
    ],
    "gaji": [
        "PT Nusantara Digital", "PT Maju Bersama", "Kantor Pusat",
        "Kampus Part Time", "Kedai Kopi Tempat Kerja",
    ],
    "freelance_bonus": [
        "Klien Desain", "Klien Website", "Bonus Proyek", "Komisi Affiliate",
        "Upwork Client", "Fiverr Client",
    ],
    "pemasukan_lain": [
        "Uang Saku Orang Tua", "Cashback", "Refund", "Jual Barang Bekas",
        "Transfer Keluarga",
    ],
}

DESCRIPTION_TEMPLATES = {
    "makanan": [
        "beli {item} di {merchant}", "makan siang {merchant}",
        "ngopi di {merchant}", "jajan {item}", "pesan {item} lewat aplikasi",
        "sarapan {item}", "makan malam di {merchant}",
    ],
    "transportasi": [
        "naik {merchant}", "bayar ongkos {merchant}", "isi bensin di {merchant}",
        "top up transport", "parkir di {merchant}", "perjalanan ke kampus",
        "perjalanan ke kantor",
    ],
    "belanja": [
        "belanja bulanan di {merchant}", "beli {item} online",
        "checkout barang di {merchant}", "beli kebutuhan di {merchant}",
        "promo belanja {merchant}", "beli perlengkapan harian",
    ],
    "tagihan": [
        "bayar tagihan {merchant}", "pembayaran {merchant} bulan ini",
        "top up pulsa data", "bayar internet rumah", "bayar listrik kos",
        "bayar iuran {merchant}",
    ],
    "hiburan": [
        "langganan {merchant}", "nonton di {merchant}", "main di {merchant}",
        "beli tiket hiburan", "nongkrong akhir pekan", "top up game",
    ],
    "kesehatan": [
        "beli obat di {merchant}", "konsultasi kesehatan", "bayar klinik",
        "beli vitamin", "cek kesehatan di {merchant}", "tebus resep",
    ],
    "pendidikan": [
        "beli buku di {merchant}", "bayar kursus online", "fotokopi materi kuliah",
        "biaya kelas {merchant}", "langganan belajar", "beli alat tulis",
    ],
    "kos_sewa": [
        "bayar kos bulan ini", "transfer sewa ke {merchant}", "bayar kontrakan",
        "iuran tempat tinggal", "bayar sewa kamar",
    ],
    "lainnya": [
        "biaya admin bank", "transfer kecil", "donasi", "laundry mingguan",
        "beli perlengkapan rumah", "pengeluaran lain-lain",
    ],
    "gaji": [
        "gaji bulanan dari {merchant}", "gaji part time", "salary masuk",
        "pembayaran kerja bulanan", "upah kerja bulan ini",
    ],
    "freelance_bonus": [
        "pembayaran proyek dari {merchant}", "bonus proyek", "fee freelance",
        "komisi kerja sampingan", "termin proyek website", "pembayaran desain",
    ],
    "pemasukan_lain": [
        "uang saku bulanan", "transfer keluarga", "cashback masuk",
        "refund pembelian", "jual barang bekas", "pemasukan tambahan",
    ],
}

ITEMS = {
    "makanan": ["nasi padang", "ayam geprek", "kopi susu", "bakso", "mie ayam", "roti"],
    "belanja": ["baju", "sabun", "sepatu", "tas", "charger", "skincare"],
}


@dataclass
class User:
    user_id: str
    name: str
    email: str
    user_segment: str
    city: str
    monthly_income: int
    has_savings: bool
    has_debt: bool
    created_at: str
    demo_profile: str


def month_range(start: date, end: date) -> List[date]:
    months = []
    current = start
    while current <= end:
        months.append(current)
        year = current.year + (current.month // 12)
        month = (current.month % 12) + 1
        current = date(year, month, 1)
    return months


def end_of_month(month: date) -> date:
    next_year = month.year + (month.month // 12)
    next_month = (month.month % 12) + 1
    return date(next_year, next_month, 1) - timedelta(days=1)


def random_day_in_month(month: date) -> date:
    end_day = end_of_month(month).day
    return date(month.year, month.month, random.randint(1, end_day))


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(value, high))


def rounded_idr(value: float, nearest: int = 1000) -> int:
    return int(round(value / nearest) * nearest)


def slug_name(name: str) -> str:
    return name.lower().replace(" ", ".")


def choose_segment(index: int) -> str:
    if index <= 70:
        return "pelajar_mahasiswa"
    if index <= 140:
        return "pekerja_tetap"
    return "freelancer"


def make_users() -> List[User]:
    users: List[User] = []
    demo_specs = [
        ("user_0001", "Demo Empty", "demo.empty@dompetcerdas.test", "pelajar_mahasiswa", 1_500_000, "no_data", "2026-05-25"),
        ("user_0002", "Demo Limited", "demo.limited@dompetcerdas.test", "pekerja_tetap", 6_500_000, "limited_data", "2026-04-01"),
        ("user_0003", "Demo Ready", "demo.ready@dompetcerdas.test", "freelancer", 9_000_000, "ready_data", "2025-06-01"),
    ]

    for user_id, name, email, segment, income, demo_profile, created_at in demo_specs:
        users.append(
            User(
                user_id=user_id,
                name=name,
                email=email,
                user_segment=segment,
                city=random.choice(CITIES),
                monthly_income=income,
                has_savings=demo_profile != "no_data",
                has_debt=demo_profile == "limited_data",
                created_at=created_at,
                demo_profile=demo_profile,
            )
        )

    used_emails = {user.email for user in users}
    for idx in range(4, N_USERS + 1):
        segment = choose_segment(idx)
        config = SEGMENT_CONFIG[segment]
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        name = f"{first} {last}"
        email_base = slug_name(name)
        email = f"{email_base}{idx}@synthetic.dompetcerdas.test"
        while email in used_emails:
            email = f"{email_base}{idx}{random.randint(10, 99)}@synthetic.dompetcerdas.test"
        used_emails.add(email)

        income = rounded_idr(random.uniform(config["income_min"], config["income_max"]), 50_000)
        created_month_offset = random.choices([0, 1, 2, 3, 6, 9], weights=[70, 8, 7, 6, 5, 4])[0]
        created_month = month_range(START_MONTH, END_MONTH)[created_month_offset]
        created_at = created_month.isoformat()
        users.append(
            User(
                user_id=f"user_{idx:04d}",
                name=name,
                email=email,
                user_segment=segment,
                city=random.choice(CITIES),
                monthly_income=income,
                has_savings=random.random() < (0.62 if segment != "pelajar_mahasiswa" else 0.38),
                has_debt=random.random() < (0.28 if segment == "pekerja_tetap" else 0.16),
                created_at=created_at,
                demo_profile="regular",
            )
        )
    return users


def active_months_for_user(user: User) -> List[date]:
    all_months = month_range(START_MONTH, END_MONTH)
    if user.demo_profile == "no_data":
        return []
    if user.demo_profile == "limited_data":
        return [date(2026, 4, 1), date(2026, 5, 1)]
    if user.demo_profile == "ready_data":
        return all_months

    created = datetime.strptime(user.created_at, "%Y-%m-%d").date()
    return [m for m in all_months if m >= date(created.year, created.month, 1)]


def monthly_income_for(user: User, month: date) -> int:
    base = user.monthly_income
    if user.user_segment == "freelancer":
        seasonal = 1 + 0.18 * math.sin((month.month / 12) * math.tau)
        noise = random.uniform(0.65, 1.35)
        return rounded_idr(base * seasonal * noise, 50_000)
    if user.user_segment == "pelajar_mahasiswa":
        noise = random.uniform(0.90, 1.12)
        return rounded_idr(base * noise, 25_000)
    bonus = 1.0
    if month.month in [4, 12] and random.random() < 0.45:
        bonus += random.uniform(0.12, 0.35)
    return rounded_idr(base * bonus, 50_000)


def category_target_spending(user: User, month: date, income: int) -> Dict[str, int]:
    config = SEGMENT_CONFIG[user.user_segment]
    expense_ratio = random.uniform(config["expense_ratio_min"], config["expense_ratio_max"])
    if month.month in [6, 12]:
        expense_ratio += random.uniform(0.02, 0.08)
    expense_ratio = clamp(expense_ratio, 0.35, 1.05)
    total_expense = income * expense_ratio

    weights = config["category_weights"].copy()
    if user.has_debt:
        weights["tagihan"] += 0.04
        weights["hiburan"] -= 0.02
        weights["belanja"] -= 0.02
    if user.has_savings:
        weights["hiburan"] -= 0.01
        weights["belanja"] -= 0.01
        weights["lainnya"] += 0.02

    total_weight = sum(max(0.01, v) for v in weights.values())
    targets = {}
    for category, weight in weights.items():
        normalized = max(0.01, weight) / total_weight
        category_noise = random.uniform(0.82, 1.18)
        targets[category] = max(0, rounded_idr(total_expense * normalized * category_noise, 1000))
    return targets


def make_description(category: str, merchant: str) -> str:
    template = random.choice(DESCRIPTION_TEMPLATES[category])
    item = random.choice(ITEMS.get(category, ["kebutuhan"]))
    description = template.format(merchant=merchant, item=item)
    if random.random() < 0.08:
        description = description.replace("bayar", "byr").replace("beli", "bli")
    if random.random() < 0.05:
        description = description + " promo"
    return description


def split_amount(total: int, n: int, category: str) -> List[int]:
    if n <= 0 or total <= 0:
        return []
    amounts = []
    remaining = total
    for i in range(n):
        slots_left = n - i
        base = remaining / slots_left
        if category in ["kos_sewa", "tagihan"]:
            factor = random.uniform(0.85, 1.15)
        else:
            factor = random.uniform(0.45, 1.75)
        amount = rounded_idr(base * factor, 1000)
        min_amount = 5_000 if category not in ["kos_sewa", "tagihan"] else 50_000
        amount = max(min_amount, min(amount, remaining - min_amount * (slots_left - 1)))
        amounts.append(amount)
        remaining -= amount
    if remaining > 0:
        amounts[-1] += remaining
    return [max(1000, rounded_idr(a, 1000)) for a in amounts]


def transaction_count_for_category(category: str, target: int, user: User) -> int:
    if target <= 0:
        return 0
    if category in ["kos_sewa"]:
        return 1 if random.random() < 0.95 else 2
    if category == "tagihan":
        return random.randint(2, 5)
    if category == "makanan":
        return random.randint(10, 24)
    if category == "transportasi":
        return random.randint(6, 18)
    if category in ["hiburan", "kesehatan", "pendidikan"]:
        return random.randint(1, 6)
    return random.randint(2, 9)


def income_transactions(user: User, month: date, income: int, tx_counter: int) -> Tuple[List[dict], int]:
    rows = []
    if user.user_segment == "freelancer":
        n = random.randint(2, 6)
        parts = split_amount(income, n, "freelance_bonus")
        category = "freelance_bonus"
    elif user.user_segment == "pelajar_mahasiswa":
        n = random.randint(1, 3)
        parts = split_amount(income, n, "pemasukan_lain")
        category = random.choice(["pemasukan_lain", "gaji"])
    else:
        n = 1
        parts = [income]
        category = "gaji"

    for amount in parts:
        merchant = random.choice(MERCHANTS[category])
        tx_counter += 1
        rows.append(
            {
                "transaction_id": f"tx_{tx_counter:08d}",
                "user_id": user.user_id,
                "transaction_date": random_day_in_month(month).isoformat(),
                "amount": amount,
                "transaction_type": "pemasukan",
                "description": make_description(category, merchant),
                "category": category,
                "merchant": merchant,
                "payment_method": "bank_transfer",
                "is_synthetic_anomaly": "false",
            }
        )
    return rows, tx_counter


def expense_transactions(
    user: User,
    month: date,
    category_targets: Dict[str, int],
    tx_counter: int,
) -> Tuple[List[dict], int]:
    rows = []
    for category, total in category_targets.items():
        n = transaction_count_for_category(category, total, user)
        amounts = split_amount(total, n, category)
        for amount in amounts:
            merchant = random.choice(MERCHANTS[category])
            tx_counter += 1
            rows.append(
                {
                    "transaction_id": f"tx_{tx_counter:08d}",
                    "user_id": user.user_id,
                    "transaction_date": random_day_in_month(month).isoformat(),
                    "amount": amount,
                    "transaction_type": "pengeluaran",
                    "description": make_description(category, merchant),
                    "category": category,
                    "merchant": merchant if random.random() > 0.015 else "",
                    "payment_method": random.choice(PAYMENT_METHODS) if random.random() > 0.01 else "",
                    "is_synthetic_anomaly": "false",
                }
            )
    return rows, tx_counter


def inject_anomaly(rows: List[dict], user: User, month: date, tx_counter: int) -> Tuple[List[dict], int]:
    if user.demo_profile == "no_data":
        return rows, tx_counter
    if random.random() > 0.18 and user.demo_profile != "ready_data":
        return rows, tx_counter

    category = random.choice(["makanan", "hiburan", "belanja", "transportasi", "tagihan"])
    merchant = random.choice(MERCHANTS[category])
    base_amount = {
        "makanan": 420_000,
        "hiburan": 900_000,
        "belanja": 1_250_000,
        "transportasi": 650_000,
        "tagihan": 1_800_000,
    }[category]
    multiplier = random.uniform(0.85, 1.45)
    tx_counter += 1
    rows.append(
        {
            "transaction_id": f"tx_{tx_counter:08d}",
            "user_id": user.user_id,
            "transaction_date": random_day_in_month(month).isoformat(),
            "amount": rounded_idr(base_amount * multiplier, 1000),
            "transaction_type": "pengeluaran",
            "description": make_description(category, merchant),
            "category": category,
            "merchant": merchant,
            "payment_method": random.choice(PAYMENT_METHODS),
            "is_synthetic_anomaly": "true",
        }
    )
    return rows, tx_counter


def make_budgets(user: User, months: Iterable[date]) -> List[dict]:
    rows = []
    config = SEGMENT_CONFIG[user.user_segment]
    weights = config["category_weights"]
    expense_budget_ratio = 0.82 if user.user_segment != "pelajar_mahasiswa" else 0.90
    for month in months:
        income = monthly_income_for(user, month)
        total_budget = income * expense_budget_ratio
        total_weight = sum(weights.values())
        for category in EXPENSE_CATEGORIES:
            allocated = rounded_idr(total_budget * weights[category] / total_weight, 5000)
            rows.append(
                {
                    "budget_id": f"bdg_{user.user_id}_{month.strftime('%Y%m')}_{category}",
                    "user_id": user.user_id,
                    "month": month.strftime("%Y-%m"),
                    "category": category,
                    "allocated_amount": allocated,
                }
            )
    return rows


def write_csv(path: Path, rows: List[dict], fieldnames: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    random.seed(SEED)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    users = make_users()
    transaction_rows: List[dict] = []
    budget_rows: List[dict] = []
    tx_counter = 0

    for user in users:
        months = active_months_for_user(user)
        budget_months = months if months else [END_MONTH]
        budget_rows.extend(make_budgets(user, budget_months))

        for month in months:
            income = monthly_income_for(user, month)
            income_rows, tx_counter = income_transactions(user, month, income, tx_counter)
            transaction_rows.extend(income_rows)

            targets = category_target_spending(user, month, income)
            expense_rows, tx_counter = expense_transactions(user, month, targets, tx_counter)
            transaction_rows.extend(expense_rows)

            transaction_rows, tx_counter = inject_anomaly(transaction_rows, user, month, tx_counter)

    transaction_rows.sort(key=lambda row: (row["user_id"], row["transaction_date"], row["transaction_id"]))

    user_rows = [
        {
            "user_id": user.user_id,
            "name": user.name,
            "email": user.email,
            "user_segment": user.user_segment,
            "city": user.city,
            "monthly_income": user.monthly_income,
            "has_savings": str(user.has_savings).lower(),
            "has_debt": str(user.has_debt).lower(),
            "created_at": user.created_at,
            "demo_profile": user.demo_profile,
        }
        for user in users
    ]

    write_csv(
        OUTPUT_DIR / "synthetic_users.csv",
        user_rows,
        [
            "user_id",
            "name",
            "email",
            "user_segment",
            "city",
            "monthly_income",
            "has_savings",
            "has_debt",
            "created_at",
            "demo_profile",
        ],
    )
    write_csv(
        OUTPUT_DIR / "synthetic_transactions_raw.csv",
        transaction_rows,
        [
            "transaction_id",
            "user_id",
            "transaction_date",
            "amount",
            "transaction_type",
            "description",
            "category",
            "merchant",
            "payment_method",
            "is_synthetic_anomaly",
        ],
    )
    write_csv(
        OUTPUT_DIR / "synthetic_budgets.csv",
        budget_rows,
        ["budget_id", "user_id", "month", "category", "allocated_amount"],
    )

    anomaly_count = sum(1 for row in transaction_rows if row["is_synthetic_anomaly"] == "true")
    print(f"Generated users: {len(user_rows)}")
    print(f"Generated transactions: {len(transaction_rows)}")
    print(f"Generated budgets: {len(budget_rows)}")
    print(f"Synthetic anomaly rows: {anomaly_count}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Categories ({len(ALL_CATEGORIES)}): {', '.join(ALL_CATEGORIES)}")


if __name__ == "__main__":
    main()
