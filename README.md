# Luggage Intel — Competitive Intelligence Dashboard
### Amazon India · Luggage Market Analysis

> Scrape → Analyse → Compare → Present

An end-to-end competitive intelligence pipeline and interactive dashboard for luggage brands selling on Amazon India. Covers **Safari, Skybags, American Tourister, VIP, Aristocrat, and Nasher Miles** with real product data, customer review sentiment analysis, and a dark-themed React dashboard.

---

## Project Structure

```
Moonshot/
├── scraper/
│   ├── scraper_playwright.py     # Unified Playwright scraper (products + reviews)
│   └── generate_mock_data.py     # Mock data generator for testing
├── pipeline/
│   ├── process.py                # Clean + deduplicate raw data
│   ├── sentiment.py              # VADER scoring + aspect-level theme extraction
│   └── export.py                 # Produce final dashboard_data.json bundle
├── data/                         # All scraped + processed files (auto-generated)
│   ├── raw_products.json
│   ├── raw_reviews.json
│   ├── cleaned_products.json
│   ├── cleaned_reviews.json
│   ├── sentiment_scores.json
│   ├── themes.json
│   ├── brand_summary.json
│   └── dashboard_data.json
└── dashboard/                    # React frontend
    ├── public/
    │   └── data/
    │       └── dashboard_data.json
    └── src/
        ├── App.jsx
        ├── index.css
        ├── hooks/
        │   └── useDashboardData.js
        └── components/
            ├── Overview.jsx
            ├── BrandComparison.jsx
            ├── ProductDrilldown.jsx
            ├── AgentInsights.jsx
            ├── StatCard.jsx
            └── SentimentBar.jsx
```

---

## Data Flow

```
Amazon India (live)
      ↓  Playwright browser scraper
raw_products.json + raw_reviews.json
      ↓  pipeline/process.py
cleaned_products.json + cleaned_reviews.json
      ↓  pipeline/sentiment.py
sentiment_scores.json + themes.json + brand_summary.json
      ↓  pipeline/export.py
dashboard_data.json  →  React dashboard
```

---

## Quick Start

### Prerequisites

```bash
pip install playwright nltk
python -m playwright install chromium

# Dashboard
node --version   # Node.js 16+ required
```

### Step 1 — Scrape

```bash
cd scraper
python scraper_playwright.py
```

A Chrome browser will open. **Log in to Amazon India**, then press Enter in the terminal. The scraper automatically collects products and reviews for all 6 brands.

```bash
# Resume after interruption
python scraper_playwright.py --resume

# Specific brands only
python scraper_playwright.py --brands Safari Skybags
```

**Or use mock data for testing (no browser needed):**
```bash
python generate_mock_data.py
```

### Step 2 — Run the pipeline

```bash
cd ../pipeline

python process.py          # clean + deduplicate
python sentiment.py --no-llm  # VADER sentiment scoring
python export.py           # build dashboard bundle
```

### Step 3 — Run the dashboard

```bash
# Copy data to dashboard
copy ..\data\dashboard_data.json ..\dashboard\public\data\dashboard_data.json

cd ../dashboard
npm install
npm start
```

Opens at `http://localhost:3000`

---

## Dashboard Views

### Overview
Global stats (brands, products, reviews, avg price), brand sentiment ranking bars with VADER scores, multi-dimension radar chart, average price bar chart, and brand summary cards.

### Brand Comparison
Sortable benchmark table with all metrics side by side, price vs sentiment scatter plot, discount dependency chart, aspect-level sentiment grid (wheels / zipper / handle / material / size / weight), and top praises + complaints per brand.

### Product Drilldown
Filterable product list by brand, category, minimum rating, and sort order. Click any product to open a detail panel showing price, discount, sentiment score, feature bullets, and review samples with verified-purchase badges.

### Agent Insights
Auto-generated insights from data, radial value score gauges for all 6 brands, decision summary (who is winning and why), and LLM-generated brand summaries if `ANTHROPIC_API_KEY` is set.

---

## Sentiment Methodology

### VADER (rule-based, no API key needed)
Applied to every review (title + body combined).
- Compound score range: −1 (most negative) → +1 (most positive)
- Positive: ≥ 0.05 · Negative: ≤ −0.05 · Neutral: between

### Aspect-level analysis
Eight luggage-specific aspects tracked per review via keyword matching:
`wheels`, `handle`, `zipper`, `material`, `size`, `weight`, `price`, `delivery`

Each aspect gets a positive / negative / mixed verdict per brand.

### Value score (0–10)
Composite score that adjusts sentiment by price band — cheaper brands with equal sentiment score higher.

```
value_score = avg(normalised_vader, normalised_rating) × price_factor × 10
```

| Price band | Factor |
|---|---|
| < ₹2,000 | 1.00× |
| ₹2,000 – ₹4,000 | 0.85× |
| ₹4,000 – ₹7,000 | 0.70× |
| ₹7,000 – ₹12,000 | 0.55× |
| > ₹12,000 | 0.40× |

### LLM synthesis (optional)
Set `ANTHROPIC_API_KEY` and run `python sentiment.py` (without `--no-llm`) to get Claude-generated brand summaries, structured top-5 praises/complaints, per-aspect verdicts, and 3 non-obvious insights per brand.

---

## Minimum Data Coverage

| Requirement | Target | Achieved |
|---|---|---|
| Brands | 4+ | 6 |
| Products per brand | 10+ | 10 |
| Reviews per brand | 50+ | ~60 (6 pages × ~10) |

---

## Evaluation Rubric Coverage

| Criteria | Implementation |
|---|---|
| Data collection quality | Playwright + stealth headers + retry logic + incremental save |
| Analytical depth | VADER + 8-aspect extraction + value score + optional LLM synthesis |
| Dashboard UX/UI | Dark command-center theme, React + Recharts, filters, drilldowns, sortable tables |
| Competitive intelligence | Brand comparison view, scatter plot, discount analysis, aspect grid |
| Technical execution | Modular pipeline, UTF-8 safe, CSV + JSON output, structured logging |
| Product thinking | Agent Insights section, value-for-money score, verified-review signals |

### Bonus features
- ✅ Aspect-level sentiment — wheels, handle, zipper, material, size, weight
- ✅ Value-for-money score adjusted by price band
- ✅ Agent Insights — auto-generated non-obvious conclusions from data
- ✅ Review trust signals — verified purchase badge filter
- ✅ LLM-powered brand summaries via optional Anthropic API

---

## Tech Stack

| Layer | Technology |
|---|---|
| Scraping | Python, Playwright (Chromium) |
| Data processing | Python, Pandas (optional), JSON/CSV |
| Sentiment | NLTK VADER, keyword aspect matching |
| Dashboard | React 18, Recharts, CSS variables |
| Optional LLM | Anthropic Claude (claude-sonnet-4-20250514) |

---

## Limitations

- Amazon anti-bot measures may trigger CAPTCHAs even with stealth settings. The scraper runs in visible browser mode and pauses for manual login to mitigate this.
- Review counts depend on product review page availability. Some newer products may have fewer reviews.
- VADER is not tuned for Indian English phrasing — occasional sarcasm or transliterated Hindi may be misclassified. LLM synthesis corrects the most significant cases.
- Prices reflect the moment of scraping. Amazon pricing is dynamic and changes frequently.
