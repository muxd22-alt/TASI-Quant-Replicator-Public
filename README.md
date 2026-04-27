# TASI Quant Model

Automated multi-factor quantitative ranking model for the Saudi stock market (TASI), inspired by State Street Global Advisors (SSGA) factor methodology.

## Live Dashboard

📊 **[muxd22-alt.github.io/TASI-Quant-Replicator-Public](https://muxd22-alt.github.io/TASI-Quant-Replicator-Public/)**

## Scoring Methodology

The model ranks ~90 TASI-listed stocks using a composite of three SSGA-style factor pillars:

### Value Score
Lower is better — stocks trading below their peers on fundamental valuation:
- Trailing P/E, Forward P/E, Price/Book, Price/Sales, EV/EBITDA

### Quality Score
Higher is better — financially healthy, profitable companies with low leverage:
- Return on Equity (ROE), Return on Assets (ROA), Operating Margin
- Debt-to-Equity (inverted: lower debt = higher quality)

### Yield Score
Higher is better — strong dividend payers:
- Dividend Yield

**Total Score = Value + Quality + Yield**

Stocks are ranked by Total Score. The **Top 5** are "Confirmed Buys" and the **Bottom 5** are "Least Attractive."

## Portfolio Simulation

The model runs a simulated portfolio starting at **10,000 SAR**:

- **Score-weighted allocation** — higher-scoring stocks receive a proportionally larger share of capital (not equal-weight)
- **Hold-until-sold** — each position is held until the stock drops out of the Top 5, then automatically sold
- **Trade log** — every BUY and SELL is recorded with price, shares, date, and realized P&L
- **Per-position tracking** — unrealized P&L calculated against current market prices
- **Daily equity curve** — portfolio value snapshots stored over time

## Automation

GitHub Actions workflow (`.github/workflows/quant.yml`) runs during Saudi market hours:

| Schedule | Riyadh Time | Days |
|---|---|---|
| Hourly batches | 10 AM – 4 PM | Sun – Thu |

- Fetches **5 tickers per run** from Yahoo Finance to stay within free API limits
- Full ~90 ticker universe refreshes every ~3 days
- Portfolio rebalances **once per day** on the first run
- Results auto-committed back to the repo, triggering GitHub Pages rebuild

## Project Structure

```
├── model.py                      # Quant model + portfolio engine
├── .github/workflows/quant.yml   # Automated schedule
├── docs/
│   ├── index.html                # Static dashboard (no build step)
│   ├── data.json                 # Top 5, Bottom 5, portfolio state
│   ├── cache_db.json             # Ticker fundamental data cache
│   └── portfolio.json            # Position & trade history
├── quant_model_results.csv       # Full ranked output
└── README.md
```

## Deployment

Hosted on **GitHub Pages** serving from the `docs/` directory. No build step required.

## Disclaimer

The information provided on this platform is for educational and informational purposes only and does not constitute financial, investment, or legal advice. Investing involves risk, including the loss of principal. We are not liable for any losses arising from the use of this content. Please consult a CMA-licensed financial advisor before making any investment decisions.
