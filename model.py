import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

CACHE_FILE = "public/cache_db.json"
DATA_FILE = "public/data.json"
BATCH_SIZE = 5

top_holding_tickers = {
    '1120.SR': 9.4, '1180.SR': 9.3, '2222.SR': 8.6, '1211.SR': 7.8,
    '1010.SR': 4.7, '1150.SR': 4.2, '2020.SR': 4.1, '1050.SR': 3.3,
    '7020.SR': 3.3, '7010.SR': 3.2
}

universe_tickers = list(top_holding_tickers.keys()) + [
    '2010.SR', '1140.SR', '2280.SR', '5110.SR', '4002.SR', '4190.SR', '1111.SR', '4280.SR', '4001.SR',
    '7030.SR', '2050.SR', '2060.SR', '2110.SR', '2140.SR', '2220.SR', '2250.SR', '8010.SR', '8012.SR',
    '8030.SR', '8040.SR', '8210.SR', '1020.SR', '1030.SR', '1060.SR', '1080.SR', '1182.SR', '1183.SR',
    '3010.SR', '3020.SR', '3030.SR', '3040.SR', '3050.SR', '3060.SR', '3080.SR', '3090.SR', '4003.SR',
    '4004.SR', '4005.SR', '4007.SR', '4010.SR', '4011.SR', '4012.SR', '4015.SR', '4020.SR', '4030.SR',
    '4031.SR', '4040.SR', '4050.SR', '4061.SR', '4071.SR', '4080.SR', '4090.SR', '4100.SR', '4110.SR',
    '4130.SR', '4140.SR', '4150.SR', '4160.SR', '4170.SR', '4180.SR', '4200.SR', '4220.SR', '4240.SR',
    '4250.SR', '4260.SR', '4270.SR', '4290.SR', '4300.SR', '4310.SR', '4320.SR', '4321.SR', '4322.SR',
    '2001.SR', '2030.SR', '2040.SR', '2070.SR', '2080.SR', '2081.SR', '2082.SR', '2083.SR', '2090.SR'
]

universe_tickers = list(set(universe_tickers))

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_cache(cache):
    os.makedirs("public", exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)

def fetch_single(ticker):
    stock = yf.Ticker(ticker)
    try:
        info = stock.info
        if not info: return None
        return {
            'Ticker': ticker,
            'Name': info.get('shortName', ticker),
            'MarketCap': info.get('marketCap', np.nan),
            'PE': info.get('trailingPE', np.nan),
            'PB': info.get('priceToBook', np.nan),
            'DivYield': (info.get('dividendYield') or 0) * 100,
            'ROE': (info.get('returnOnEquity') or 0) * 100,
            'LastUpdated': datetime.utcnow().isoformat()
        }
    except Exception:
        return None

def main():
    cache = load_cache()
    
    # Identify which tickers to update (oldest first)
    # Give a default very old date for tickers not in cache
    ticker_updates = []
    for t in universe_tickers:
        last_up = cache.get(t, {}).get("LastUpdated", "1970-01-01T00:00:00")
        ticker_updates.append((t, last_up))
        
    ticker_updates.sort(key=lambda x: x[1])
    to_fetch = [x[0] for x in ticker_updates[:BATCH_SIZE]]
    
    print(f"Fetching chunks to avoid rate limiting. Fetching: {to_fetch}")
    
    with ThreadPoolExecutor(max_workers=BATCH_SIZE) as executor:
        futures = {executor.submit(fetch_single, t): t for t in to_fetch}
        for future in as_completed(futures):
            res = future.result()
            if res is not None:
                cache[res["Ticker"]] = res
                
    save_cache(cache)
    
    # Calculate scores on the entire current state of cache
    df_data = list(cache.values())
    if len(df_data) == 0:
        print("No valid cached data yet.")
        return
        
    df = pd.DataFrame(df_data)
    
    # Clean missing important fields
    df = df.dropna(subset=['MarketCap'])
    df = df[df['MarketCap'] > 0]
    
    if df.empty:
        return

    # Impute missing ratios
    for col in ['PE', 'PB', 'DivYield', 'ROE']:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median() if not df[col].isna().all() else 0)
        else:
            df[col] = 0
            
    # Calculate Component Z-Scores
    df['PE_Score'] = (df['PE'].mean() - df['PE']) / (df['PE'].std() + 1e-9)
    df['PB_Score'] = (df['PB'].mean() - df['PB']) / (df['PB'].std() + 1e-9)
    df['Div_Score'] = (df['DivYield'] - df['DivYield'].mean()) / (df['DivYield'].std() + 1e-9)
    df['ROE_Score'] = (df['ROE'] - df['ROE'].mean()) / (df['ROE'].std() + 1e-9)
    
    df['Total_Score'] = df['PE_Score'] + df['PB_Score'] + df['Div_Score'] + df['ROE_Score']
    df = df.sort_values(by='Total_Score', ascending=False).reset_index(drop=True)
    
    df['Is_Top_Holding'] = df['Ticker'].apply(lambda x: x in top_holding_tickers)
    
    candidates = df[~df['Is_Top_Holding']]
    
    top_5 = candidates.head(5).to_dict(orient='records')
    bottom_5 = candidates.tail(5).to_dict(orient='records')
    
    output = {
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        "top5": top_5,
        "bottom5": bottom_5
    }
    
    with open(DATA_FILE, "w") as f:
        json.dump(output, f, indent=2)
        
    df.to_csv("quant_model_results.csv", index=False)
    print("Done! Model results exported.")

if __name__ == "__main__":
    main()
