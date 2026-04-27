import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

CACHE_FILE = "docs/cache_db.json"
DATA_FILE = "docs/data.json"
PORTFOLIO_FILE = "docs/portfolio.json"
BATCH_SIZE = 50
INITIAL_CAPITAL = 10000.0

universe_tickers = [
    '1120.SR', '1180.SR', '2222.SR', '1211.SR', '1010.SR', '1150.SR', '2020.SR', '1050.SR', '7020.SR', '7010.SR',
    '2010.SR', '1140.SR', '2280.SR', '5110.SR', '4002.SR', '4190.SR', '1111.SR', '4280.SR', '4001.SR', '7030.SR',
    '2050.SR', '2060.SR', '2110.SR', '2140.SR', '2220.SR', '2250.SR', '8010.SR', '8012.SR', '8030.SR', '8040.SR',
    '8210.SR', '1020.SR', '1030.SR', '1060.SR', '1080.SR', '1182.SR', '1183.SR', '3010.SR', '3020.SR', '3030.SR',
    '3040.SR', '3050.SR', '3060.SR', '3080.SR', '3090.SR', '4003.SR', '4004.SR', '4005.SR', '4007.SR', '4010.SR',
    '4011.SR', '4012.SR', '4015.SR', '4020.SR', '4030.SR', '4031.SR', '4040.SR', '4050.SR', '4061.SR', '4071.SR',
    '4080.SR', '4090.SR', '4100.SR', '4110.SR', '4130.SR', '4140.SR', '4150.SR', '4160.SR', '4170.SR', '4180.SR',
    '4200.SR', '4220.SR', '4240.SR', '4250.SR', '4260.SR', '4270.SR', '4290.SR', '4300.SR', '4310.SR', '4320.SR',
    '4321.SR', '4322.SR', '2001.SR', '2030.SR', '2040.SR', '2070.SR', '2080.SR', '2081.SR', '2082.SR', '2083.SR',
    '2090.SR'
]
universe_tickers = list(set(universe_tickers))

# ── Helpers ──────────────────────────────────────────────────────────────────

def load_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            return default
    return default

def save_json(path, data):
    os.makedirs("docs", exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def now_utc():
    return datetime.now(timezone.utc)

def today_str():
    return now_utc().strftime("%Y-%m-%d")

# ── Data Fetching ────────────────────────────────────────────────────────────

def fetch_single(ticker):
    stock = yf.Ticker(ticker)
    try:
        info = stock.info
        if not info:
            return None
        return {
            'Ticker': ticker,
            'Name': info.get('shortName', ticker),
            'Sector': info.get('sector', 'Unknown'),
            'MarketCap': info.get('marketCap') if pd.notna(info.get('marketCap')) else None,
            'PE': info.get('trailingPE') if pd.notna(info.get('trailingPE')) else None,
            'ForwardPE': info.get('forwardPE') if pd.notna(info.get('forwardPE')) else None,
            'PB': info.get('priceToBook') if pd.notna(info.get('priceToBook')) else None,
            'PS': info.get('priceToSalesTrailing12Months') if pd.notna(info.get('priceToSalesTrailing12Months')) else None,
            'EVEBITDA': info.get('enterpriseToEbitda') if pd.notna(info.get('enterpriseToEbitda')) else None,
            'DivYield': (info.get('dividendYield') or 0) * 100,
            'ROE': (info.get('returnOnEquity') or 0) * 100,
            'ROA': (info.get('returnOnAssets') or 0) * 100,
            'OperatingMargin': (info.get('operatingMargins') or 0) * 100,
            'DebtToEquity': info.get('debtToEquity') if pd.notna(info.get('debtToEquity')) else None,
            'CurrentPrice': info.get('currentPrice') if pd.notna(info.get('currentPrice')) else None,
            'LastUpdated': now_utc().isoformat()
        }
    except Exception:
        return None

def get_price(ticker, cache):
    """Get latest price for a ticker from cache, or fetch if missing."""
    cached = cache.get(ticker, {})
    price = cached.get('CurrentPrice')
    if price is not None:
        return price
    # Fallback: live fetch
    fresh = fetch_single(ticker)
    if fresh and fresh.get('CurrentPrice') is not None:
        return fresh['CurrentPrice']
    return None

# ── Portfolio Engine ─────────────────────────────────────────────────────────
# Simulates equal-weight portfolio of the Top 5.
# Holds each position until the stock drops out of Top 5 → sells it.
# Tracks per-position P&L, trade log, and daily equity curve.

def init_portfolio():
    return {
        "cash": INITIAL_CAPITAL,
        "positions": [],        # [{ticker, name, shares, buy_price, buy_date}]
        "trades": [],           # [{ticker, name, side, price, shares, date, pnl}]
        "equity_curve": [],     # [{date, portfolio_value, cash, invested}]
        "last_update": ""
    }

def portfolio_value(ptf, cache):
    """Total portfolio value = cash + sum(shares * current_price)."""
    invested = 0
    for pos in ptf["positions"]:
        price = get_price(pos["ticker"], cache) or pos["buy_price"]
        invested += pos["shares"] * price
    return ptf["cash"] + invested

def build_snapshot(ptf, cache):
    """Build per-position snapshot for the UI."""
    snapshot = []
    for pos in ptf["positions"]:
        cur_price = get_price(pos["ticker"], cache) or pos["buy_price"]
        mkt_val = pos["shares"] * cur_price
        cost_basis = pos["shares"] * pos["buy_price"]
        unrealized = mkt_val - cost_basis
        pct = ((cur_price - pos["buy_price"]) / pos["buy_price"]) * 100 if pos["buy_price"] else 0
        snapshot.append({
            "ticker": pos["ticker"],
            "name": pos.get("name", pos["ticker"]),
            "shares": pos["shares"],
            "buy_price": pos["buy_price"],
            "current_price": cur_price,
            "market_value": round(mkt_val, 2),
            "unrealized_pnl": round(unrealized, 2),
            "pnl_pct": round(pct, 2),
            "buy_date": pos["buy_date"],
            "weight_pct": pos.get("weight_pct", 0)
        })
    return snapshot

def update_portfolio(top5_tickers, top5_records, cache):
    ptf = load_json(PORTFOLIO_FILE, None)
    if ptf is None or "cash" not in ptf:
        ptf = init_portfolio()

    today = today_str()

    # Skip rebalance if already processed today, but still build snapshot
    if ptf["last_update"] == today:
        val = portfolio_value(ptf, cache)
        snapshot = build_snapshot(ptf, cache)
        return ptf, val, snapshot

    # ── 1. Mark-to-market existing positions and SELL any that left Top 5 ──
    kept_positions = []
    for pos in ptf["positions"]:
        current_price = get_price(pos["ticker"], cache) or pos["buy_price"]

        if pos["ticker"] not in top5_tickers:
            # SELL: stock dropped out of Top 5
            sell_value = pos["shares"] * current_price
            pnl = sell_value - (pos["shares"] * pos["buy_price"])
            ptf["cash"] += sell_value
            ptf["trades"].append({
                "ticker": pos["ticker"],
                "name": pos.get("name", pos["ticker"]),
                "side": "SELL",
                "price": current_price,
                "shares": pos["shares"],
                "date": today,
                "pnl": round(pnl, 2),
                "buy_price": pos["buy_price"],
                "buy_date": pos["buy_date"]
            })
            print(f"  SOLD {pos['ticker']} @ {current_price} | P&L: {pnl:+.2f} SAR")
        else:
            # HOLD: still in Top 5
            kept_positions.append(pos)

    ptf["positions"] = kept_positions

    # ── 2. BUY new stocks that entered Top 5 ────────────────────────────────
    held_tickers = {p["ticker"] for p in ptf["positions"]}
    new_tickers = [t for t in top5_tickers if t not in held_tickers]

    if new_tickers and ptf["cash"] > 0:
        # Score-weighted allocation: higher score → larger share of capital
        scores = {}
        for ticker in new_tickers:
            for rec in top5_records:
                if rec.get("Ticker") == ticker:
                    scores[ticker] = max(rec.get("Total_Score", 0), 0.01)
                    break
            if ticker not in scores:
                scores[ticker] = 0.01

        total_score = sum(scores.values())
        available_cash = ptf["cash"]

        for ticker in new_tickers:
            price = get_price(ticker, cache)
            if price is None or price <= 0:
                continue

            weight = scores[ticker] / total_score
            alloc = available_cash * weight
            shares = alloc / price
            ptf["cash"] -= alloc

            # Find name from top5_records
            name = ticker
            for rec in top5_records:
                if rec.get("Ticker") == ticker:
                    name = rec.get("Name", ticker)
                    break

            ptf["positions"].append({
                "ticker": ticker,
                "name": name,
                "shares": round(shares, 4),
                "buy_price": price,
                "buy_date": today,
                "weight_pct": round(weight * 100, 1)
            })
            ptf["trades"].append({
                "ticker": ticker,
                "name": name,
                "side": "BUY",
                "price": price,
                "shares": round(shares, 4),
                "date": today,
                "pnl": 0,
                "weight_pct": round(weight * 100, 1)
            })
            print(f"  BUY  {ticker} @ {price} | {shares:.4f} shares | weight: {weight*100:.1f}%")

    # ── 3. Record daily equity curve ─────────────────────────────────────────
    total_val = portfolio_value(ptf, cache)
    invested_val = sum(
        pos["shares"] * (get_price(pos["ticker"], cache) or pos["buy_price"])
        for pos in ptf["positions"]
    )

    ptf["equity_curve"].append({
        "date": today,
        "portfolio_value": round(total_val, 2),
        "cash": round(ptf["cash"], 2),
        "invested": round(invested_val, 2)
    })

    ptf["last_update"] = today

    save_json(PORTFOLIO_FILE, ptf)
    positions_snapshot = build_snapshot(ptf, cache)
    return ptf, total_val, positions_snapshot

# ── Scoring Engine ───────────────────────────────────────────────────────────

def main():
    cache = load_json(CACHE_FILE, {})

    # Determine batch to fetch (oldest-updated first)
    ticker_updates = []
    for t in universe_tickers:
        last_up = cache.get(t, {}).get("LastUpdated", "1970-01-01T00:00:00")
        ticker_updates.append((t, last_up))

    ticker_updates.sort(key=lambda x: x[1])
    to_fetch = [x[0] for x in ticker_updates[:BATCH_SIZE]]

    print(f"Fetching batch: {to_fetch}")

    with ThreadPoolExecutor(max_workers=BATCH_SIZE) as executor:
        futures = {executor.submit(fetch_single, t): t for t in to_fetch}
        for future in as_completed(futures):
            res = future.result()
            if res is not None:
                cache[res["Ticker"]] = res

    save_json(CACHE_FILE, cache)

    # Build DataFrame from all cached data
    df_data = list(cache.values())
    if len(df_data) == 0:
        print("No cached data yet.")
        return
    df = pd.DataFrame(df_data)

    df = df.dropna(subset=['MarketCap'])
    df = df[df['MarketCap'] > 0]
    if df.empty:
        return

    # Impute missing metrics
    metrics_lower = ['PE', 'ForwardPE', 'PB', 'PS', 'EVEBITDA', 'DebtToEquity']
    metrics_higher = ['DivYield', 'ROE', 'ROA', 'OperatingMargin']

    for col in metrics_lower + metrics_higher:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            median = df[col].median() if not df[col].isna().all() else 0
            df[col] = df[col].fillna(median)
        else:
            df[col] = 0

    # ── SSGA Multi-Factor: Value + Quality + Yield ───────────────────────────
    df['Value_Score'] = sum(
        (df[c].mean() - df[c]) / (df[c].std() + 1e-9)
        for c in ['PE', 'ForwardPE', 'PB', 'PS', 'EVEBITDA']
    )

    quality_high = sum(
        (df[c] - df[c].mean()) / (df[c].std() + 1e-9)
        for c in ['ROE', 'ROA', 'OperatingMargin']
    )
    quality_low = (df['DebtToEquity'].mean() - df['DebtToEquity']) / (df['DebtToEquity'].std() + 1e-9)
    df['Quality_Score'] = quality_high + quality_low

    df['Yield_Score'] = (df['DivYield'] - df['DivYield'].mean()) / (df['DivYield'].std() + 1e-9)

    df['Total_Score'] = df['Value_Score'] + df['Quality_Score'] + df['Yield_Score']
    df = df.sort_values(by='Total_Score', ascending=False).reset_index(drop=True)

    # Clean NaN for valid JSON
    df = df.replace({np.nan: None})

    # Diversification constraint: max 1 stock per sector in Top 5
    top_5 = []
    seen_sectors = set()
    for _, row in df.iterrows():
        sector = row.get('Sector', 'Unknown')
        # Allow 'Unknown' sectors to be added without constraint, or count them normally.
        # It's better to just limit any known sector to 1.
        if sector == 'Unknown' or sector not in seen_sectors:
            top_5.append(row.to_dict())
            if sector != 'Unknown':
                seen_sectors.add(sector)
        if len(top_5) == 5:
            break
            
    # Fallback if we don't have enough unique sectors
    if len(top_5) < 5:
        for _, row in df.iterrows():
            if len(top_5) == 5:
                break
            if row['Ticker'] not in [s['Ticker'] for s in top_5]:
                top_5.append(row.to_dict())

    bottom_5 = df.tail(5).to_dict(orient='records')
    top5_tickers = [s['Ticker'] for s in top_5]

    # ── Portfolio Simulation ─────────────────────────────────────────────────
    print("Updating portfolio...")
    ptf, total_val, positions_snapshot = update_portfolio(top5_tickers, top_5, cache)

    total_return = total_val - INITIAL_CAPITAL
    total_return_pct = (total_return / INITIAL_CAPITAL) * 100

    # Recent trades (last 20)
    recent_trades = ptf.get("trades", [])[-20:]

    portfolio_summary = {
        "total_value": round(total_val, 2),
        "cash": round(ptf["cash"], 2),
        "total_return": round(total_return, 2),
        "total_return_pct": round(total_return_pct, 2),
        "positions": positions_snapshot,
        "recent_trades": recent_trades,
        "equity_curve": ptf.get("equity_curve", [])[-90:]  # last 90 days
    }

    output = {
        "updatedAt": now_utc().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "top5": top_5,
        "bottom5": bottom_5,
        "portfolio": portfolio_summary
    }

    save_json(DATA_FILE, output)
    df.to_csv("quant_model_results.csv", index=False)
    print(f"Done! Portfolio: {total_val:.2f} SAR ({total_return:+.2f} | {total_return_pct:+.2f}%)")

if __name__ == "__main__":
    main()
