"""Prepare DompetCerdas AI synthetic v2 Data Science artifacts.

This script turns the raw foundation dataset into clean datasets, exploratory
reports, notebooks, and model-specific derived datasets. It does not train any
model and keeps demo users out of main training splits.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "raw"
PROCESSED_DIR = ROOT / "processed"
REPORTS_DIR = ROOT / "reports"
NOTEBOOKS_DIR = ROOT / "notebooks"

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
INCOME_CATEGORIES = ["gaji", "freelance_bonus", "pemasukan_lain"]
ALL_CATEGORIES = EXPENSE_CATEGORIES + INCOME_CATEGORIES
USER_SEGMENTS = ["pelajar_mahasiswa", "pekerja_tetap", "freelancer"]
DEMO_PROFILES = ["no_data", "limited_data", "ready_data", "regular"]
PAYMENT_METHODS = ["cash", "debit", "e_wallet", "bank_transfer", "credit_card", "unknown"]
RANDOM_SEED = 260523


def ensure_dirs() -> None:
    for path in [PROCESSED_DIR, REPORTS_DIR, NOTEBOOKS_DIR]:
        path.mkdir(parents=True, exist_ok=True)


def clean_text(value: object) -> str:
    text = "" if pd.isna(value) else str(value)
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9_\s./-]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def bool_series(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().str.lower().map({"true": True, "false": False})


def load_raw() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    users = pd.read_csv(RAW_DIR / "synthetic_users.csv")
    transactions = pd.read_csv(RAW_DIR / "synthetic_transactions_raw.csv")
    budgets = pd.read_csv(RAW_DIR / "synthetic_budgets.csv")
    return users, transactions, budgets


def value_counts_table(series: pd.Series, name: str) -> pd.DataFrame:
    return (
        series.value_counts(dropna=False)
        .rename_axis(name)
        .reset_index(name="count")
        .sort_values("count", ascending=False)
    )


def assess_raw(users: pd.DataFrame, transactions: pd.DataFrame, budgets: pd.DataFrame) -> dict[str, object]:
    user_ids = set(users["user_id"])
    transaction_categories = set(transactions["category"].dropna())
    budget_categories = set(budgets["category"].dropna())

    summary: dict[str, object] = {
        "shape": {
            "users": users.shape,
            "transactions": transactions.shape,
            "budgets": budgets.shape,
        },
        "missing": {
            "users": users.isna().sum().to_dict(),
            "transactions": transactions.isna().sum().to_dict(),
            "budgets": budgets.isna().sum().to_dict(),
        },
        "duplicates": {
            "users_rows": int(users.duplicated().sum()),
            "transactions_rows": int(transactions.duplicated().sum()),
            "budgets_rows": int(budgets.duplicated().sum()),
            "user_id": int(users["user_id"].duplicated().sum()),
            "transaction_id": int(transactions["transaction_id"].duplicated().sum()),
            "budget_id": int(budgets["budget_id"].duplicated().sum()),
        },
        "foreign_key_issues": {
            "transaction_user_id_missing": int((~transactions["user_id"].isin(user_ids)).sum()),
            "budget_user_id_missing": int((~budgets["user_id"].isin(user_ids)).sum()),
        },
        "category_issues": {
            "transaction_unknown_categories": sorted(transaction_categories - set(ALL_CATEGORIES)),
            "budget_unknown_categories": sorted(budget_categories - set(EXPENSE_CATEGORIES)),
        },
        "amount_ranges": {
            "transaction_amount_min": float(pd.to_numeric(transactions["amount"], errors="coerce").min()),
            "transaction_amount_max": float(pd.to_numeric(transactions["amount"], errors="coerce").max()),
            "budget_allocated_min": float(pd.to_numeric(budgets["allocated_amount"], errors="coerce").min()),
            "budget_allocated_max": float(pd.to_numeric(budgets["allocated_amount"], errors="coerce").max()),
            "monthly_income_min": float(pd.to_numeric(users["monthly_income"], errors="coerce").min()),
            "monthly_income_max": float(pd.to_numeric(users["monthly_income"], errors="coerce").max()),
        },
        "distributions": {
            "user_segment": value_counts_table(users["user_segment"], "user_segment").to_dict("records"),
            "demo_profile": value_counts_table(users["demo_profile"], "demo_profile").to_dict("records"),
            "transaction_type": value_counts_table(transactions["transaction_type"], "transaction_type").to_dict("records"),
            "category": value_counts_table(transactions["category"], "category").to_dict("records"),
            "is_synthetic_anomaly": value_counts_table(
                transactions["is_synthetic_anomaly"], "is_synthetic_anomaly"
            ).to_dict("records"),
        },
    }
    return summary


def clean_datasets(
    users: pd.DataFrame, transactions: pd.DataFrame, budgets: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    users_clean = users.copy()
    for column in ["user_id", "name", "email", "user_segment", "city", "demo_profile"]:
        users_clean[column] = users_clean[column].astype(str).str.strip()
    users_clean["monthly_income"] = pd.to_numeric(users_clean["monthly_income"], errors="coerce")
    users_clean["has_savings"] = bool_series(users_clean["has_savings"])
    users_clean["has_debt"] = bool_series(users_clean["has_debt"])
    users_clean["created_at"] = pd.to_datetime(users_clean["created_at"], errors="coerce")
    users_clean = users_clean[
        users_clean["user_segment"].isin(USER_SEGMENTS)
        & users_clean["demo_profile"].isin(DEMO_PROFILES)
        & users_clean["monthly_income"].gt(0)
        & users_clean["created_at"].notna()
    ].copy()
    users_clean["monthly_income"] = users_clean["monthly_income"].round().astype("int64")
    users_clean["created_at"] = users_clean["created_at"].dt.strftime("%Y-%m-%d")

    valid_users = set(users_clean["user_id"])
    transactions_clean = transactions.copy()
    for column in [
        "transaction_id",
        "user_id",
        "transaction_type",
        "description",
        "category",
        "merchant",
        "payment_method",
    ]:
        transactions_clean[column] = transactions_clean[column].fillna("").astype(str).str.strip()
    transactions_clean["amount"] = pd.to_numeric(transactions_clean["amount"], errors="coerce")
    transactions_clean["transaction_date"] = pd.to_datetime(
        transactions_clean["transaction_date"], errors="coerce"
    )
    transactions_clean["is_synthetic_anomaly"] = bool_series(
        transactions_clean["is_synthetic_anomaly"]
    ).fillna(False)
    transactions_clean["merchant"] = transactions_clean["merchant"].replace("", "unknown")
    transactions_clean["payment_method"] = transactions_clean["payment_method"].replace("", "unknown")
    transactions_clean["clean_description"] = transactions_clean["description"].map(clean_text)
    transactions_clean = transactions_clean[
        transactions_clean["user_id"].isin(valid_users)
        & transactions_clean["transaction_type"].isin(["pemasukan", "pengeluaran"])
        & transactions_clean["category"].isin(ALL_CATEGORIES)
        & transactions_clean["amount"].gt(0)
        & transactions_clean["transaction_date"].notna()
        & transactions_clean["clean_description"].ne("")
    ].copy()
    transactions_clean["amount"] = transactions_clean["amount"].round().astype("int64")
    transactions_clean["transaction_date"] = transactions_clean["transaction_date"].dt.strftime("%Y-%m-%d")
    transactions_clean["transaction_month"] = transactions_clean["transaction_date"].str.slice(0, 7)

    budgets_clean = budgets.copy()
    for column in ["budget_id", "user_id", "month", "category"]:
        budgets_clean[column] = budgets_clean[column].fillna("").astype(str).str.strip()
    budgets_clean["allocated_amount"] = pd.to_numeric(budgets_clean["allocated_amount"], errors="coerce")
    budgets_clean["month_dt"] = pd.to_datetime(budgets_clean["month"] + "-01", errors="coerce")
    budgets_clean = budgets_clean[
        budgets_clean["user_id"].isin(valid_users)
        & budgets_clean["category"].isin(EXPENSE_CATEGORIES)
        & budgets_clean["allocated_amount"].gt(0)
        & budgets_clean["month_dt"].notna()
    ].copy()
    budgets_clean["allocated_amount"] = budgets_clean["allocated_amount"].round().astype("int64")
    budgets_clean["month"] = budgets_clean["month_dt"].dt.strftime("%Y-%m")
    budgets_clean = budgets_clean.drop(columns=["month_dt"])

    return users_clean, transactions_clean, budgets_clean


def write_assessment_report(summary: dict[str, object]) -> None:
    lines = [
        "# Data Assessing Summary",
        "",
        "## Shapes",
    ]
    for name, shape in summary["shape"].items():
        lines.append(f"- {name}: {shape[0]} rows x {shape[1]} columns")
    lines.extend(["", "## Duplicate Checks"])
    for key, value in summary["duplicates"].items():
        lines.append(f"- {key}: {value}")
    lines.extend(["", "## Foreign Key Issues"])
    for key, value in summary["foreign_key_issues"].items():
        lines.append(f"- {key}: {value}")
    lines.extend(["", "## Category Issues"])
    for key, value in summary["category_issues"].items():
        lines.append(f"- {key}: {value if value else 'none'}")
    lines.extend(["", "## Amount Ranges"])
    for key, value in summary["amount_ranges"].items():
        lines.append(f"- {key}: {value:,.0f}")
    lines.extend(["", "## Cleaning Decisions"])
    lines.extend(
        [
            "- Parse date columns into ISO date/month values.",
            "- Normalize boolean columns into true/false values.",
            "- Convert numeric amount fields to integer IDR values.",
            "- Fill missing merchant/payment_method with `unknown`.",
            "- Keep only v2 categories and valid user_id relationships.",
            "- Add `clean_description` as lowercased normalized text for NLP features.",
        ]
    )
    (REPORTS_DIR / "assessing_summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def save_clean_datasets(users: pd.DataFrame, transactions: pd.DataFrame, budgets: pd.DataFrame) -> None:
    users.to_csv(PROCESSED_DIR / "clean_users.csv", index=False)
    transactions.to_csv(PROCESSED_DIR / "clean_transactions.csv", index=False)
    budgets.to_csv(PROCESSED_DIR / "clean_budgets.csv", index=False)


def simple_bar_svg(data: pd.Series, title: str, path: Path, width: int = 900, height: int = 420) -> None:
    data = data.sort_values(ascending=False).head(12)
    max_value = float(data.max()) if len(data) else 1.0
    margin_left = 190
    margin_top = 55
    row_h = 28
    usable_w = width - margin_left - 80
    rows = []
    for idx, (label, value) in enumerate(data.items()):
        y = margin_top + idx * row_h
        bar_w = 0 if max_value == 0 else (float(value) / max_value) * usable_w
        safe_label = str(label).replace("&", "&amp;")
        rows.append(
            f'<text x="12" y="{y + 18}" font-size="13" fill="#334155">{safe_label}</text>'
            f'<rect x="{margin_left}" y="{y}" width="{bar_w:.1f}" height="18" fill="#059669" rx="3" />'
            f'<text x="{margin_left + bar_w + 8:.1f}" y="{y + 14}" font-size="12" fill="#475569">{float(value):,.0f}</text>'
        )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        f'<rect width="100%" height="100%" fill="#ffffff" />'
        f'<text x="12" y="28" font-size="20" font-weight="700" fill="#0f172a">{title}</text>'
        + "".join(rows)
        + "</svg>"
    )
    path.write_text(svg, encoding="utf-8")


def build_eda(users: pd.DataFrame, transactions: pd.DataFrame, budgets: pd.DataFrame) -> None:
    tx = transactions.merge(users[["user_id", "user_segment", "monthly_income"]], on="user_id", how="left")
    expenses = tx[tx["transaction_type"] == "pengeluaran"].copy()
    income = tx[tx["transaction_type"] == "pemasukan"].copy()

    segment_counts = users["user_segment"].value_counts()
    monthly_tx = tx.groupby("transaction_month").size()
    expense_by_category = expenses.groupby("category")["amount"].sum().sort_values(ascending=False)
    top_category_segment = (
        expenses.groupby(["user_segment", "category"])["amount"]
        .sum()
        .reset_index()
        .sort_values(["user_segment", "amount"], ascending=[True, False])
    )
    top_category_segment.to_csv(REPORTS_DIR / "top_category_by_segment.csv", index=False)

    income_vs_expense = (
        pd.concat(
            [
                income.groupby("transaction_month")["amount"].sum().rename("total_income"),
                expenses.groupby("transaction_month")["amount"].sum().rename("total_expense"),
            ],
            axis=1,
        )
        .fillna(0)
        .reset_index()
    )
    income_vs_expense.to_csv(REPORTS_DIR / "income_vs_expense_monthly.csv", index=False)

    spent = (
        expenses.groupby(["user_id", "transaction_month", "category"])["amount"]
        .sum()
        .reset_index(name="spent_amount")
        .rename(columns={"transaction_month": "month"})
    )
    budget_util = budgets.merge(spent, on=["user_id", "month", "category"], how="left")
    budget_util["spent_amount"] = budget_util["spent_amount"].fillna(0)
    budget_util["budget_utilization"] = budget_util["spent_amount"] / budget_util["allocated_amount"]
    budget_util_summary = (
        budget_util.groupby("category")
        .agg(
            avg_budget_utilization=("budget_utilization", "mean"),
            over_80_rate=("budget_utilization", lambda s: float((s > 0.8).mean())),
            over_budget_rate=("budget_utilization", lambda s: float((s > 1.0).mean())),
        )
        .reset_index()
    )
    budget_util_summary.to_csv(REPORTS_DIR / "budget_utilization_summary.csv", index=False)

    anomaly_distribution = expenses["is_synthetic_anomaly"].value_counts().rename_axis("is_synthetic_anomaly").reset_index(name="count")
    anomaly_distribution.to_csv(REPORTS_DIR / "anomaly_distribution.csv", index=False)

    simple_bar_svg(segment_counts, "Distribusi User per Segment", REPORTS_DIR / "chart_segment_distribution.svg")
    simple_bar_svg(monthly_tx, "Jumlah Transaksi per Bulan", REPORTS_DIR / "chart_transactions_per_month.svg")
    simple_bar_svg(expense_by_category, "Total Pengeluaran per Kategori", REPORTS_DIR / "chart_expense_by_category.svg")

    lines = [
        "# EDA and Explanatory Analysis Summary",
        "",
        "## Business Questions",
        "1. Kategori apa yang paling banyak menyumbang pengeluaran user?",
        "2. Apakah pola pengeluaran berbeda antar segment user?",
        "3. Seberapa sering user melewati budget kategori tertentu?",
        "4. Apakah user dengan income tidak tetap memiliki volatility pengeluaran lebih tinggi?",
        "5. Kategori apa yang paling sering menghasilkan transaksi tidak biasa?",
        "",
        "## Key Findings",
        f"- Segment terbesar: `{segment_counts.idxmax()}` dengan {int(segment_counts.max())} user.",
        f"- Kategori pengeluaran terbesar: `{expense_by_category.idxmax()}` dengan total Rp {int(expense_by_category.max()):,}.",
        f"- Bulan dengan transaksi terbanyak: `{monthly_tx.idxmax()}` dengan {int(monthly_tx.max())} transaksi.",
        f"- Total transaksi anomaly sintetis: {int(expenses['is_synthetic_anomaly'].sum())}.",
        "- Detail table tersedia di CSV report dan chart SVG pada folder `reports/`.",
        "",
        "## Output Reports",
        "- `top_category_by_segment.csv`",
        "- `income_vs_expense_monthly.csv`",
        "- `budget_utilization_summary.csv`",
        "- `anomaly_distribution.csv`",
        "- `chart_segment_distribution.svg`",
        "- `chart_transactions_per_month.svg`",
        "- `chart_expense_by_category.svg`",
    ]
    (REPORTS_DIR / "eda_summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def deterministic_split(values: pd.Series, train_cut: float = 0.70, val_cut: float = 0.85) -> pd.Series:
    hashed = pd.util.hash_pandas_object(values.astype(str), index=False).astype("uint64")
    ratio = (hashed % 10_000) / 10_000
    return pd.Series(np.where(ratio < train_cut, "train", np.where(ratio < val_cut, "validation", "test")), index=values.index)


def build_cnn_dataset(users: pd.DataFrame, transactions: pd.DataFrame) -> pd.DataFrame:
    df = transactions.merge(users[["user_id", "demo_profile"]], on="user_id", how="left")
    df = df[df["category"].isin(ALL_CATEGORIES)].copy()
    df["amount_scaled_log"] = np.log1p(df["amount"])
    df["split"] = "demo_holdout"
    regular_mask = df["demo_profile"].eq("regular")
    rng = np.random.default_rng(RANDOM_SEED)
    random_values = pd.Series(rng.random(len(df)), index=df.index)
    df.loc[regular_mask, "split"] = "train"
    for _, category_idx in df[regular_mask].groupby("category").groups.items():
        ordered = random_values.loc[category_idx].sort_values().index
        n = len(ordered)
        train_end = int(n * 0.80)
        val_end = int(n * 0.90)
        df.loc[ordered[:train_end], "split"] = "train"
        df.loc[ordered[train_end:val_end], "split"] = "validation"
        df.loc[ordered[val_end:], "split"] = "test"
    category_counts = df[df["split"].ne("demo_holdout")]["category"].value_counts()
    max_count = category_counts.max()
    df["class_weight"] = df["category"].map(lambda c: round(float(max_count / category_counts.get(c, max_count)), 6))
    columns = [
        "transaction_id",
        "user_id",
        "description",
        "clean_description",
        "amount",
        "amount_scaled_log",
        "transaction_type",
        "category",
        "split",
        "class_weight",
    ]
    output = df[columns].copy()
    output.to_csv(PROCESSED_DIR / "dataset_cnn_category.csv", index=False)
    return output


def lstm_split(target_month: str) -> str:
    if target_month <= "2026-02":
        return "train"
    if target_month <= "2026-04":
        return "validation"
    return "test"


def build_lstm_dataset(users: pd.DataFrame, transactions: pd.DataFrame) -> pd.DataFrame:
    expense = transactions[transactions["transaction_type"].eq("pengeluaran")].copy()
    expense = expense.merge(users[["user_id", "monthly_income", "demo_profile"]], on="user_id", how="left")
    monthly = (
        expense.groupby(["user_id", "transaction_month", "category"])["amount"]
        .sum()
        .unstack(fill_value=0)
        .reindex(columns=EXPENSE_CATEGORIES, fill_value=0)
        .reset_index()
        .rename(columns={"transaction_month": "month"})
    )
    user_meta = users[["user_id", "monthly_income", "demo_profile"]].set_index("user_id")
    rows: list[dict[str, object]] = []
    for user_id, group in monthly.groupby("user_id"):
        group = group.sort_values("month").reset_index(drop=True)
        if len(group) < 4:
            continue
        meta = user_meta.loc[user_id]
        income_value = float(meta["monthly_income"])
        for idx in range(3, len(group)):
            window = group.iloc[idx - 3 : idx]
            target = group.iloc[idx]
            row: dict[str, object] = {
                "user_id": user_id,
                "input_month_1": window.iloc[0]["month"],
                "input_month_2": window.iloc[1]["month"],
                "input_month_3": window.iloc[2]["month"],
                "target_month": target["month"],
                "normalization_base": int(income_value),
                "split": "demo_holdout" if meta["demo_profile"] != "regular" else lstm_split(str(target["month"])),
            }
            for pos, (_, month_row) in enumerate(window.iterrows(), start=1):
                for category in EXPENSE_CATEGORIES:
                    amount = float(month_row[category])
                    row[f"input_m{pos}_{category}"] = int(amount)
                    row[f"input_m{pos}_{category}_income_ratio"] = round(amount / income_value, 8)
            for category in EXPENSE_CATEGORIES:
                amount = float(target[category])
                row[f"target_{category}"] = int(amount)
                row[f"target_{category}_income_ratio"] = round(amount / income_value, 8)
            rows.append(row)
    output = pd.DataFrame(rows)
    output.to_csv(PROCESSED_DIR / "dataset_lstm_monthly_spending.csv", index=False)
    return output


def score_from_ratio(value: float, good_upper: float, bad_upper: float) -> float:
    if value <= good_upper:
        return 100.0
    if value >= bad_upper:
        return 30.0
    return 100.0 - ((value - good_upper) / (bad_upper - good_upper)) * 70.0


def build_health_dataset(users: pd.DataFrame, transactions: pd.DataFrame, budgets: pd.DataFrame) -> pd.DataFrame:
    tx = transactions.merge(users[["user_id", "user_segment", "monthly_income", "has_savings", "has_debt", "demo_profile"]], on="user_id", how="left")
    monthly = (
        tx.groupby(["user_id", "transaction_month", "transaction_type"])["amount"]
        .sum()
        .unstack(fill_value=0)
        .reset_index()
        .rename(columns={"transaction_month": "month", "pemasukan": "total_income", "pengeluaran": "total_expense"})
    )
    if "total_income" not in monthly:
        monthly["total_income"] = 0
    if "total_expense" not in monthly:
        monthly["total_expense"] = 0

    n_tx = tx.groupby(["user_id", "transaction_month"]).size().reset_index(name="n_transactions").rename(columns={"transaction_month": "month"})
    top_category = (
        tx[tx["transaction_type"].eq("pengeluaran")]
        .groupby(["user_id", "transaction_month", "category"])["amount"]
        .sum()
        .reset_index()
    )
    top_category["month_total"] = top_category.groupby(["user_id", "transaction_month"])["amount"].transform("sum")
    top_category["category_ratio"] = top_category["amount"] / top_category["month_total"]
    top_category_ratio = (
        top_category.groupby(["user_id", "transaction_month"])["category_ratio"]
        .max()
        .reset_index(name="top_category_ratio")
        .rename(columns={"transaction_month": "month"})
    )

    spent = (
        tx[tx["transaction_type"].eq("pengeluaran")]
        .groupby(["user_id", "transaction_month", "category"])["amount"]
        .sum()
        .reset_index(name="spent_amount")
        .rename(columns={"transaction_month": "month"})
    )
    budget_util = budgets.merge(spent, on=["user_id", "month", "category"], how="left")
    budget_util["spent_amount"] = budget_util["spent_amount"].fillna(0)
    budget_util["budget_utilization"] = budget_util["spent_amount"] / budget_util["allocated_amount"]
    budget_month = budget_util.groupby(["user_id", "month"])["budget_utilization"].mean().reset_index()

    df = monthly.merge(n_tx, on=["user_id", "month"], how="left")
    df = df.merge(top_category_ratio, on=["user_id", "month"], how="left")
    df = df.merge(budget_month, on=["user_id", "month"], how="left")
    df = df.merge(users[["user_id", "user_segment", "monthly_income", "has_savings", "has_debt", "demo_profile"]], on="user_id", how="left")
    df = df.sort_values(["user_id", "month"]).reset_index(drop=True)
    df["total_income"] = df["total_income"].fillna(0)
    df["total_expense"] = df["total_expense"].fillna(0)
    df["n_transactions"] = df["n_transactions"].fillna(0).astype("int64")
    df["top_category_ratio"] = df["top_category_ratio"].fillna(0)
    df["budget_utilization"] = df["budget_utilization"].fillna(0)
    df["income_baseline"] = df[["total_income", "monthly_income"]].max(axis=1).replace(0, np.nan)
    df["spending_ratio"] = (df["total_expense"] / df["income_baseline"]).fillna(0)
    df["savings_ratio"] = ((df["income_baseline"] - df["total_expense"]).clip(lower=0) / df["income_baseline"]).fillna(0)
    df["expense_volatility"] = (
        df.groupby("user_id")["total_expense"]
        .transform(lambda s: s.rolling(3, min_periods=1).std().fillna(0) / s.rolling(3, min_periods=1).mean().replace(0, np.nan))
        .fillna(0)
    )
    df["debt_ratio"] = np.where(df["has_debt"], 0.18, 0.0)

    component_rows = []
    for _, row in df.iterrows():
        segment = row["user_segment"]
        spending_good = {"pelajar_mahasiswa": 0.86, "pekerja_tetap": 0.72, "freelancer": 0.78}[segment]
        spending_bad = {"pelajar_mahasiswa": 1.05, "pekerja_tetap": 0.95, "freelancer": 1.05}[segment]
        savings_good = {"pelajar_mahasiswa": 0.08, "pekerja_tetap": 0.18, "freelancer": 0.15}[segment]
        cashflow_score = score_from_ratio(float(row["spending_ratio"]), spending_good, spending_bad)
        budget_score = score_from_ratio(float(row["budget_utilization"]), 0.80, 1.15)
        savings_score = min(100.0, max(30.0, (float(row["savings_ratio"]) / savings_good) * 100.0))
        stability_score = score_from_ratio(float(row["expense_volatility"]), 0.12, 0.55)
        debt_score = 100.0 if not bool(row["has_debt"]) else score_from_ratio(float(row["debt_ratio"]), 0.10, 0.35)
        health_score = (
            cashflow_score * 0.30
            + budget_score * 0.25
            + savings_score * 0.20
            + stability_score * 0.15
            + debt_score * 0.10
        )
        reasons = []
        if row["spending_ratio"] > spending_good:
            reasons.append("spending_ratio_above_segment_threshold")
        if row["budget_utilization"] > 0.80:
            reasons.append("budget_utilization_above_80_percent")
        if row["savings_ratio"] < savings_good:
            reasons.append("savings_ratio_below_segment_target")
        if row["expense_volatility"] > 0.25:
            reasons.append("expense_volatility_high")
        component_rows.append(
            {
                "cashflow_score": round(cashflow_score, 3),
                "budget_discipline_score": round(budget_score, 3),
                "savings_readiness_score": round(savings_score, 3),
                "spending_stability_score": round(stability_score, 3),
                "debt_risk_score": round(debt_score, 3),
                "health_score": round(min(100.0, max(0.0, health_score)), 3),
                "primary_explanation_codes": "|".join(reasons) if reasons else "healthy_baseline",
            }
        )
    components = pd.DataFrame(component_rows)
    df = pd.concat([df, components], axis=1)
    df["split"] = "demo_holdout"
    regular = df["demo_profile"].eq("regular")
    df.loc[regular, "split"] = deterministic_split(df.loc[regular, "user_id"])

    output_columns = [
        "user_id",
        "month",
        "user_segment",
        "monthly_income",
        "total_income",
        "total_expense",
        "spending_ratio",
        "savings_ratio",
        "budget_utilization",
        "has_savings",
        "has_debt",
        "debt_ratio",
        "expense_volatility",
        "n_transactions",
        "top_category_ratio",
        "cashflow_score",
        "budget_discipline_score",
        "savings_readiness_score",
        "spending_stability_score",
        "debt_risk_score",
        "health_score",
        "primary_explanation_codes",
        "split",
    ]
    output = df[output_columns].copy()
    output.to_csv(PROCESSED_DIR / "dataset_health_score_user_month.csv", index=False)
    return output


def build_autoencoder_dataset(users: pd.DataFrame, transactions: pd.DataFrame, budgets: pd.DataFrame) -> pd.DataFrame:
    df = transactions[transactions["transaction_type"].eq("pengeluaran")].copy()
    df = df.merge(users[["user_id", "monthly_income", "demo_profile"]], on="user_id", how="left")
    df["transaction_date_dt"] = pd.to_datetime(df["transaction_date"])
    df["day_of_week"] = df["transaction_date_dt"].dt.dayofweek
    df["day_of_month"] = df["transaction_date_dt"].dt.day
    df["category_id"] = df["category"].map({category: idx for idx, category in enumerate(EXPENSE_CATEGORIES)})
    df["payment_method"] = df["payment_method"].where(df["payment_method"].isin(PAYMENT_METHODS), "unknown")
    df["payment_method_id"] = df["payment_method"].map({method: idx for idx, method in enumerate(PAYMENT_METHODS)})

    reference = df[df["demo_profile"].eq("regular") & ~df["is_synthetic_anomaly"]].copy()
    user_avg = reference.groupby("user_id")["amount"].mean()
    category_avg = reference.groupby("category")["amount"].mean()
    global_avg = float(reference["amount"].mean())
    df["user_avg_amount"] = df["user_id"].map(user_avg).fillna(global_avg)
    df["category_avg_amount"] = df["category"].map(category_avg).fillna(global_avg)
    df["amount_log"] = np.log1p(df["amount"])
    df["amount_to_user_avg_ratio"] = df["amount"] / df["user_avg_amount"].replace(0, np.nan)
    df["amount_to_category_avg_ratio"] = df["amount"] / df["category_avg_amount"].replace(0, np.nan)
    df["monthly_income_ratio"] = df["amount"] / df["monthly_income"].replace(0, np.nan)

    spent = (
        df.groupby(["user_id", "transaction_month", "category"])["amount"]
        .sum()
        .reset_index(name="spent_amount")
        .rename(columns={"transaction_month": "month"})
    )
    budget_util = budgets.merge(spent, on=["user_id", "month", "category"], how="left")
    budget_util["spent_amount"] = budget_util["spent_amount"].fillna(0)
    budget_util["budget_utilization"] = budget_util["spent_amount"] / budget_util["allocated_amount"]
    df = df.merge(
        budget_util[["user_id", "month", "category", "budget_utilization"]].rename(columns={"month": "transaction_month"}),
        on=["user_id", "transaction_month", "category"],
        how="left",
    )
    df["budget_utilization"] = df["budget_utilization"].fillna(0)
    df["split"] = "demo_holdout"
    regular = df["demo_profile"].eq("regular")
    normal_regular = regular & ~df["is_synthetic_anomaly"]
    df.loc[normal_regular, "split"] = deterministic_split(df.loc[normal_regular, "transaction_id"])
    df.loc[regular & df["is_synthetic_anomaly"], "split"] = "test"
    df.loc[normal_regular & df["split"].eq("test"), "split"] = "test"

    feature_columns = [
        "transaction_id",
        "user_id",
        "transaction_date",
        "transaction_month",
        "amount",
        "amount_log",
        "category",
        "category_id",
        "payment_method",
        "payment_method_id",
        "day_of_week",
        "day_of_month",
        "user_avg_amount",
        "category_avg_amount",
        "amount_to_user_avg_ratio",
        "amount_to_category_avg_ratio",
        "budget_utilization",
        "monthly_income_ratio",
        "is_synthetic_anomaly",
        "split",
    ]
    output = df[feature_columns].copy()
    output.to_csv(PROCESSED_DIR / "dataset_autoencoder_anomaly.csv", index=False)
    return output


def notebook_cell(cell_type: str, source: str) -> dict[str, object]:
    cell: dict[str, object] = {"cell_type": cell_type, "metadata": {}, "source": source.splitlines(True)}
    if cell_type == "code":
        cell.update({"execution_count": None, "outputs": []})
    return cell


def write_notebook(path: Path, title: str, cells: Iterable[dict[str, object]]) -> None:
    notebook = {
        "cells": [
            notebook_cell("markdown", f"# {title}\n\nDompetCerdas AI synthetic v2 Data Science pipeline.\n"),
            *cells,
        ],
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "pygments_lexer": "ipython3"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    path.write_text(json.dumps(notebook, indent=2), encoding="utf-8")


def write_notebooks() -> None:
    write_notebook(
        NOTEBOOKS_DIR / "01_data_assessing_and_cleaning.ipynb",
        "01 Data Assessing and Cleaning",
        [
            notebook_cell(
                "markdown",
                "Notebook ini memuat checklist assessing dan cleaning raw dataset v2. "
                "Output utama berada di `../processed/clean_*.csv` dan `../reports/assessing_summary.md`.\n",
            ),
            notebook_cell(
                "code",
                "import sys\nfrom pathlib import Path\nsys.path.append(str(Path('..').resolve() / 'scripts'))\n"
                "from prepare_data_science_v2 import load_raw, assess_raw, clean_datasets, save_clean_datasets, write_assessment_report\n",
            ),
            notebook_cell(
                "code",
                "users_raw, transactions_raw, budgets_raw = load_raw()\n"
                "print('users', users_raw.shape)\nprint('transactions', transactions_raw.shape)\nprint('budgets', budgets_raw.shape)\n",
            ),
            notebook_cell(
                "code",
                "assessment = assess_raw(users_raw, transactions_raw, budgets_raw)\n"
                "assessment['shape'], assessment['duplicates'], assessment['foreign_key_issues'], assessment['category_issues']\n",
            ),
            notebook_cell(
                "code",
                "users_clean, transactions_clean, budgets_clean = clean_datasets(users_raw, transactions_raw, budgets_raw)\n"
                "save_clean_datasets(users_clean, transactions_clean, budgets_clean)\n"
                "write_assessment_report(assessment)\n"
                "print(users_clean.shape, transactions_clean.shape, budgets_clean.shape)\n",
            ),
        ],
    )
    write_notebook(
        NOTEBOOKS_DIR / "02_eda_and_explanatory_analysis.ipynb",
        "02 EDA and Explanatory Analysis",
        [
            notebook_cell(
                "markdown",
                "Notebook ini menjawab business questions dengan agregasi dan chart. "
                "Chart/report disimpan di `../reports/` agar bisa direview tanpa menjalankan ulang notebook.\n",
            ),
            notebook_cell(
                "code",
                "import sys\nfrom pathlib import Path\nimport pandas as pd\nsys.path.append(str(Path('..').resolve() / 'scripts'))\n"
                "from prepare_data_science_v2 import build_eda\n",
            ),
            notebook_cell(
                "code",
                "root = Path('..').resolve()\n"
                "users = pd.read_csv(root / 'processed' / 'clean_users.csv')\n"
                "transactions = pd.read_csv(root / 'processed' / 'clean_transactions.csv')\n"
                "budgets = pd.read_csv(root / 'processed' / 'clean_budgets.csv')\n"
                "build_eda(users, transactions, budgets)\n",
            ),
            notebook_cell(
                "code",
                "transactions.groupby('transaction_month').size().tail()\n",
            ),
            notebook_cell(
                "code",
                "transactions[transactions.transaction_type == 'pengeluaran'].groupby('category')['amount'].sum().sort_values(ascending=False)\n",
            ),
        ],
    )


def write_pipeline_summary(outputs: dict[str, pd.DataFrame]) -> None:
    lines = ["# Data Science v2 Pipeline Output Summary", ""]
    for name, df in outputs.items():
        lines.append(f"- {name}: {len(df):,} rows x {len(df.columns)} columns")
    lines.extend(
        [
            "",
            "## Leakage Guards",
            "- Demo users are assigned to `demo_holdout` for derived model datasets.",
            "- `demo_profile` is not exported as a model feature.",
            "- `is_synthetic_anomaly` is retained only for Autoencoder evaluation.",
            "- Autoencoder `train` split contains only normal transactions.",
            "- LSTM rows use 3 historical months as inputs and the following month as target.",
        ]
    )
    (REPORTS_DIR / "pipeline_output_summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_pipeline() -> None:
    ensure_dirs()
    users_raw, transactions_raw, budgets_raw = load_raw()
    assessment = assess_raw(users_raw, transactions_raw, budgets_raw)
    users_clean, transactions_clean, budgets_clean = clean_datasets(users_raw, transactions_raw, budgets_raw)
    save_clean_datasets(users_clean, transactions_clean, budgets_clean)
    write_assessment_report(assessment)
    build_eda(users_clean, transactions_clean, budgets_clean)
    outputs = {
        "clean_users": users_clean,
        "clean_transactions": transactions_clean,
        "clean_budgets": budgets_clean,
        "dataset_cnn_category": build_cnn_dataset(users_clean, transactions_clean),
        "dataset_lstm_monthly_spending": build_lstm_dataset(users_clean, transactions_clean),
        "dataset_health_score_user_month": build_health_dataset(users_clean, transactions_clean, budgets_clean),
        "dataset_autoencoder_anomaly": build_autoencoder_dataset(users_clean, transactions_clean, budgets_clean),
    }
    write_notebooks()
    write_pipeline_summary(outputs)
    for name, df in outputs.items():
        print(f"{name}: {len(df):,} rows x {len(df.columns)} columns")


if __name__ == "__main__":
    run_pipeline()
