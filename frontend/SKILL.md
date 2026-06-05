# DompetCerdas AI — Design Skill File
# Style: Bento (Default) | Light Warm Fintech
# For: Cline, Claude Code, Cursor, or any AI coding agent

---

## Mission

DompetCerdas AI adalah aplikasi keuangan personal full-stack dengan AI/ML layer.
UI harus mencerminkan: **kepercayaan, kejelasan data, dan kecerdasan yang transparan**.

Design style: **Bento Grid Light Warm** — modular card blocks di atas warm cream canvas,
peach primary accent, Inter typography, data-first hierarchy.

---

## Color Tokens

Semua warna harus memakai Tailwind class atau CSS variable — tidak boleh hardcode hex.

### Tailwind Config Override (tambahkan ke tailwind.config.js)

```js
// tailwind.config.js — extend.colors
colors: {
  primary:   '#FAD4C0',   // peach — interactive elements, highlighted blocks, CTA accent
  secondary: '#80A1C1',   // muted blue — supporting actions, complementary accents
  surface:   '#FFF5E6',   // cream — card fills, page background
  text:      '#111827',   // near-black — body text, headings
  success:   '#16A34A',   // green — positive feedback, income, valid states
  warning:   '#D97706',   // amber — caution, budget near-limit
  danger:    '#DC2626',   // red — errors, budget exceeded, anomaly high
  muted:     '#6B7280',   // gray — placeholder, metadata, secondary text
  border:    '#E8D5C4',   // warm border — card edges, dividers
}
```

### Palette Lengkap

| Token       | Hex       | Tailwind equiv         | Digunakan untuk                              |
|-------------|-----------|------------------------|----------------------------------------------|
| `primary`   | `#FAD4C0` | `bg-[#FAD4C0]`         | CTA accent, highlighted card tint, active    |
| `secondary` | `#80A1C1` | `bg-[#80A1C1]`         | Supporting actions, secondary highlight      |
| `surface`   | `#FFF5E6` | `bg-[#FFF5E6]`         | Page background, card fills                  |
| `text`      | `#111827` | `text-gray-900`        | Body text, headings                          |
| `muted`     | `#6B7280` | `text-gray-500`        | Placeholder, metadata, caption               |
| `border`    | `#E8D5C4` | `border-[#E8D5C4]`     | Card border, input border, divider           |
| `success`   | `#16A34A` | `text-green-600`       | Income, budget safe, health good             |
| `warning`   | `#D97706` | `text-amber-600`       | Budget 80%+, anomaly medium                  |
| `danger`    | `#DC2626` | `text-red-600`         | Expense negative, budget exceeded, error     |

### Surface Hierarchy (light, lightest to slightly darker)

```
bg-[#FFF5E6]          → page background (body / app root)
bg-white              → primary card surface
bg-[#FAD4C0]/20       → tinted card (primary accent subtle)
bg-[#80A1C1]/10       → secondary tinted card
bg-[#FAD4C0]/40       → highlighted / active card
```

### CSS Variables (tambahkan ke index.css)

```css
:root {
  --color-primary:    #FAD4C0;
  --color-secondary:  #80A1C1;
  --color-surface:    #FFF5E6;
  --color-text:       #111827;
  --color-muted:      #6B7280;
  --color-border:     #E8D5C4;
  --color-success:    #16A34A;
  --color-warning:    #D97706;
  --color-danger:     #DC2626;
}
```

### Semantic Color Usage

```
Pemasukan / income          → text-green-600, bg-green-50 border border-green-200
Pengeluaran / expense       → text-red-600, bg-red-50 border border-red-200
Budget aman                 → text-green-600
Budget hampir habis (>80%)  → text-amber-600, bg-amber-50
Budget exceeded             → text-red-600, bg-red-50
Anomali tinggi (≥0.9)       → text-red-600, bg-red-50 border border-red-200
Anomali sedang (≥0.5)       → text-amber-600, bg-amber-50
AI/ML suggestion            → text-[#80A1C1], bg-[#80A1C1]/10 border border-[#80A1C1]/30
Info netral                 → text-blue-600, bg-blue-50
```

---

## Typography

**Font:** Inter — satu-satunya font untuk seluruh aplikasi.

```css
/* Pastikan ada di index.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap');

body {
  font-family: 'Inter', system-ui, sans-serif;
  background-color: #FFF5E6;
  color: #111827;
}
```

**Type scale:**

```
text-3xl font-bold    (30px/700) : hero value, large stat
text-2xl font-bold    (24px/700) : page title h1
text-xl font-semibold (20px/600) : section heading, large stat value
text-lg font-semibold (18px/600) : card title, sub-section header
text-base font-medium (16px/500) : label, important body
text-sm font-medium   (14px/500) : badge text, form label, table header
text-sm               (14px/400) : body text, description
text-xs font-medium   (12px/500) : tag, metadata label
text-xs               (12px/400) : caption, timestamp, disclaimer
```

**Warna teks:**

```
text-gray-900   → heading, nilai penting, angka utama
text-gray-700   → body text, deskripsi
text-gray-500   → placeholder, metadata, caption
text-green-600  → nilai positif (pemasukan, aman)
text-red-600    → nilai negatif (pengeluaran, bahaya)
text-amber-600  → peringatan
text-[#80A1C1]  → secondary accent, AI suggestion
```

---

## Spacing

4px base unit. Scale: `4 / 8 / 12 / 16 / 24 / 32px`.

```
p-1=4px   p-2=8px   p-3=12px  p-4=16px  p-5=20px  p-6=24px  p-8=32px
gap-2=8px  gap-3=12px  gap-4=16px  gap-6=24px  gap-8=32px
```

Internal card padding: `p-5` atau `p-6` untuk card utama, `p-4` untuk card compact.

---

## Border & Radius

```
rounded-2xl    : bento card utama, modal
rounded-xl     : button, input, inner card
rounded-lg     : badge, tag, small element
rounded-full   : avatar, pill badge
```

Border:
```
border border-[#E8D5C4]           : card standar
border border-[#FAD4C0]           : card primary/highlighted
border border-green-200           : success state
border border-amber-200           : warning state
border border-red-200             : danger state
border border-dashed border-[#E8D5C4] : empty state
```

---

## Bento Grid Layout System

### Prinsip inti

Setiap page layout menggunakan CSS Grid dengan ukuran cell bervariasi (asimetris).
Setiap bento cell adalah unit mandiri — kontennya harus bermakna tanpa bergantung pada cell sebelah.

### Struktur grid

```html
<!-- Bento grid container -->
<div class="grid grid-cols-12 gap-4">
  <!-- Cell sizes -->
  <div class="col-span-3">  <!-- 1/4 width — small metric -->
  <div class="col-span-4">  <!-- 1/3 width — stat card -->
  <div class="col-span-6">  <!-- 1/2 width — chart, list -->
  <div class="col-span-8">  <!-- 2/3 width — primary chart -->
  <div class="col-span-12"> <!-- full width — banner, table -->
```

### Aturan asimetri (wajib)

Setiap section grid HARUS menggunakan minimal 3 ukuran col-span berbeda.
Jangan buat semua card ukuran sama — itu bukan bento grid.

**Contoh layout Dashboard:**
```
[ col-span-3: Saldo  ][ col-span-3: Income ][ col-span-3: Expense ][ col-span-3: Score ]
[ col-span-8: Spending Chart (tall)        ][ col-span-4: Health + Prediksi            ]
[ col-span-12: Recent Transactions                                                      ]
```

**Contoh layout Budget:**
```
[ col-span-4: Kebutuhan 50% ][ col-span-4: Keinginan 30% ][ col-span-4: Tabungan 20% ]
[ col-span-8: Progress bars by category    ][ col-span-4: Total summary               ]
```

### Row height

```
row-span-1  : compact — badge card, single metric
row-span-2  : standard — kebanyakan card
row-span-3  : tall — chart utama, list dengan scroll
```

### Responsive

```
Mobile  (<768px)  : semua cell → col-span-12
Tablet  (≥768px)  : minimal col-span-6
Desktop (≥1024px) : full asymmetric grid

Tailwind pattern:
col-span-12 md:col-span-6 lg:col-span-3
col-span-12 md:col-span-6 lg:col-span-8
```

---

## Component Rules

### Bento Card (base)

```jsx
// Card standar
<div className="bg-white border border-[#E8D5C4] rounded-2xl p-5 shadow-sm">

// Card primary/highlighted (peach tint)
<div className="bg-[#FAD4C0]/20 border border-[#FAD4C0] rounded-2xl p-5">

// Card secondary (blue tint — AI/ML suggestion)
<div className="bg-[#80A1C1]/10 border border-[#80A1C1]/30 rounded-2xl p-5">

// Card success
<div className="bg-green-50 border border-green-200 rounded-2xl p-5">

// Card warning
<div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">

// Card danger
<div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">

// Empty state
<div className="bg-white border border-dashed border-[#E8D5C4] rounded-2xl p-8 text-center">

// Card dengan table di dalamnya (overflow handled)
<div className="bg-white border border-[#E8D5C4] rounded-2xl overflow-hidden">
```

### Stat Card (bento cell)

```jsx
<div className="bg-white border border-[#E8D5C4] rounded-2xl p-5 space-y-3">
  <div className="flex items-center justify-between">
    <span className="text-sm text-gray-500">{label}</span>
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
      <Icon size={18} className={iconColor} />
    </div>
  </div>
  {loading
    ? <div className="h-8 w-32 bg-[#FAD4C0]/40 rounded animate-pulse" />
    : <p className="text-2xl font-bold text-gray-900">{value}</p>
  }
  {sub && <p className="text-xs text-gray-500">{sub}</p>}
</div>
```

Icon background variants:
```
primary   : bg-[#FAD4C0] text-[#7C4A2D]
secondary : bg-[#80A1C1]/20 text-[#2C5282]
success   : bg-green-100 text-green-700
danger    : bg-red-100 text-red-700
warning   : bg-amber-100 text-amber-700
```

### Button

```jsx
// Primary CTA
<button className="flex items-center gap-2 px-4 py-2.5 bg-[#FAD4C0] hover:bg-[#f0c4b0] text-[#7C4A2D] rounded-xl font-semibold text-sm transition-colors border border-[#f0c4b0] shadow-sm">

// Secondary
<button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E8D5C4] text-gray-600 hover:bg-[#FFF5E6] hover:text-gray-900 text-sm transition-colors">

// Danger
<button className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-medium text-sm transition-colors">

// Icon button
<button className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-[#FAD4C0]/30 transition-colors">
```

### Input / Select

```jsx
<input className="w-full bg-white border border-[#E8D5C4] rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] focus:ring-2 focus:ring-[#FAD4C0]/40 transition-colors" />

<select className="w-full bg-white border border-[#E8D5C4] rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#FAD4C0] focus:ring-2 focus:ring-[#FAD4C0]/40 transition-colors" />
```

### Badge

Base: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`

```jsx
// Status badges
"bg-green-100 text-green-700 border border-green-200"    // success / income
"bg-red-100 text-red-700 border border-red-200"          // danger / expense
"bg-amber-100 text-amber-700 border border-amber-200"    // warning
"bg-[#80A1C1]/10 text-[#2C5282] border border-[#80A1C1]/30" // AI suggestion
"bg-gray-100 text-gray-600 border border-gray-200"       // neutral

// Category badges (update categories.js sesuai warna baru)
makanan:       'bg-orange-100 text-orange-700 border border-orange-200'
transportasi:  'bg-blue-100 text-blue-700 border border-blue-200'
belanja:       'bg-pink-100 text-pink-700 border border-pink-200'
tagihan:       'bg-red-100 text-red-700 border border-red-200'
hiburan:       'bg-purple-100 text-purple-700 border border-purple-200'
kesehatan:     'bg-teal-100 text-teal-700 border border-teal-200'
pendidikan:    'bg-cyan-100 text-cyan-700 border border-cyan-200'
kos_sewa:      'bg-yellow-100 text-yellow-700 border border-yellow-200'
lainnya:       'bg-gray-100 text-gray-600 border border-gray-200'
gaji:          'bg-green-100 text-green-700 border border-green-200'
freelance:     'bg-emerald-100 text-emerald-700 border border-emerald-200'
bonus:         'bg-lime-100 text-lime-700 border border-lime-200'
```

### AI Suggestion Badge

Gunakan secondary (muted blue) untuk semua AI/ML output:

```jsx
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#80A1C1]/10 text-[#2C5282] border border-[#80A1C1]/30">
  <Sparkles size={10} />
  AI
</span>
```

### Anomaly Score → Badge Color

```
score >= 0.9  → bg-red-100 text-red-700 border-red-200       "Sangat Tinggi"
score >= 0.7  → bg-orange-100 text-orange-700 border-orange-200  "Tinggi"
score >= 0.5  → bg-amber-100 text-amber-700 border-amber-200  "Sedang"
default       → bg-gray-100 text-gray-600 border-gray-200    "Rendah"
```

### Confidence Badge (Prediksi)

```
'high'           → bg-green-100 text-green-700
'medium'         → bg-amber-100 text-amber-700
'low'            → bg-red-100 text-red-700
'simple_average' → bg-gray-100 text-gray-600
```

### Progress Bar (Budget)

```jsx
<div className="h-2 bg-[#E8D5C4] rounded-full overflow-hidden">
  <div
    className={`h-full rounded-full transition-all duration-700 ${
      percentage > 80 ? 'bg-amber-400' : colorClass
    }`}
    style={{ width: `${Math.min(percentage, 100)}%` }}
  />
</div>
```

Bar color per kategori: sesuaikan dari `categories.js` ke tone yang lebih light.

### Alert Banner

```jsx
// Warning
<div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
  <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
  <p className="text-sm text-amber-800">{message}</p>
</div>

// Danger
<div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
  <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
  <p className="text-sm text-red-800">{message}</p>
</div>
```

### Loading States

```jsx
// Page spinner — warna primary
<div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#FAD4C0]" />

// Skeleton — warna warm
<div className="h-8 w-32 bg-[#FAD4C0]/40 rounded animate-pulse" />
<div className="h-4 w-24 bg-[#E8D5C4] rounded animate-pulse" />

// Button loading
<span className="w-4 h-4 border-2 border-[#7C4A2D]/30 border-t-[#7C4A2D] rounded-full animate-spin" />
```

---

## Page Layout Rules

### AppLayout structure

```
bg-[#FFF5E6] (page background)
├── TopHeader (sticky, h-16, z-50, bg-white border-b border-[#E8D5C4])
├── Sidebar (desktop, bg-white border-r border-[#E8D5C4])
└── Main content (overflow-y-auto, p-4 md:p-6)
    └── max-w container mx-auto
Bottom Tab Bar (mobile, bg-white border-t border-[#E8D5C4])
```

### Max-width per halaman

```
Dashboard, Transaksi, Anomali  : max-w-7xl mx-auto
Budget, Prediksi               : max-w-5xl mx-auto
Chat                           : max-w-4xl mx-auto
Profil                         : max-w-2xl mx-auto
```

### Sidebar active state

```jsx
// Active nav item
"bg-[#FAD4C0]/40 text-[#7C4A2D] border-r-2 border-[#FAD4C0]"

// Inactive nav item
"text-gray-500 hover:bg-[#FFF5E6] hover:text-gray-900"
```

### Chat bubbles

```jsx
// User bubble (kanan)
"bg-[#FAD4C0] text-[#7C4A2D] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs ml-auto"

// AI bubble (kiri)
"bg-white border border-[#E8D5C4] text-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-sm"
```

---

## Global CSS Overrides

Tambahkan ke `src/index.css` — gantikan dark utility classes:

```css
/* Bento Light Theme — override dark defaults */
body {
  background-color: #FFF5E6;
  color: #111827;
}

.card {
  @apply bg-white border border-[#E8D5C4] rounded-2xl p-6 shadow-sm;
}

.card-hover {
  @apply card transition-all duration-200
         hover:border-[#FAD4C0]
         hover:shadow-md hover:shadow-[#FAD4C0]/20;
}

.btn-primary {
  @apply bg-[#FAD4C0] hover:bg-[#f0c4b0] text-[#7C4A2D] font-semibold
         px-4 py-2.5 rounded-xl transition-all duration-200 border border-[#f0c4b0]
         focus:outline-none focus:ring-2 focus:ring-[#FAD4C0]
         focus:ring-offset-2 focus:ring-offset-[#FFF5E6]
         disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-secondary {
  @apply bg-white hover:bg-[#FFF5E6] text-gray-700 font-semibold
         px-4 py-2.5 rounded-xl border border-[#E8D5C4]
         hover:border-[#FAD4C0] transition-all duration-200;
}

.btn-danger {
  @apply bg-red-50 hover:bg-red-100 text-red-600
         border border-red-200 hover:border-red-300
         font-semibold px-4 py-2.5 rounded-xl transition-all duration-200;
}

.badge {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
}

.badge-green  { @apply badge bg-green-100 text-green-700 border border-green-200; }
.badge-red    { @apply badge bg-red-100 text-red-700 border border-red-200; }
.badge-yellow { @apply badge bg-amber-100 text-amber-700 border border-amber-200; }
.badge-blue   { @apply badge bg-blue-100 text-blue-700 border border-blue-200; }
.badge-gray   { @apply badge bg-gray-100 text-gray-600 border border-gray-200; }

.input {
  @apply bg-white border border-[#E8D5C4] text-gray-900
         placeholder-gray-400 rounded-xl px-4 py-2.5 w-full
         transition-all duration-200
         focus:outline-none focus:ring-2 focus:ring-[#FAD4C0]/50
         focus:border-[#FAD4C0] hover:border-[#FAD4C0]/60;
}
```

---

## Tailwind Config Update

```js
// tailwind.config.js — gantikan bagian colors di dalam extend
extend: {
  colors: {
    primary: {
      DEFAULT: '#FAD4C0',
      light:   '#FDE8DC',
      dark:    '#F0C4B0',
      text:    '#7C4A2D',
    },
    secondary: {
      DEFAULT: '#80A1C1',
      light:   '#B8CDE0',
      dark:    '#5A82A8',
      text:    '#2C5282',
    },
    surface: {
      DEFAULT: '#FFF5E6',
      card:    '#FFFFFF',
      border:  '#E8D5C4',
    },
  },
  // Hapus semua entry 'slate' custom dan 'surface-950' dst dari config lama
}
```

---

## Animasi

Tidak ada perubahan dari existing — tetap gunakan:

```css
.animate-fade-in  { animation: fadeIn  0.3s ease-in-out; }
.animate-slide-up { animation: slideUp 0.4s ease-out;    }
```

- Durasi 150–400ms untuk UI feedback
- `transition-colors duration-200` untuk color change
- `transition-all duration-700` untuk progress bar
- `animate-pulse` skeleton menggunakan `bg-[#FAD4C0]/40` bukan `bg-slate-700`

---

## Do / Don't

**DO:**
- Gunakan warm cream (`#FFF5E6`) sebagai background, bukan putih murni
- Bento grid selalu asimetris — minimal 3 ukuran cell berbeda per section
- AI/ML output pakai muted blue (`#80A1C1`) — berbeda dari primary peach
- Shadow ringan pada card (`shadow-sm`) untuk depth tanpa berlebihan
- Pertahankan semua logika state, API call, dan hooks yang ada

**DON'T:**
- Jangan pakai dark surface (`slate-900`, `slate-800`) — ini sekarang light theme
- Jangan pakai emerald/green sebagai primary — sekarang primary adalah peach
- Jangan buat semua bento card ukuran sama
- Jangan hardcode warna — gunakan token dari config
- Jangan ubah file di `src/services/`, `src/hooks/`, `src/context/`

---

## Quality Gates

Sebelum selesai setiap halaman, verifikasi:

- [ ] Background halaman `bg-[#FFF5E6]`, bukan hitam/gelap
- [ ] Semua card menggunakan `bg-white border border-[#E8D5C4]`
- [ ] Minimal 3 ukuran col-span berbeda di main grid
- [ ] Skeleton loading pakai `bg-[#FAD4C0]/40` bukan `bg-slate-700`
- [ ] Tidak ada class `slate-900`, `slate-800`, `surface-950` tersisa
- [ ] Text utama `text-gray-900`, bukan `text-white`
- [ ] Semua state/hooks/API calls tetap intact
- [ ] Mobile: semua cell jadi `col-span-12`

---

## File Reference

```
tailwind.config.js                      : update colors (lihat section di atas)
src/index.css                           : replace utility classes (lihat section di atas)
src/constants/categories.js            : update badge classes ke light palette
src/components/layout/AppLayout.jsx    : bg-[#FFF5E6], sidebar bg-white
src/components/layout/TopHeader.jsx    : bg-white border-b border-[#E8D5C4]
src/pages/DashboardPage.jsx            : bento grid, stat cards
src/pages/TransaksiPage.jsx            : table, badge, modal
src/pages/BudgetPage.jsx               : progress bar, 50/30/20
src/pages/AnomaliPage.jsx              : anomaly score badge
src/pages/PrediksiPage.jsx             : chart, confidence badge
src/pages/ChatPage.jsx                 : bubble layout
src/pages/ProfilPage.jsx               : form
```
