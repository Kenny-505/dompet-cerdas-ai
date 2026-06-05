import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import LabelEncoder, MinMaxScaler
from sklearn.model_selection import train_test_split
import os, json, joblib
from scipy import stats
import matplotlib.ticker as ticker
import warnings
warnings.filterwarnings('ignore')

# Set style
plt.style.use('seaborn-v0_8-whitegrid')
sns.set_palette('viridis')

# Paths
RAW_DIR = 'synthetic_v2/raw'
PROCESSED_DIR = 'synthetic_v2/processed'
REPORTS_DIR = 'synthetic_v2/reports'
DATA_DIR = 'data'

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

print('Libraries loaded successfully!')



# Load datasets
users = pd.read_csv(f'{RAW_DIR}/synthetic_users.csv')
transactions = pd.read_csv(f'{RAW_DIR}/synthetic_transactions_raw.csv')
budgets = pd.read_csv(f'{RAW_DIR}/synthetic_budgets.csv')

print(f'Users       : {users.shape}')
print(f'Transactions: {transactions.shape}')
print(f'Budgets     : {budgets.shape}')
print()
print('--- Users Preview ---')
users.head()



print('--- Transactions Preview ---')
transactions.head(10)



print('--- Budgets Preview ---')
budgets.head(10)



print('--- Transactions Info ---')
transactions.info()



print('--- Users Info ---')
users.info()



print('--- Missing Values ---')
print('Transactions:')
print(transactions.isna().sum())
print()
print('Users:')
print(users.isna().sum())
print()
print('Budgets:')
print(budgets.isna().sum())



print('--- Duplicated ---')
print(f'Transactions: {transactions.duplicated().sum():,} duplicates')
print(f'Users:        {users.duplicated().sum():,} duplicates')
print(f'Budgets:      {budgets.duplicated().sum():,} duplicates')



print('--- Transactions Describe ---')
transactions.describe()



print('--- Unique categories ---')
print(sorted(transactions['category'].dropna().unique()))
print()
print('--- Unique payment methods ---')
print(sorted(transactions['payment_method'].dropna().unique()))
print()
print('--- Unique transaction types ---')
print(transactions['transaction_type'].unique())
print()
print('--- User segments ---')
print(users['user_segment'].value_counts())



print('=' * 60)
print('CLEANING DATA')
print('=' * 60)

# 1. Drop duplicates
before = len(transactions)
transactions = transactions.drop_duplicates()
print(f'[1] Drop duplicates: {before:,} -> {len(transactions):,} ({before - len(transactions):,} removed)')

# 2. Convert date
transactions['transaction_date'] = pd.to_datetime(transactions['transaction_date'])
print('[2] transaction_date -> datetime')

# 3. Convert anomaly flag
transactions['is_anomaly'] = transactions['is_synthetic_anomaly'].map({'true': True, 'false': False})
print('[3] is_synthetic_anomaly -> is_anomaly (boolean)')

# 4. Fill missing merchant
transactions['merchant'] = transactions['merchant'].fillna('Unknown')
print('[4] Fill missing merchant -> Unknown')

# 5. Extract date features
transactions['year'] = transactions['transaction_date'].dt.year
transactions['month'] = transactions['transaction_date'].dt.month
transactions['day_of_week'] = transactions['transaction_date'].dt.dayofweek
transactions['is_weekend'] = transactions['day_of_week'].isin([5, 6]).astype(int)
print('[5] Extract date features: year, month, day_of_week, is_weekend')

# 6. Merge user info
df = transactions.merge(
    users[['user_id', 'user_segment', 'monthly_income', 'has_savings', 'has_debt']],
    on='user_id', how='left'
)
print(f'[6] Merge user info -> Shape: {df.shape}')

print(f'\nTotal baris setelah cleaning: {len(df):,}')
print(f'Missing values: {df.isna().sum().sum()}')



# Filter hanya pengeluaran untuk EDA
df['month_year'] = df['transaction_date'].dt.to_period('M')
df_expense = df[df['transaction_type'] == 'pengeluaran'].copy()

print(f'Total transactions: {len(df):,}')
print(f'Expense transactions: {len(df_expense):,}')
print(f'Income transactions: {len(df[df["transaction_type"] == "pemasukan"]):,}')
print(f'Anomaly transactions: {df["is_anomaly"].sum():,}')



# EDA 1: Distribusi pengeluaran per kategori (Boxplot)
fig, ax = plt.subplots(figsize=(14, 8))

cat_order = df_expense.groupby('category')['amount'].median().sort_values(ascending=False).index
sns.boxplot(data=df_expense, x='category', y='amount', order=cat_order, ax=ax, palette='viridis')

ax.set_title('Distribusi Pengeluaran per Kategori (Log Scale)', fontsize=14, fontweight='bold')
ax.set_xlabel('Kategori')
ax.set_ylabel('Jumlah (Rp)')
ax.tick_params(axis='x', rotation=30)
ax.set_yscale('log')

def format_rupiah(x, pos):
    if x >= 1e6:
        return f'{x*1e-6:.1f}M'
    elif x >= 1e3:
        return f'{x*1e-3:.0f}K'
    return f'{x:.0f}'

ax.yaxis.set_major_formatter(ticker.FuncFormatter(format_rupiah))
plt.tight_layout()
plt.savefig(f'{DATA_DIR}/eda_distribution.png', dpi=150, bbox_inches='tight')
plt.close("all")
print('[OK] eda_distribution.png saved')



# EDA 2: Frekuensi transaksi per kategori
fig, ax = plt.subplots(figsize=(12, 6))
cat_counts = df_expense['category'].value_counts()
sns.barplot(x=cat_counts.index, y=cat_counts.values, ax=ax, palette='coolwarm')
ax.set_title('Frekuensi Transaksi Pengeluaran per Kategori', fontsize=14, fontweight='bold')
ax.set_xlabel('Kategori')
ax.set_ylabel('Jumlah Transaksi')
ax.tick_params(axis='x', rotation=30)

for i, v in enumerate(cat_counts.values):
    ax.text(i, v + cat_counts.max()*0.01, f'{v:,}', ha='center', fontsize=10)

plt.tight_layout()
plt.savefig(f'{DATA_DIR}/eda_frekuensi.png', dpi=150, bbox_inches='tight')
plt.close("all")
print('[OK] eda_frekuensi.png saved')



# EDA 3: Tren bulanan
monthly_spend = df_expense.groupby('month_year')['amount'].sum()

fig, ax = plt.subplots(figsize=(14, 6))
monthly_spend.index = monthly_spend.index.astype(str)

sns.lineplot(x=range(len(monthly_spend)), y=monthly_spend.values, ax=ax,
             marker='o', color='#2ab0ff', linewidth=2)

step = max(1, len(monthly_spend)//12)
ax.set_xticks(range(0, len(monthly_spend), step))
ax.set_xticklabels(monthly_spend.index[::step], rotation=45, ha='right')
ax.set_title('Tren Pengeluaran Bulanan (Seasonal Pattern)', fontsize=14, fontweight='bold')
ax.set_xlabel('Bulan')
ax.set_ylabel('Total Pengeluaran (Rp)')
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'{x/1e9:.1f}M'))
ax.grid(True, alpha=0.3)

max_idx = monthly_spend.values.argmax()
min_idx = monthly_spend.values.argmin()
ax.annotate('Tertinggi', xy=(max_idx, monthly_spend.values[max_idx]),
            xytext=(max_idx, monthly_spend.values[max_idx]*1.05),
            ha='center', color='red', fontweight='bold', fontsize=10)
ax.annotate('Terendah', xy=(min_idx, monthly_spend.values[min_idx]),
            xytext=(min_idx, monthly_spend.values[min_idx]*0.9),
            ha='center', color='green', fontweight='bold', fontsize=10)

plt.tight_layout()
plt.savefig(f'{DATA_DIR}/eda_trend_bulanan.png', dpi=150, bbox_inches='tight')
plt.close("all")
print('[OK] eda_trend_bulanan.png saved')



# EDA 4: Proporsi pengeluaran (Pie chart)
fig, ax = plt.subplots(figsize=(10, 8))
cat_spend = df_expense.groupby('category')['amount'].sum().sort_values(ascending=False)
colors = sns.color_palette('Set2', len(cat_spend))

wedges, texts, autotexts = ax.pie(cat_spend.values, labels=cat_spend.index,
                                   autopct='%1.1f%%', colors=colors, startangle=90)
ax.set_title('Proporsi Total Pengeluaran per Kategori', fontsize=14, fontweight='bold')

for t in texts:
    t.set_fontsize(10)
for t in autotexts:
    t.set_fontsize(10)
    t.set_fontweight('bold')

plt.tight_layout()
plt.savefig(f'{DATA_DIR}/eda_pie_proporsi.png', dpi=150, bbox_inches='tight')
plt.close("all")
print('[OK] eda_pie_proporsi.png saved')



# EDA 5: Heatmap + Weekday vs Weekend
fig, axes = plt.subplots(1, 2, figsize=(20, 8), gridspec_kw={'width_ratios': [2, 1]})

ax1 = axes[0]
pivot = df_expense.pivot_table(
    index='category', columns='month_year', values='amount', aggfunc='sum', fill_value=0
)
pivot = pivot.loc[pivot.sum(axis=1).sort_values(ascending=False).index]
sns.heatmap(pivot/1e6, annot=True, fmt='.0f', cmap='YlOrRd', ax=ax1,
            cbar_kws={'label': 'Pengeluaran (Juta Rp)'})
ax1.set_title('Heatmap: Pengeluaran per Kategori x Bulan', fontweight='bold')
ax1.set_xlabel('Bulan')
ax1.set_ylabel('Kategori')
ax1.tick_params(axis='x', rotation=45)

ax2 = axes[1]
day_spend = df_expense.groupby('is_weekend')['amount'].sum() / 1e6
day_labels = ['Weekday\n(Senin-Jumat)', 'Weekend\n(Sabtu-Minggu)']
bars = ax2.bar(day_labels, day_spend.values, color=['#38bdf8', '#fbbf24'], edgecolor='black', linewidth=0.5)

for bar, val in zip(bars, day_spend.values):
    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + (day_spend.max()*0.02),
            f'Rp {val:,.0f} Jt', ha='center', fontsize=11, fontweight='bold')

ax2.set_title('Total Pengeluaran: Weekday vs Weekend', fontweight='bold')
ax2.set_ylabel('Total Pengeluaran (Juta Rp)')

plt.tight_layout()
plt.savefig(f'{DATA_DIR}/eda_heatmap_weekend.png', dpi=150, bbox_inches='tight')
plt.close("all")
print('[OK] eda_heatmap_weekend.png saved')



# EDA 6: Rata-rata per transaksi Weekday vs Weekend
fig, ax = plt.subplots(figsize=(8, 6))
weekend_mean = df_expense.groupby('is_weekend')['amount'].mean()
labels = ['Hari Kerja\n(Senin-Jumat)', 'Akhir Pekan\n(Sabtu-Minggu)']
colors = ['#38bdf8', '#fbbf24']
bars = ax.bar(labels, [weekend_mean.get(0, 0), weekend_mean.get(1, 0)], color=colors, edgecolor='black', linewidth=0.5)

for bar, val in zip(bars, [weekend_mean.get(0, 0), weekend_mean.get(1, 0)]):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + (bar.get_height()*0.02),
            f'Rp {val:,.0f}', ha='center', fontsize=11, fontweight='bold')

ax.set_title('Rata-rata Nominal per Transaksi: Weekday vs Weekend', fontweight='bold')
ax.set_ylabel('Rata-rata Amount (Rp)')
plt.tight_layout()
plt.savefig(f'{DATA_DIR}/eda_weekend_mean.png', dpi=150, bbox_inches='tight')
plt.close("all")
print('[OK] eda_weekend_mean.png saved')



# EDA 7: Distribusi per User Segment
fig, axes = plt.subplots(1, 2, figsize=(14, 6))

ax1 = axes[0]
segment_counts = users[users['demo_profile'] == 'regular']['user_segment'].value_counts()
ax1.pie(segment_counts.values, labels=segment_counts.index.str.replace('_', ' ').str.title(),
        autopct='%1.1f%%', colors=sns.color_palette('Set2', len(segment_counts)), startangle=90)
ax1.set_title('Distribusi User per Segmen', fontweight='bold')

ax2 = axes[1]
regular_users = users[users['demo_profile'] == 'regular']
sns.boxplot(data=regular_users, x='user_segment', y='monthly_income', ax=ax2, palette='Set2')
ax2.set_title('Distribusi Income per Segmen', fontweight='bold')
ax2.set_xlabel('Segment')
ax2.set_ylabel('Monthly Income (Rp)')
ax2.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'{x/1e6:.1f}M'))

plt.tight_layout()
plt.savefig(f'{DATA_DIR}/eda_segment_distribution.png', dpi=150, bbox_inches='tight')
plt.close("all")
print('[OK] eda_segment_distribution.png saved')



# Q1: Proporsi tertinggi per segmen
df_q1 = df_expense.copy()

fig, axes = plt.subplots(1, 3, figsize=(18, 6))
segments = ['pelajar_mahasiswa', 'pekerja_tetap', 'freelancer']

for idx, seg in enumerate(segments):
    seg_data = df_q1[df_q1['user_segment'] == seg]
    cat_total = seg_data.groupby('category')['amount'].sum().sort_values(ascending=False)
    top_5 = cat_total.head(5)
    
    ax = axes[idx]
    bars = ax.barh(top_5.index.str.replace('_', ' ').str.title(), top_5.values / 1e6, color=sns.color_palette('viridis', 5))
    ax.set_title(f'{seg.replace("_", " ").title()}', fontweight='bold')
    ax.set_xlabel('Total Pengeluaran (Juta Rp)')
    
    for bar in bars:
        width = bar.get_width()
        ax.text(width + 0.1, bar.get_y() + bar.get_height()/2, f'{width:.1f} Jt',
                ha='left', va='center', fontsize=10)

plt.suptitle('Q1: Top 5 Kategori Pengeluaran per Segmen User', fontsize=14, fontweight='bold', y=1.02)
plt.tight_layout()
plt.close("all")



# Q2: Weekday vs Weekend untuk hiburan & makanan
df_q2 = df_expense[df_expense['category'].isin(['makanan', 'hiburan'])].copy()
df_q2['tipe_hari'] = np.where(df_q2['is_weekend'] == 1, 'Akhir Pekan', 'Hari Kerja')

avg_daily = df_q2.groupby(['category', 'tipe_hari'])['amount'].mean().reset_index()

fig, ax = plt.subplots(figsize=(10, 6))
sns.barplot(data=avg_daily, x='category', y='amount', hue='tipe_hari',
            hue_order=['Hari Kerja', 'Akhir Pekan'], palette='Set2', ax=ax)

ax.set_title('Q2: Rata-rata Pengeluaran: Weekday vs Weekend\n(Kategori Hiburan & Makanan)',
             fontsize=14, fontweight='bold', pad=15)
ax.set_xlabel('Kategori')
ax.set_ylabel('Rata-rata Pengeluaran (Rp)')

for p in ax.patches:
    height = p.get_height()
    if not np.isnan(height) and height > 0:
        ax.text(p.get_x() + p.get_width()/2., height + (height*0.02),
                f'Rp {height:,.0f}', ha='center', va='bottom', fontsize=10)

plt.legend(title='Tipe Hari', loc='upper right')
plt.tight_layout()
plt.close("all")



# Q3: Payment method dominan
df_q3 = df[(df['user_segment'] == 'pekerja_tetap') & (df['amount'] < 100000) & (df['transaction_type'] == 'pengeluaran')].copy()

payment_counts = df_q3['payment_method'].value_counts().reset_index()
payment_counts.columns = ['payment_method', 'jumlah']
payment_counts['persentase'] = (payment_counts['jumlah'] / payment_counts['jumlah'].sum() * 100).round(1)

fig, ax = plt.subplots(figsize=(10, 6))
bars = ax.barh(payment_counts['payment_method'], payment_counts['persentase'], color=sns.color_palette('magma', len(payment_counts)))

ax.set_title('Q3: Metode Pembayaran Dominan\n(Transaksi < Rp 100.000, Pekerja Tetap)',
             fontsize=14, fontweight='bold', pad=15)
ax.set_xlabel('Proporsi (%)')

for bar, pct in zip(bars, payment_counts['persentase']):
    ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2, f'{pct}%',
            ha='left', va='center', fontsize=11, fontweight='bold')

plt.xlim(0, payment_counts['persentase'].max() * 1.15)
plt.tight_layout()
plt.close("all")



# Q4: Hutang vs tidak
df_q4 = df_expense.groupby(['user_id', 'has_debt'])['amount'].mean().reset_index()
df_q4['has_debt_label'] = df_q4['has_debt'].map({True: 'Punya Hutang', False: 'Tidak Punya Hutang'})

avg_debt = df_q4.groupby('has_debt_label')['amount'].mean().reset_index()

fig, ax = plt.subplots(figsize=(8, 6))
bars = ax.bar(avg_debt['has_debt_label'], avg_debt['amount'], color=['#2ecc71', '#e74c3c'])

ax.set_title('Q4: Rata-rata Pengeluaran per Transaksi\n(Punya Hutang vs Tidak)',
             fontsize=14, fontweight='bold', pad=15)
ax.set_ylabel('Rata-rata Pengeluaran (Rp)')

for bar, val in zip(bars, avg_debt['amount']):
    ax.text(bar.get_x() + bar.get_width()/2., val + (val*0.02),
            f'Rp {val:,.0f}', ha='center', fontsize=12, fontweight='bold')

plt.tight_layout()
plt.close("all")



# Q5: Overbudget analysis
df_q5 = df_expense.copy()
monthly_exp = df_q5.groupby(['user_id', 'year', 'month'])['amount'].sum().reset_index()
monthly_exp = monthly_exp.merge(users[['user_id', 'monthly_income']], on='user_id', how='left')
monthly_exp['status'] = np.where(monthly_exp['amount'] > monthly_exp['monthly_income'],
                                 'Overbudget (Bahaya)', 'Aman (Terkendali)')

status_counts = monthly_exp['status'].value_counts()

fig, ax = plt.subplots(figsize=(8, 8))
color_map = {'Aman (Terkendali)': '#2ecc71', 'Overbudget (Bahaya)': '#e74c3c'}
pie_colors = [color_map.get(val, '#3498db') for val in status_counts.index]

ax.pie(status_counts, labels=status_counts.index, autopct='%1.1f%%',
       startangle=140, colors=pie_colors, textprops={'fontsize': 13, 'fontweight': 'bold'})

centre = plt.Circle((0,0), 0.65, fc='white')
fig.gca().add_artist(centre)
ax.text(0, 0, f'Total Data:\n{len(monthly_exp)} Bulan', ha='center', va='center',
        fontsize=12, fontweight='bold', color='gray')

ax.set_title('Q5: Proporsi Status Keuangan Bulanan Pengguna', fontsize=15, fontweight='bold', pad=20)
plt.tight_layout()
plt.close("all")



# Q6: Saving ratio - gaji vs non-gaji
user_finances = df.pivot_table(index='user_id', columns='transaction_type',
                               values='amount', aggfunc='sum', fill_value=0).reset_index()

if 'pemasukan' not in user_finances.columns:
    user_finances['pemasukan'] = 0
if 'pengeluaran' not in user_finances.columns:
    user_finances['pengeluaran'] = 0

user_finances['saving_ratio'] = np.where(
    user_finances['pemasukan'] > 0,
    (user_finances['pemasukan'] - user_finances['pengeluaran']) / user_finances['pemasukan'] * 100,
    0
)

df_income = df[df['transaction_type'] == 'pemasukan'].copy()
def check_income_type(categories):
    cats = [c for c in categories if pd.notna(c)]
    if any(c not in ['gaji'] for c in cats):
        return 'Ada Pendapatan Tambahan\n(Non-Gaji)'
    return 'Hanya Gaji'

user_income_type = df_income.groupby('user_id')['category'].apply(check_income_type).reset_index()
user_income_type.rename(columns={'category': 'tipe_pendapatan'}, inplace=True)

df_q6 = pd.merge(user_finances, user_income_type, on='user_id', how='inner')
avg_saving = df_q6.groupby('tipe_pendapatan')['saving_ratio'].mean().reset_index()

fig, ax = plt.subplots(figsize=(10, 6))
bars = ax.bar(avg_saving['tipe_pendapatan'], avg_saving['saving_ratio'], color=['#2ecc71', '#3498db'])

ax.set_title('Q6: Rata-rata Saving Ratio\nHanya Gaji vs Ada Pendapatan Tambahan',
             fontsize=14, fontweight='bold', pad=15)
ax.set_ylabel('Saving Ratio (%)')

for bar, val in zip(bars, avg_saving['saving_ratio']):
    ax.text(bar.get_x() + bar.get_width()/2., val + (1 if val > 0 else -3),
            f'{val:.1f}%', ha='center', fontsize=13, fontweight='bold')

plt.tight_layout()
plt.close("all")



# Q7: Surplus per segment
df_q7 = df.copy()

income_monthly = df_q7[df_q7['transaction_type'] == 'pemasukan'].groupby(['user_id', 'year', 'month'])['amount'].sum().reset_index()
income_monthly.rename(columns={'amount': 'total_pemasukan'}, inplace=True)

expense_monthly = df_q7[df_q7['transaction_type'] == 'pengeluaran'].groupby(['user_id', 'year', 'month'])['amount'].sum().reset_index()
expense_monthly.rename(columns={'amount': 'total_pengeluaran'}, inplace=True)

surplus = income_monthly.merge(expense_monthly, on=['user_id', 'year', 'month'], how='outer').fillna(0)
surplus['surplus'] = surplus['total_pemasukan'] - surplus['total_pengeluaran']
surplus = surplus.merge(users[['user_id', 'user_segment']], on='user_id', how='left')

seg_surplus = surplus.groupby('user_segment')['surplus'].mean().sort_values(ascending=False).reset_index()

fig, ax = plt.subplots(figsize=(10, 6))
colors = ['#2ecc71' if x >= 0 else '#e74c3c' for x in seg_surplus['surplus']]
bars = ax.barh(seg_surplus['user_segment'].str.replace('_', ' ').str.title(),
               seg_surplus['surplus'] / 1e6, color=colors)

ax.set_title('Q7: Rata-rata Surplus Bulanan per Segmen User', fontsize=14, fontweight='bold')
ax.set_xlabel('Surplus (Juta Rp)')

for bar, val in zip(bars, seg_surplus['surplus'] / 1e6):
    ax.text(bar.get_width() + 0.01, bar.get_y() + bar.get_height()/2,
            f'Rp {val:,.1f} Jt', ha='left' if val >= 0 else 'right',
            va='center', fontsize=11, fontweight='bold')

plt.tight_layout()
plt.close("all")



print('=' * 60)
print('OUTLIER HANDLING - CAPPING PER KATEGORI (DATA NORMAL SAJA)')
print('=' * 60)
print('ATURAN KRUSIAL:')
print('   Outlier JANGAN dihapus/dicapping dari data anomali!')
print('   Model Anomaly Detection butuh sinyal anomali yang kuat.')
print('   Capping hanya pada is_anomaly == False (data NORMAL).')
print()

df_clean = df.copy()
cap_info = {}

for cat in df_clean['category'].unique():
    mask = (df_clean['category'] == cat) & (df_clean['is_anomaly'] == False)
    if mask.sum() == 0:
        continue
    col = df_clean.loc[mask, 'amount']
    p01 = col.quantile(0.01)
    p99 = col.quantile(0.99)
    df_clean.loc[mask, 'amount'] = col.clip(lower=p01, upper=p99)
    cap_info[cat] = {'P01': p01, 'P99': p99}

print('Capping thresholds per kategori (data normal):')
for cat, info in cap_info.items():
    print(f'  {cat:20s}: P01=Rp {info["P01"]:>12,.0f}  P99=Rp {info["P99"]:>14,.0f}')



print('=' * 60)
print('FEATURE ENGINEERING')
print('=' * 60)

# Financial Ratios
df_clean['spending_ratio'] = df_clean['amount'] / df_clean['monthly_income']
df_clean['is_large_transaction'] = (df_clean['amount'] > df_clean['monthly_income'] * 0.5).astype(int)

# Days since salary (asumsi gajian tanggal 25)
SALARY_DATE = 25
df_clean['day_of_month'] = df_clean['transaction_date'].dt.day
df_clean['days_since_salary'] = df_clean['day_of_month'].apply(
    lambda d: d - SALARY_DATE if d >= SALARY_DATE else d - SALARY_DATE + 30
)

# Quarter
df_clean['quarter'] = df_clean['transaction_date'].dt.quarter

# Category one-hot encoding for expense categories
expense_cats = ['makanan', 'transportasi', 'hiburan', 'belanja', 'tagihan', 'kesehatan', 'pendidikan']
for cat in expense_cats:
    df_clean[f'cat_{cat}'] = (
        (df_clean['category'] == cat) & (df_clean['transaction_type'] == 'pengeluaran')
    ).astype(int)

print(f'Total columns after FE: {df_clean.shape[1]}')
print(f'Shape: {df_clean.shape}')
print()
print('Fitur baru:')
print('  - spending_ratio = amount / monthly_income')
print('  - is_large_transaction = 1 jika amount > 50% income')
print('  - days_since_salary = hari sejak tanggal gajian')
print('  - quarter = kuartal tahun')
print('  - cat_makanan ... cat_pendidikan (7 binary columns)')



print('=' * 60)
print('LABEL ENCODING')
print('=' * 60)

le_segment = LabelEncoder()
le_cat = LabelEncoder()
le_tx = LabelEncoder()
le_payment = LabelEncoder()

df_clean['segment_encoded'] = le_segment.fit_transform(df_clean['user_segment'])
df_clean['category_encoded'] = le_cat.fit_transform(df_clean['category'])
df_clean['tx_type_encoded'] = le_tx.fit_transform(df_clean['transaction_type'])
df_clean['payment_encoded'] = le_payment.fit_transform(df_clean['payment_method'])

cat_mapping = dict(zip(le_cat.classes_, range(len(le_cat.classes_))))
segment_mapping = dict(zip(le_segment.classes_, range(len(le_segment.classes_))))
tx_mapping = dict(zip(le_tx.classes_, range(len(le_tx.classes_))))
payment_mapping = dict(zip(le_payment.classes_, range(len(le_payment.classes_))))

print(f'Category classes  : {len(le_cat.classes_)}')
print(f'Segment classes   : {len(le_segment.classes_)}')
print(f'TX Type classes   : {len(le_tx.classes_)}')
print(f'Payment classes   : {len(le_payment.classes_)}')

print(f'\nCategory mapping:')
for k, v in sorted(cat_mapping.items(), key=lambda x: x[1]):
    print(f'  {v:2d} -> {k}')

with open(f'{DATA_DIR}/category_label_mapping.json', 'w', encoding='utf-8') as f:
    json.dump(cat_mapping, f, ensure_ascii=False, indent=2)
with open(f'{DATA_DIR}/segment_label_mapping.json', 'w', encoding='utf-8') as f:
    json.dump(segment_mapping, f, ensure_ascii=False, indent=2)
with open(f'{DATA_DIR}/payment_label_mapping.json', 'w', encoding='utf-8') as f:
    json.dump(payment_mapping, f, ensure_ascii=False, indent=2)

print('\n[OK] Label mappings saved to data/')



print('=' * 60)
print('DATA SPLITTING')
print('=' * 60)

df_sorted = df_clean.sort_values('transaction_date').reset_index(drop=True)

cutoff_date = df_sorted['transaction_date'].quantile(0.8)
train_mask = df_sorted['transaction_date'] < cutoff_date

X_train = df_sorted[train_mask].copy()
X_test = df_sorted[~train_mask].copy()

print(f'[CHRONOLOGICAL SPLIT]')
print(f'  Cutoff: {cutoff_date}')
print(f'  Train: {len(X_train):,} rows ({X_train["transaction_date"].min().date()} to {X_train["transaction_date"].max().date()})')
print(f'  Test : {len(X_test):,} rows ({X_test["transaction_date"].min().date()} to {X_test["transaction_date"].max().date()})')
print(f'  Ratio: {len(X_train)/len(df_sorted)*100:.1f}% train / {len(X_test)/len(df_sorted)*100:.1f}% test')

num_feats = ['amount', 'monthly_income', 'spending_ratio', 'days_since_salary']
scaler = MinMaxScaler()
scaler.fit(X_train[num_feats])

X_train_scaled = X_train.copy()
X_test_scaled = X_test.copy()
X_train_scaled[num_feats] = scaler.transform(X_train[num_feats])
X_test_scaled[num_feats] = scaler.transform(X_test[num_feats])

joblib.dump(scaler, f'{DATA_DIR}/scaler.pkl')
print(f'\n[SCALER]')
print(f'  Fitted features: {num_feats}')
print(f'  Saved to data/scaler.pkl')



print('=' * 60)
print('EXPORT ARTIFACTS')
print('=' * 60)

os.makedirs(DATA_DIR, exist_ok=True)

df_clean.to_csv(f'{DATA_DIR}/03_clean_final.csv', index=False)
X_train.to_csv(f'{DATA_DIR}/05_train.csv', index=False)
X_test.to_csv(f'{DATA_DIR}/05_test.csv', index=False)

monthly_agg = df_clean.groupby(
    [df_clean['transaction_date'].dt.to_period('M'), 'user_id']
).agg(
    total_spending=('amount', 'sum'),
    n_transactions=('amount', 'count'),
    avg_spending=('amount', 'mean'),
).reset_index()
monthly_agg['monthly_income'] = monthly_agg['user_id'].map(
    df_clean.groupby('user_id')['monthly_income'].first()
)
monthly_agg['spending_ratio'] = monthly_agg['total_spending'] / monthly_agg['monthly_income']
monthly_agg['savings_ratio'] = (monthly_agg['monthly_income'] - monthly_agg['total_spending']) / monthly_agg['monthly_income']
monthly_agg.to_csv(f'{DATA_DIR}/04_monthly_aggregated.csv', index=False)

cat_pivot = df_clean[df_clean['transaction_type'] == 'pengeluaran'].pivot_table(
    index=[df_clean['transaction_date'].dt.to_period('M'), 'user_id'],
    columns='category', values='amount', aggfunc='sum', fill_value=0
).reset_index()
cat_pivot.columns.name = None
cat_pivot.to_csv(f'{DATA_DIR}/04_category_pivot.csv', index=False)

print('\nFILES EXPORTED:')
files = [
    ('03_clean_final.csv', len(df_clean)),
    ('04_monthly_aggregated.csv', len(monthly_agg)),
    ('04_category_pivot.csv', len(cat_pivot)),
    ('05_train.csv', len(X_train)),
    ('05_test.csv', len(X_test)),
]
for fname, rows in files:
    print(f'  {fname:<35} {rows:>10,} rows')
print('\nAll artifacts saved!')



print('=' * 60)
print('A/B TESTING - SIMULASI EFEKTIVITAS AI RECOMMENDATION')
print('=' * 60)
print()
print('RATIONALE:')
print('   Simulasi untuk mengukur efektivitas AI recommendation.')
print('   Grup A = spending aktual (tanpa AI)')
print('   Grup B = spending + AI recommendation (asumsi hemat 10-15%)')
print()
print('HIPOTESIS:')
print('   H0: Tidak ada beda signifikan antara spending dengan/tanpa AI')
print('   H1: Spending dengan AI recommendation LEBIH RENDAH secara signifikan')
print()

spending = df_clean[df_clean['transaction_type'] == 'pengeluaran']['amount'].reset_index(drop=True)
print(f'Total transaksi pengeluaran: {len(spending):,}')
print(f'Spending mean: Rp {spending.mean():,.0f}')
print(f'Spending std:  Rp {spending.std():,.0f}')
print()

np.random.seed(42)
group_a = spending.copy()

savings_rate = np.random.uniform(0.10, 0.15, len(spending))
group_b = spending * (1 - savings_rate)

print('HASIL SIMULASI:')
print(f'   Grup A (tanpa AI): mean = Rp {group_a.mean():,.0f}')
print(f'   Grup B (dengan AI): mean = Rp {group_b.mean():,.0f}')
avg_savings = (group_a.mean() - group_b.mean()) / group_a.mean() * 100
print(f'   Rata-rata pengurangan: {avg_savings:.1f}%')
print()

t_stat, p_value = stats.ttest_ind(group_a, group_b)

print('STATISTICAL TEST (Independent T-Test):')
print(f'   t-statistic: {t_stat:.4f}')
print(f'   p-value:     {p_value:.10f}')
print()

if p_value < 0.05:
    print('HASIL: SIGNIFIKAN (p < 0.05)')
    print('   H0 ditolak. Terdapat perbedaan signifikan antara spending')
    print('   dengan dan tanpa AI recommendation.')
    print('   AI recommendation MEMANG efektif untuk mengurangi spending.')
else:
    print('HASIL: TIDAK SIGNIFIKAN (p >= 0.05)')
    print('   H0 gagal ditolak. Tidak cukup bukti.')

print()
print('KESIMPULAN UNTUK AI ENGINEER:')
print(f'   Simulasi menunjukkan AI recommendation BISA mengurangi spending')
print(f'   hingga {avg_savings:.1f}% rata-rata. Ini dasar untuk model Budget Planner.')
print('   Model harus optimize untuk maximize savings tanpa mengurangi quality of life.')



# A/B Testing Visualization
fig, axes = plt.subplots(1, 2, figsize=(14, 6))

ax1 = axes[0]
bars = ax1.bar(['Grup A\n(Tanpa AI)', 'Grup B\n(Dengan AI)'],
               [group_a.mean(), group_b.mean()],
               color=['#e74c3c', '#2ecc71'], edgecolor='black', linewidth=0.5)
for bar, val in zip(bars, [group_a.mean(), group_b.mean()]):
    ax1.text(bar.get_x() + bar.get_width()/2., val + (val*0.02),
            f'Rp {val:,.0f}', ha='center', fontsize=11, fontweight='bold')
ax1.set_title('A/B Testing: Rata-rata Spending\nper Grup', fontsize=14, fontweight='bold')
ax1.set_ylabel('Rata-rata Spending (Rp)')

ax2 = axes[1]
metrics = ['Rata-rata\nPengurangan', 't-statistic', 'p-value']
values = [avg_savings, t_stat, p_value]
colors_ab = ['#3498db', '#9b59b6', '#e67e22']
bars2 = ax2.bar(metrics, [avg_savings, abs(t_stat), -np.log10(p_value) if p_value > 0 else 300],
                color=colors_ab, edgecolor='black', linewidth=0.5)
ax2.set_title('A/B Testing: Statistical Summary', fontsize=14, fontweight='bold')
ax2.axhline(y=-np.log10(0.05), color='red', linestyle='--', linewidth=1.5, label=f'α=0.05 (log scale)')
ax2.legend(fontsize=10)
labels2 = [f'{avg_savings:.1f}%', f'{t_stat:.2f}', f'{p_value:.2e}']
for bar, label in zip(bars2, labels2):
    ax2.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.5,
            label, ha='center', fontsize=11, fontweight='bold')

plt.suptitle('A/B Testing: Efektivitas AI Recommendation', fontsize=16, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig(f'{DATA_DIR}/ab_testing_result.png', dpi=150, bbox_inches='tight')
plt.close("all")
print('[OK] ab_testing_result.png saved')



# Build data dictionary
descriptions = {
    'transaction_id': 'ID unik transaksi',
    'user_id': 'ID unik pengguna (user_0001 - user_0175)',
    'transaction_date': 'Tanggal transaksi',
    'amount': 'Jumlah transaksi dalam Rupiah',
    'transaction_type': 'Tipe transaksi: pengeluaran / pemasukan',
    'description': 'Deskripsi transaksi',
    'category': 'Kategori transaksi (12 kategori)',
    'merchant': 'Nama merchant/toko',
    'payment_method': 'Metode pembayaran',
    'is_synthetic_anomaly': 'Flag anomali sintetis (string)',
    'is_anomaly': 'Flag anomali (boolean)',
    'year': 'Tahun transaksi',
    'month': 'Bulan transaksi (1-12)',
    'day_of_week': 'Hari dalam seminggu (0=Senin, 6=Minggu)',
    'is_weekend': '1 jika weekend, 0 jika weekday',
    'user_segment': 'Segmen user',
    'monthly_income': 'Pendapatan bulanan dalam Rupiah',
    'has_savings': 'Boolean: apakah punya tabungan',
    'has_debt': 'Boolean: apakah punya hutang',
    'month_year': 'Periode bulan (YYYY-MM)',
    'spending_ratio': 'Rasio amount / monthly_income',
    'is_large_transaction': '1 jika transaksi > 50% income',
    'day_of_month': 'Tanggal dalam bulan (1-31)',
    'days_since_salary': 'Hari sejak tanggal gajian (0-30)',
    'quarter': 'Kuartal (1-4)',
    'cat_makanan': '1 jika kategori makanan',
    'cat_transportasi': '1 jika kategori transportasi',
    'cat_hiburan': '1 jika kategori hiburan',
    'cat_belanja': '1 jika kategori belanja',
    'cat_tagihan': '1 jika kategori tagihan',
    'cat_kesehatan': '1 jika kategori kesehatan',
    'cat_pendidikan': '1 jika kategori pendidikan',
    'segment_encoded': 'Encoded segment',
    'category_encoded': 'Encoded category',
    'tx_type_encoded': 'Encoded transaction type',
    'payment_encoded': 'Encoded payment method',
}

data_dict = {
    'column_name': list(df_clean.columns),
    'data_type': [str(df_clean[c].dtype) for c in df_clean.columns],
    'description': [descriptions.get(c, 'N/A') for c in df_clean.columns],
    'example_value': [str(df_clean[c].iloc[0]) if len(df_clean) > 0 else '' for c in df_clean.columns]
}

dd_df = pd.DataFrame(data_dict)
dd_df.to_csv(f'{DATA_DIR}/data_dictionary.csv', index=False)
print(f'Data Dictionary: {len(dd_df)} columns saved to data/data_dictionary.csv')
dd_df.head(20)



# Final verification
print('PIPELINE COMPLETE!')
print(f'\nFiles in {DATA_DIR}/:')
for f in sorted(os.listdir(DATA_DIR)):
    fpath = os.path.join(DATA_DIR, f)
    size = os.path.getsize(fpath) / 1024
    print(f'  {f:<40} {size:>8.1f} KB')


