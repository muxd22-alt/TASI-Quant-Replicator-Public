# TASI Quant Model

Automated multi-factor quantitative ranking model for TASI (Saudi stock market).

## How It Works

1. **`model.py`** fetches fundamental data (P/E, P/B, ROE, Dividend Yield) from Yahoo Finance for ~90 TASI stocks
2. Scores each stock using z-score normalization across all factors
3. Picks the **Top 5** strongest and **Bottom 5** weakest candidates
4. Tracks a simulated portfolio starting at **10,000 SAR**
5. Results are written to `public/data.json` and served as a static dashboard

## Rate Limiting

To stay within Yahoo Finance's free API limits, the model fetches only **5 tickers per run**. GitHub Actions runs every hour, so the full universe is refreshed within a day.

## GitHub Actions

The workflow in `.github/workflows/quant.yml` runs hourly:
- Fetches a batch of 5 tickers
- Updates the cached data and recalculates scores
- Commits results back to the repo

## Dashboard

A static HTML page in `public/` — deployed via **Cloudflare Pages** pointing at the `public/` directory. No build step needed.

## Setup

1. Fork this repo
2. Connect to Cloudflare Pages → set output directory to `public/`
3. GitHub Actions runs automatically on schedule
