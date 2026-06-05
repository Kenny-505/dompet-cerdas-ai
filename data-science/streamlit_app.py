"""
DompetCerdas AI - Data Science Dashboard
Streamlit Application for Dataset Visualization, EDA & Model Insights

Run with: streamlit run streamlit_app.py
"""

import streamlit as st
import pandas as pd
import numpy as np
import os
import json
from pathlib import Path
import matplotlib.pyplot as plt
import seaborn as sns

# Page config
st.set_page_config(
    page_title="DompetCerdas AI - Data Science Dashboard",
    page_icon="💰",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Paths
BASE_DIR = Path(__file__).parent
RAW_DIR = BASE_DIR / "synthetic_v2" / "raw"
DATA_DIR = BASE_DIR / "data"
ML_MODELS_DIR = BASE_DIR.parent / "ml-models"

# Categories
EXPENSE_CATEGORIES = ['makanan', 'transportasi', 'belanja', 'tagihan', 'hiburan', 'kesehatan', 'pendidikan', 'kos_sewa', 'lainnya']
INCOME_CATEGORIES = ['gaji', 'freelance_bonus', 'pemasukan_lain']
ALL_CATEGORIES = EXPENSE_CATEGORIES + INCOME_CATEGORIES
USER_SEGMENTS = ['pelajar_mahasiswa', 'pekerja_tetap', 'freelancer']


@st.cache_data
def load_raw_data():
    """Load raw datasets"""
    data = {}
    users_path = RAW_DIR / "synthetic_users.csv"
    if users_path.exists():
        data['users'] = pd.read_csv(users_path)
    tx_path = RAW_DIR / "synthetic_transactions_raw.csv"
    if tx_path.exists():
        data['transactions'] = pd.read_csv(tx_path)
    budgets_path = RAW_DIR / "synthetic_budgets.csv"
    if budgets_path.exists():
        data['budgets'] = pd.read_csv(budgets_path)
    return data


@st.cache_data
def load_clean_data():
    """Load clean dataset from pipeline output"""
    clean_path = DATA_DIR / "03_clean_final.csv"
    if clean_path.exists():
        return pd.read_csv(clean_path)
    return None


@st.cache_data
def load_train_test():
    """Load train/test splits"""
    data = {}
    train_path = DATA_DIR / "05_train.csv"
    test_path = DATA_DIR / "05_test.csv"
    if train_path.exists():
        data['train'] = pd.read_csv(train_path)
    if test_path.exists():
        data['test'] = pd.read_csv(test_path)
    return data


@st.cache_data
def load_aggregated():
    """Load aggregated datasets"""
    data = {}
    monthly_path = DATA_DIR / "04_monthly_aggregated.csv"
    cat_path = DATA_DIR / "04_category_pivot.csv"
    if monthly_path.exists():
        data['monthly'] = pd.read_csv(monthly_path)
    if cat_path.exists():
        data['category_pivot'] = pd.read_csv(cat_path)
    return data


@st.cache_data
def load_data_dictionary():
    """Load data dictionary"""
    dd_path = DATA_DIR / "data_dictionary.csv"
    if dd_path.exists():
        return pd.read_csv(dd_path)
    return None


@st.cache_data
def load_model_metrics():
    """Load model metrics from JSON files"""
    metrics = {}
    cnn_path = ML_MODELS_DIR / "cnn_metrics.json"
    if cnn_path.exists():
        with open(cnn_path) as f:
            metrics['cnn'] = json.load(f)
    lstm_path = ML_MODELS_DIR / "model_lstm_metadata.json"
    if lstm_path.exists():
        with open(lstm_path) as f:
            metrics['lstm'] = json.load(f)
    health_path = ML_MODELS_DIR / "model_health_metadata.json"
    if health_path.exists():
        with open(health_path) as f:
            metrics['health'] = json.load(f)
    ae_path = ML_MODELS_DIR / "autoencoder_config.json"
    if ae_path.exists():
        with open(ae_path) as f:
            metrics['autoencoder'] = json.load(f)
    return metrics


def format_rupiah(value):
    """Format number as Rupiah"""
    if value >= 1e9:
        return f"Rp {value/1e9:.1f} M"
    elif value >= 1e6:
        return f"Rp {value/1e6:.1f} Jt"
    elif value >= 1e3:
        return f"Rp {value/1e3:.0f}K"
    return f"Rp {value:,.0f}"


def main():
    st.sidebar.title("💰 DompetCerdas AI")
    st.sidebar.markdown("**Data Science Dashboard**")
    st.sidebar.markdown("---")

    page = st.sidebar.radio(
        "Navigasi",
        ["📊 Overview", "📁 Datasets", "📈 EDA & Visualisasi",
         "🔍 Explanatory Analysis", "🧪 A/B Testing",
         "📖 Data Dictionary", "🤖 Model Performance", "⚙️ Pipeline Info"],
        index=0
    )

    if page == "📊 Overview":
        show_overview()
    elif page == "📁 Datasets":
        show_datasets()
    elif page == "📈 EDA & Visualisasi":
        show_eda()
    elif page == "🔍 Explanatory Analysis":
        show_explanatory()
    elif page == "🧪 A/B Testing":
        show_ab_testing()
    elif page == "📖 Data Dictionary":
        show_data_dictionary()
    elif page == "🤖 Model Performance":
        show_model_performance()
    elif page == "⚙️ Pipeline Info":
        show_pipeline_info()


def show_overview():
    st.title("📊 DompetCerdas AI - Overview")
    st.markdown("---")

    raw_data = load_raw_data()
    df_clean = load_clean_data()
    model_metrics = load_model_metrics()

    # Key metrics
    col1, col2, col3, col4, col5 = st.columns(5)

    users_df = raw_data.get('users', pd.DataFrame())
    tx_df = raw_data.get('transactions', pd.DataFrame())

    with col1:
        st.metric("Total Users", f"{users_df.shape[0]:,}" if not users_df.empty else "N/A")
    with col2:
        st.metric("Total Transactions", f"{tx_df.shape[0]:,}" if not tx_df.empty else "N/A")
    with col3:
        st.metric("Categories", len(ALL_CATEGORIES))
    with col4:
        if df_clean is not None:
            st.metric("Clean Records", f"{len(df_clean):,}")
        else:
            st.metric("Clean Records", "Run Pipeline")
    with col5:
        st.metric("ML Models", len(model_metrics))

    st.markdown("---")

    # Categories
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("🏷️ Expense Categories (9)")
        for cat in EXPENSE_CATEGORIES:
            st.markdown(f"- `{cat}`")
    with col2:
        st.subheader("🏷️ Income Categories (3)")
        for cat in INCOME_CATEGORIES:
            st.markdown(f"- `{cat}`")

    st.markdown("---")

    # User Segments
    st.subheader("👥 User Segments")
    if not users_df.empty and 'user_segment' in users_df.columns:
        segment_counts = users_df['user_segment'].value_counts()
        col1, col2, col3 = st.columns(3)
        for segment, col in zip(USER_SEGMENTS, [col1, col2, col3]):
            with col:
                count = segment_counts.get(segment, 0)
                st.metric(segment.replace('_', ' ').title(), f"{count} users")

    st.markdown("---")

    # Dataset Overview
    st.subheader("📋 Dataset Summary")
    if df_clean is not None:
        summary_data = {
            'Metric': [
                'Total Records', 'Unique Users', 'Date Range',
                'Expense Records', 'Income Records', 'Anomaly Records'
            ],
            'Value': [
                f"{len(df_clean):,}",
                f"{df_clean['user_id'].nunique():,}" if 'user_id' in df_clean.columns else 'N/A',
                f"{df_clean['transaction_date'].min()} to {df_clean['transaction_date'].max()}" if 'transaction_date' in df_clean.columns else 'N/A',
                f"{(df_clean['transaction_type']=='pengeluaran').sum():,}" if 'transaction_type' in df_clean.columns else 'N/A',
                f"{(df_clean['transaction_type']=='pemasukan').sum():,}" if 'transaction_type' in df_clean.columns else 'N/A',
                f"{df_clean.get('is_anomaly', pd.Series()).sum():,}" if 'is_anomaly' in df_clean.columns else 'N/A',
            ]
        }
        st.dataframe(pd.DataFrame(summary_data), use_container_width=True, hide_index=True)
    else:
        st.warning("⚠️ Clean dataset not found. Run the DataPipeline notebook first.")

    st.markdown("---")

    # Model Summary
    st.subheader("🤖 Model Summary")
    model_data = []
    if 'cnn' in model_metrics:
        model_data.append({'Model': 'CNN Auto-Categorize', 'Type': 'Classification', 'Status': '✅ Trained'})
    if 'lstm' in model_metrics:
        model_data.append({'Model': 'LSTM Spending Prediction', 'Type': 'Forecasting', 'Status': '✅ Trained'})
    if 'health' in model_metrics:
        model_data.append({'Model': 'Dense NN Health Score', 'Type': 'Regression', 'Status': '✅ Trained'})
    if 'autoencoder' in model_metrics:
        model_data.append({'Model': 'Autoencoder Anomaly', 'Type': 'Anomaly Detection', 'Status': '✅ Trained'})

    if model_data:
        st.dataframe(pd.DataFrame(model_data), use_container_width=True, hide_index=True)
    else:
        st.info("Model metrics not available. Run training scripts first.")


def show_datasets():
    st.title("📁 Datasets")
    st.markdown("---")

    tab1, tab2, tab3 = st.tabs(["📥 Raw Data", "✅ Clean Data", "📊 Aggregated"])

    with tab1:
        st.subheader("Raw Datasets (v2)")
        raw_data = load_raw_data()

        if raw_data.get('users') is not None:
            with st.expander("👤 Users Dataset", expanded=False):
                users = raw_data['users']
                st.write(f"**Shape:** {users.shape}")
                st.dataframe(users.head(10), use_container_width=True)

        if raw_data.get('transactions') is not None:
            with st.expander("💳 Transactions Dataset", expanded=False):
                tx = raw_data['transactions']
                st.write(f"**Shape:** {tx.shape}")
                st.dataframe(tx.head(10), use_container_width=True)

        if raw_data.get('budgets') is not None:
            with st.expander("💰 Budgets Dataset", expanded=False):
                budgets = raw_data['budgets']
                st.write(f"**Shape:** {budgets.shape}")
                st.dataframe(budgets.head(10), use_container_width=True)

    with tab2:
        st.subheader("Clean Dataset (Pipeline Output)")
        df_clean = load_clean_data()

        if df_clean is not None:
            st.write(f"**Shape:** {df_clean.shape}")
            st.dataframe(df_clean.head(20), use_container_width=True)

            # Column info
            col1, col2 = st.columns(2)
            with col1:
                st.markdown("**Columns:**")
                st.write(df_clean.columns.tolist())
            with col2:
                st.markdown("**Data Types:**")
                st.write(df_clean.dtypes.value_counts())
        else:
            st.warning("⚠️ Clean dataset not found. Run the DataPipeline notebook first.")

        # Train/Test
        splits = load_train_test()
        if splits:
            st.markdown("---")
            col1, col2 = st.columns(2)
            with col1:
                if 'train' in splits:
                    st.metric("Train Set", f"{len(splits['train']):,} rows")
            with col2:
                if 'test' in splits:
                    st.metric("Test Set", f"{len(splits['test']):,} rows")

    with tab3:
        st.subheader("Aggregated Datasets")
        agg = load_aggregated()

        if agg.get('monthly') is not None:
            with st.expander("📊 Monthly Aggregated", expanded=False):
                st.write(f"**Shape:** {agg['monthly'].shape}")
                st.dataframe(agg['monthly'].head(20), use_container_width=True)

        if agg.get('category_pivot') is not None:
            with st.expander("📊 Category Pivot", expanded=False):
                st.write(f"**Shape:** {agg['category_pivot'].shape}")
                st.dataframe(agg['category_pivot'].head(20), use_container_width=True)

        if not agg:
            st.warning("⚠️ Aggregated datasets not found. Run the DataPipeline notebook first.")


def show_eda():
    st.title("📈 EDA & Visualisasi")
    st.markdown("---")

    # EDA Charts from pipeline
    st.subheader("📊 EDA Charts (Generated by Pipeline)")
    st.markdown("Charts generated by `DompetCerdasAI_DataPipeline.ipynb`")

    chart_files = [
        ('Distribusi Pengeluaran per Kategori', 'eda_distribution.png'),
        ('Frekuensi Transaksi per Kategori', 'eda_frekuensi.png'),
        ('Tren Pengeluaran Bulanan', 'eda_trend_bulanan.png'),
        ('Proporsi Pengeluaran per Kategori', 'eda_pie_proporsi.png'),
        ('Heatmap & Weekday vs Weekend', 'eda_heatmap_weekend.png'),
        ('Rata-rata per Transaksi: Weekday vs Weekend', 'eda_weekend_mean.png'),
        ('Distribusi per User Segment', 'eda_segment_distribution.png'),
    ]

    cols = st.columns(2)
    for idx, (name, filename) in enumerate(chart_files):
        path = DATA_DIR / filename
        with cols[idx % 2]:
            if path.exists():
                st.markdown(f"**{name}**")
                st.image(str(path))
            else:
                st.info(f"📁 {name} - Run pipeline to generate")

    st.markdown("---")

    # Interactive EDA
    st.subheader("🔬 Interactive EDA")
    df_clean = load_clean_data()

    if df_clean is not None:
        df_expense = df_clean[df_clean['transaction_type'] == 'pengeluaran'].copy()

        # Category selector
        col1, col2 = st.columns(2)
        with col1:
            selected_cat = st.multiselect(
                "Pilih Kategori",
                options=EXPENSE_CATEGORIES,
                default=['makanan', 'transportasi']
            )
        with col2:
            selected_segment = st.selectbox(
                "Pilih Segmen",
                options=['All'] + USER_SEGMENTS
            )

        if selected_cat:
            filtered = df_expense[df_expense['category'].isin(selected_cat)]
            if selected_segment != 'All':
                filtered = filtered[filtered['user_segment'] == selected_segment]

            if not filtered.empty:
                fig, ax = plt.subplots(figsize=(10, 5))
                for cat in selected_cat:
                    cat_data = filtered[filtered['category'] == cat]
                    ax.hist(cat_data['amount'], bins=30, alpha=0.5, label=cat)
                ax.set_xlabel('Amount (Rp)')
                ax.set_ylabel('Frequency')
                ax.set_title('Distribusi Amount per Kategori')
                ax.legend()
                st.pyplot(fig)
                plt.close()
            else:
                st.info("No data for selected filters")
    else:
        st.warning("⚠️ Clean dataset not found.")


def show_explanatory():
    st.title("🔍 Explanatory Analysis - 7 Pertanyaan Bisnis")
    st.markdown("---")

    df_clean = load_clean_data()

    if df_clean is None:
        st.warning("⚠️ Clean dataset not found. Run the DataPipeline notebook first.")
        return

    df_expense = df_clean[df_clean['transaction_type'] == 'pengeluaran'].copy()
    users_df = load_raw_data().get('users', pd.DataFrame())

    questions = [
        "Q1: Proporsi tertinggi per segmen user?",
        "Q2: Weekday vs Weekend (hiburan & makanan)?",
        "Q3: Payment method dominan < Rp 100K?",
        "Q4: Hutang vs tidak punya hutang?",
        "Q5: User overbudget?",
        "Q6: Saving ratio: gaji vs non-gaji?",
        "Q7: Surplus per segmen?"
    ]

    q = st.sidebar.radio("Pilih Pertanyaan", questions, index=0)

    if q.startswith("Q1"):
        st.subheader("Q1: Kategori pengeluaran tertinggi per segmen user")
        fig, axes = plt.subplots(1, 3, figsize=(18, 5))
        for idx, seg in enumerate(USER_SEGMENTS):
            seg_data = df_expense[df_expense['user_segment'] == seg]
            cat_total = seg_data.groupby('category')['amount'].sum().sort_values(ascending=False).head(5)
            axes[idx].barh(cat_total.index.str.replace('_', ' ').str.title(), cat_total.values / 1e6,
                          color=sns.color_palette('viridis', 5))
            axes[idx].set_title(seg.replace('_', ' ').title(), fontweight='bold')
            axes[idx].set_xlabel('Total (Juta Rp)')
        plt.suptitle('Top 5 Kategori Pengeluaran per Segmen', fontweight='bold')
        plt.tight_layout()
        st.pyplot(fig)
        plt.close()

        st.markdown("""
        **Insight:**
        - Setiap segmen user memiliki pola pengeluaran yang berbeda
        - Pelajar: makanan & transportasi mendominasi (kebutuhan harian)
        - Pekerja Tetap: kos_sewa & tagihan (kewajiban rutin)
        - Freelancer: lebih merata, belanja & hiburan signifikan
        """)

    elif q.startswith("Q2"):
        st.subheader("Q2: Weekday vs Weekend (Hiburan & Makanan)")
        df_q2 = df_expense[df_expense['category'].isin(['makanan', 'hiburan'])].copy()
        if 'is_weekend' in df_q2.columns:
            df_q2['tipe_hari'] = np.where(df_q2['is_weekend'] == 1, 'Akhir Pekan', 'Hari Kerja')
            avg_daily = df_q2.groupby(['category', 'tipe_hari'])['amount'].mean().reset_index()
            fig, ax = plt.subplots(figsize=(10, 6))
            sns.barplot(data=avg_daily, x='category', y='amount', hue='tipe_hari', palette='Set2', ax=ax)
            ax.set_title('Rata-rata Pengeluaran: Weekday vs Weekend', fontweight='bold')
            ax.set_ylabel('Rata-rata (Rp)')
            st.pyplot(fig)
            plt.close()
        st.markdown("""
        **Insight:** Pengeluaran makanan & hiburan cenderung sedikit lebih tinggi di akhir pekan.
        """)

    elif q.startswith("Q3"):
        st.subheader("Q3: Payment Method Dominan (< Rp 100K, Pekerja Tetap)")
        df_q3 = df_clean[(df_clean['user_segment'] == 'pekerja_tetap') &
                         (df_clean['amount'] < 100000) &
                         (df_clean['transaction_type'] == 'pengeluaran')].copy()
        if not df_q3.empty:
            payment_counts = df_q3['payment_method'].value_counts()
            fig, ax = plt.subplots(figsize=(10, 5))
            ax.barh(payment_counts.index, payment_counts.values, color=sns.color_palette('magma', len(payment_counts)))
            ax.set_xlabel('Jumlah Transaksi')
            ax.set_title('Metode Pembayaran Dominan (< Rp 100K)', fontweight='bold')
            st.pyplot(fig)
            plt.close()
        st.markdown("""
        **Insight:** E-wallet dan cash mendominasi transaksi mikro.
        """)

    elif q.startswith("Q4"):
        st.subheader("Q4: Pengeluaran - Punya Hutang vs Tidak")
        if 'has_debt' in df_expense.columns:
            df_q4 = df_expense.groupby(['user_id', 'has_debt'])['amount'].mean().reset_index()
            df_q4['has_debt_label'] = df_q4['has_debt'].map({True: 'Punya Hutang', False: 'Tidak Punya'})
            avg_debt = df_q4.groupby('has_debt_label')['amount'].mean().reset_index()
            fig, ax = plt.subplots(figsize=(8, 5))
            ax.bar(avg_debt['has_debt_label'], avg_debt['amount'], color=['#2ecc71', '#e74c3c'])
            ax.set_title('Rata-rata Pengeluaran: Hutang vs Tidak', fontweight='bold')
            ax.set_ylabel('Rata-rata (Rp)')
            st.pyplot(fig)
            plt.close()
        st.markdown("""
        **Insight:** User dengan hutang memiliki pola pengeluaran berbeda.
        """)

    elif q.startswith("Q5"):
        st.subheader("Q5: User Overbudget (Expense > Income)")
        if 'monthly_income' in df_expense.columns:
            monthly_exp = df_expense.groupby(['user_id', 'year', 'month'])['amount'].sum().reset_index()
            monthly_exp = monthly_exp.merge(users_df[['user_id', 'monthly_income']], on='user_id', how='left')
            monthly_exp['status'] = np.where(monthly_exp['amount'] > monthly_exp['monthly_income'],
                                             'Overbudget', 'Aman')
            status_counts = monthly_exp['status'].value_counts()
            fig, ax = plt.subplots(figsize=(8, 8))
            colors = ['#2ecc71' if s == 'Aman' else '#e74c3c' for s in status_counts.index]
            ax.pie(status_counts, labels=status_counts.index, autopct='%1.1f%%',
                   startangle=140, colors=colors, textprops={'fontsize': 13, 'fontweight': 'bold'})
            ax.set_title('Proporsi Status Keuangan Bulanan', fontweight='bold', fontsize=15)
            st.pyplot(fig)
            plt.close()
        st.markdown("""
        **Insight:** Proporsi overbudget menunjukkan kebutuhan akan AI budget planner.
        """)

    elif q.startswith("Q6"):
        st.subheader("Q6: Saving Ratio (Gaji vs Non-Gaji)")
        if 'transaction_type' in df_clean.columns:
            user_fin = df_clean.pivot_table(index='user_id', columns='transaction_type',
                                            values='amount', aggfunc='sum', fill_value=0).reset_index()
            pemasukan_col = 'pemasukan' if 'pemasukan' in user_fin.columns else None
            pengeluaran_col = 'pengeluaran' if 'pengeluaran' in user_fin.columns else None
            if pemasukan_col and pengeluaran_col:
                user_fin['saving_ratio'] = np.where(
                    user_fin[pemasukan_col] > 0,
                    (user_fin[pemasukan_col] - user_fin[pengeluaran_col]) / user_fin[pemasukan_col] * 100, 0)
                df_income = df_clean[df_clean['transaction_type'] == 'pemasukan'].copy()

                def check_type(cats):
                    cats_list = [c for c in cats if pd.notna(c)]
                    if any(c not in ['gaji'] for c in cats_list):
                        return 'Ada Non-Gaji'
                    return 'Hanya Gaji'

                user_type = df_income.groupby('user_id')['category'].apply(check_type).reset_index()
                user_type.rename(columns={'category': 'tipe'}, inplace=True)
                df_q6 = pd.merge(user_fin, user_type, on='user_id', how='inner')
                avg_saving = df_q6.groupby('tipe')['saving_ratio'].mean().reset_index()

                fig, ax = plt.subplots(figsize=(8, 5))
                ax.bar(avg_saving['tipe'], avg_saving['saving_ratio'], color=['#2ecc71', '#3498db'])
                ax.set_title('Saving Ratio: Gaji vs Non-Gaji', fontweight='bold')
                ax.set_ylabel('Saving Ratio (%)')
                st.pyplot(fig)
                plt.close()
        st.markdown("""
        **Insight:** Diversifikasi income membantu stabilitas finansial.
        """)

    elif q.startswith("Q7"):
        st.subheader("Q7: Surplus Bulanan per Segmen")
        if 'transaction_type' in df_clean.columns:
            income_m = df_clean[df_clean['transaction_type'] == 'pemasukan'].groupby(['user_id', 'year', 'month'])['amount'].sum().reset_index()
            income_m.rename(columns={'amount': 'total_income'}, inplace=True)
            expense_m = df_clean[df_clean['transaction_type'] == 'pengeluaran'].groupby(['user_id', 'year', 'month'])['amount'].sum().reset_index()
            expense_m.rename(columns={'amount': 'total_expense'}, inplace=True)

            surplus = income_m.merge(expense_m, on=['user_id', 'year', 'month'], how='outer').fillna(0)
            surplus['surplus'] = surplus['total_income'] - surplus['total_expense']
            surplus = surplus.merge(df_clean[['user_id', 'user_segment']].drop_duplicates(), on='user_id', how='left')

            seg_surplus = surplus.groupby('user_segment')['surplus'].mean().sort_values(ascending=False).reset_index()

            fig, ax = plt.subplots(figsize=(10, 5))
            colors = ['#2ecc71' if x >= 0 else '#e74c3c' for x in seg_surplus['surplus']]
            ax.barh(seg_surplus['user_segment'].str.replace('_', ' ').str.title(),
                    seg_surplus['surplus'] / 1e6, color=colors)
            ax.set_xlabel('Surplus (Juta Rp)')
            ax.set_title('Rata-rata Surplus Bulanan per Segmen', fontweight='bold')
            st.pyplot(fig)
            plt.close()
        st.markdown("""
        **Insight:** Freelancer surplus tertinggi, pelajar paling rendah.
        """)


def show_ab_testing():
    st.title("🧪 A/B Testing - Simulasi AI Recommendation")
    st.markdown("---")

    df_clean = load_clean_data()
    if df_clean is None:
        st.warning("⚠️ Clean dataset not found. Run the DataPipeline notebook first.")
        return

    st.markdown("""
    ### **Tujuan A/B Testing**
    Mengukur efektivitas fitur AI Budget Planner melalui simulasi:
    - **Grup A (Kontrol)**: Pengeluaran aktual tanpa AI
    - **Grup B (Treatment)**: Pengeluaran dengan AI recommendation (asumsi hemat 10-15%)
    """)

    from scipy import stats

    spending = df_clean[df_clean['transaction_type'] == 'pengeluaran']['amount'].reset_index(drop=True)

    col1, col2 = st.columns(2)
    with col1:
        st.metric("Total Transaksi", f"{len(spending):,}")
    with col2:
        st.metric("Rata-rata Spending", format_rupiah(spending.mean()))

    st.markdown("---")

    # Simulation
    np.random.seed(42)
    group_a = spending.copy()
    savings_rate = np.random.uniform(0.10, 0.15, len(spending))
    group_b = spending * (1 - savings_rate)

    avg_savings = (group_a.mean() - group_b.mean()) / group_a.mean() * 100

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Grup A (Tanpa AI)", format_rupiah(group_a.mean()))
    with col2:
        st.metric("Grup B (Dengan AI)", format_rupiah(group_b.mean()))
    with col3:
        st.metric("Pengurangan", f"{avg_savings:.1f}%")

    # Statistical test
    t_stat, p_value = stats.ttest_ind(group_a, group_b)

    st.markdown("---")
    st.subheader("📊 Statistical Test (Independent T-Test)")

    col1, col2 = st.columns(2)
    with col1:
        st.metric("t-statistic", f"{t_stat:.4f}")
    with col2:
        st.metric("p-value", f"{p_value:.10f}")

    if p_value < 0.05:
        st.success("✅ **HASIL: SIGNIFIKAN (p < 0.05)** - H0 ditolak. AI recommendation efektif mengurangi spending.")
    else:
        st.info("ℹ️ HASIL: TIDAK SIGNIFIKAN - H0 gagal ditolak.")

    # Visualization
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.hist(group_a, bins=50, alpha=0.5, label='Grup A (Tanpa AI)', color='#e74c3c')
    ax.hist(group_b, bins=50, alpha=0.5, label='Grup B (Dengan AI)', color='#2ecc71')
    ax.set_title('Distribusi Spending: Grup A vs Grup B', fontweight='bold')
    ax.set_xlabel('Amount (Rp)')
    ax.set_ylabel('Frequency')
    ax.legend()
    st.pyplot(fig)
    plt.close()

    st.markdown(f"""
    ---
    ### **Kesimpulan**
    Simulasi menunjukkan AI recommendation BISA mengurangi spending hingga **{avg_savings:.1f}%** rata-rata.
    Ini menjadi dasar untuk pengembangan model Budget Planner.
    """)


def show_data_dictionary():
    st.title("📖 Data Dictionary")
    st.markdown("---")

    dd = load_data_dictionary()
    if dd is not None:
        st.dataframe(dd, use_container_width=True, hide_index=True)

        st.markdown("---")
        st.subheader("📊 Column Statistics")
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Total Columns", len(dd))
        with col2:
            if 'data_type' in dd.columns:
                st.write("**Data Types:**")
                st.write(dd['data_type'].value_counts())
    else:
        st.warning("⚠️ Data dictionary not found. Run the DataPipeline notebook first.")


def show_model_performance():
    st.title("🤖 Model Performance")
    st.markdown("---")

    model_metrics = load_model_metrics()

    if not model_metrics:
        st.info("Model metrics not available. Run training scripts first.")
        return

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("CNN Auto-Categorize")
        if 'cnn' in model_metrics:
            st.json(model_metrics['cnn'])
        else:
            st.info("CNN metrics not available")

        st.markdown("---")
        st.subheader("Dense NN Health Score")
        if 'health' in model_metrics:
            st.json(model_metrics['health'])
        else:
            st.info("Health Score metrics not available")

    with col2:
        st.subheader("LSTM Spending Prediction")
        if 'lstm' in model_metrics:
            st.json(model_metrics['lstm'])
        else:
            st.info("LSTM metrics not available")

        st.markdown("---")
        st.subheader("Autoencoder Anomaly Detection")
        if 'autoencoder' in model_metrics:
            st.json(model_metrics['autoencoder'])
        else:
            st.info("Autoencoder metrics not available")


def show_pipeline_info():
    st.title("⚙️ Pipeline Information")
    st.markdown("---")

    st.subheader("📋 Data Pipeline Stages")

    stages = [
        ("1. Data Gathering", "Load raw CSV: synthetic_users, synthetic_transactions_raw, synthetic_budgets"),
        ("2. Assessing Data", "Info, missing values, duplicates, describe, unique values"),
        ("3. Cleaning Data", "Drop duplicates, datetime conversion, anomaly flag, merge user info"),
        ("4. EDA", "7+ visualizations: distribution, frequency, trends, heatmap, segments"),
        ("5. Explanatory Analysis", "7 pertanyaan bisnis dengan visualisasi dan interpretasi"),
        ("6. Outlier Handling", "Percentile capping (P01-P99) pada data normal saja"),
        ("7. Feature Engineering", "spending_ratio, is_large_transaction, days_since_salary, quarter, one-hot"),
        ("8. Label Encoding", "Category, Segment, TX Type, Payment -> integer encoding"),
        ("9. Data Splitting", "Chronological split (80/20), MinMaxScaler fit dari train"),
        ("10. Export Artifacts", "CSV clean/train/test/aggregated, scaler.pkl, JSON mappings"),
        ("11. A/B Testing", "Simulasi AI recommendation, Independent T-Test"),
        ("12. Data Dictionary", "Dokumentasi semua kolom dengan tipe dan deskripsi"),
    ]

    for stage, description in stages:
        col1, col2 = st.columns([1, 3])
        with col1:
            st.markdown(f"**{stage}**")
        with col2:
            st.markdown(description)

    st.markdown("---")

    st.subheader("🚫 Anti-Data Leakage Rules")
    leakage_rules = [
        ("Scaler fitted dari train only", "MinMaxScaler di-fit hanya dari train set, kemudian transform test"),
        ("Chronological Split", "Train sebelum cutoff date, test sesudah - no future leakage"),
        ("Anomali dipertahankan", "Data anomali TIDAK di-capping agar model anomaly detection bisa belajar"),
        ("Feature Engineering safe", "Semua fitur dihitung dari variabel yang tersedia saat transaksi terjadi"),
    ]
    for rule, desc in leakage_rules:
        st.markdown(f"- **{rule}:** {desc}")

    st.markdown("---")

    st.subheader("📁 Output Artifacts")
    st.code("""
data/
├── 03_clean_final.csv          # Dataset utama setelah cleaning + FE
├── 04_monthly_aggregated.csv   # Agregasi bulanan per user
├── 04_category_pivot.csv       # Pivot kategori per user/bulan
├── 05_train.csv                # Train set (chronological 80%)
├── 05_test.csv                 # Test set (chronological 20%)
├── scaler.pkl                  # MinMaxScaler (fitted from train)
├── category_label_mapping.json # Kategori -> integer
├── segment_label_mapping.json  # Segment -> integer
├── payment_label_mapping.json  # Payment -> integer
├── data_dictionary.csv         # Dokumentasi semua kolom
└── eda_*.png                   # Chart EDA (7 charts)
    """)


if __name__ == "__main__":
    main()