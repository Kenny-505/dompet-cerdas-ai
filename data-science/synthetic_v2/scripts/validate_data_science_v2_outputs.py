"""Validate DompetCerdas AI synthetic v2 Data Science outputs."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = ROOT / "processed"
NOTEBOOKS_DIR = ROOT / "notebooks"

ALL_CATEGORIES = {
    "makanan",
    "transportasi",
    "belanja",
    "tagihan",
    "hiburan",
    "kesehatan",
    "pendidikan",
    "kos_sewa",
    "lainnya",
    "gaji",
    "freelance_bonus",
    "pemasukan_lain",
}
EXPENSE_CATEGORIES = {
    "makanan",
    "transportasi",
    "belanja",
    "tagihan",
    "hiburan",
    "kesehatan",
    "pendidikan",
    "kos_sewa",
    "lainnya",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def load_csv(name: str) -> pd.DataFrame:
    path = PROCESSED_DIR / name
    require(path.exists(), f"Missing output file: {path}")
    df = pd.read_csv(path)
    require(not df.empty, f"Output file is empty: {path}")
    return df


def validate_notebook(name: str) -> None:
    path = NOTEBOOKS_DIR / name
    require(path.exists(), f"Missing notebook: {path}")
    notebook = json.loads(path.read_text(encoding="utf-8"))
    require(notebook.get("nbformat") == 4, f"Invalid notebook nbformat: {path}")
    require(len(notebook.get("cells", [])) >= 3, f"Notebook has too few cells: {path}")


def main() -> None:
    clean_users = load_csv("clean_users.csv")
    clean_transactions = load_csv("clean_transactions.csv")
    clean_budgets = load_csv("clean_budgets.csv")
    cnn = load_csv("dataset_cnn_category.csv")
    lstm = load_csv("dataset_lstm_monthly_spending.csv")
    health = load_csv("dataset_health_score_user_month.csv")
    autoencoder = load_csv("dataset_autoencoder_anomaly.csv")

    require(set(clean_transactions["category"]).issubset(ALL_CATEGORIES), "Clean transactions contain non-v2 categories")
    require(set(clean_budgets["category"]).issubset(EXPENSE_CATEGORIES), "Clean budgets contain non-expense categories")
    require(set(cnn["category"]).issubset(ALL_CATEGORIES), "CNN dataset contains non-v2 categories")
    require("demo_profile" not in cnn.columns, "CNN dataset leaks demo_profile")
    require("demo_profile" not in lstm.columns, "LSTM dataset leaks demo_profile")
    require("demo_profile" not in health.columns, "Health dataset leaks demo_profile")
    require("demo_profile" not in autoencoder.columns, "Autoencoder dataset leaks demo_profile")
    require((cnn["split"].isin(["train", "validation", "test", "demo_holdout"])).all(), "Invalid CNN split")
    require((lstm["split"].isin(["train", "validation", "test", "demo_holdout"])).all(), "Invalid LSTM split")
    require((health["split"].isin(["train", "validation", "test", "demo_holdout"])).all(), "Invalid health split")
    require((autoencoder["split"].isin(["train", "validation", "test", "demo_holdout"])).all(), "Invalid autoencoder split")
    require(
        not autoencoder.loc[autoencoder["split"].eq("train"), "is_synthetic_anomaly"].astype(bool).any(),
        "Autoencoder train split contains anomaly rows",
    )
    require((lstm["input_month_1"] < lstm["input_month_2"]).all(), "LSTM input months are not ordered")
    require((lstm["input_month_2"] < lstm["input_month_3"]).all(), "LSTM input months are not ordered")
    require((lstm["input_month_3"] < lstm["target_month"]).all(), "LSTM target month leaks into input")
    require(health["user_segment"].isin(["pelajar_mahasiswa", "pekerja_tetap", "freelancer"]).all(), "Invalid health segment")
    require(health["health_score"].between(0, 100).all(), "Health score outside 0-100 range")

    validate_notebook("01_data_assessing_and_cleaning.ipynb")
    validate_notebook("02_eda_and_explanatory_analysis.ipynb")

    print("Data Science v2 output validation passed.")
    print(f"clean_users: {len(clean_users):,}")
    print(f"clean_transactions: {len(clean_transactions):,}")
    print(f"clean_budgets: {len(clean_budgets):,}")
    print(f"cnn: {len(cnn):,}")
    print(f"lstm: {len(lstm):,}")
    print(f"health: {len(health):,}")
    print(f"autoencoder: {len(autoencoder):,}")


if __name__ == "__main__":
    main()
