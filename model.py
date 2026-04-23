import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

# SAQL Top 10 Holdings
# 1. Al Rajhi Bank: 9.4% (1120.SR)
# 2. SNB: 9.3% (1180.SR)
# 3. Saudi Aramco: 8.6% (2222.SR)
# 4. Ma'aden: 7.8% (1211.SR)
# 5. Riyad Bank: 4.7% (1010.SR)
# 6. Alinma Bank: 4.2% (1150.SR)
# 7. SABIC Agri-Nutrients: 4.1% (2020.SR)
# 8. Banque Saudi Fransi: 3.3% (1050.SR)
# 9. Mobily: 3.3% (7020.SR)
# 10. STC: 3.2% (7010.SR)

top_holding_tickers = {
    '1120.SR': 9.4,
    '1180.SR': 9.3,
    '2222.SR': 8.6,
    '1211.SR': 7.8,
    '1010.SR': 4.7,
    '1150.SR': 4.2,
    '2020.SR': 4.1,
    '1050.SR': 3.3,
    '7020.SR': 3.3,
    '7010.SR': 3.2
}

# Add some other known large cap Saudi tickers to see how they rank vs top holdings
universe_tickers = list(top_holding_tickers.keys()) + [
    '2010.SR', # SABIC
    '1140.SR', # Bank Albilad
    '2280.SR', # Almarai
    '5110.SR', # Saudi Electricity
    '4002.SR', # Mouwasat
    '4190.SR', # Jarir
    '1111.SR', # Tadawul Group
    '4280.SR', # Kingdom Holding
    '4001.SR', # Abdullah Al Othaim
]

def fetch_data(tickers):
    data = []
    print(f"Fetching data for {len(tickers)} tickers...")
    for ticker in tickers:
        print(f"Fetching {ticker}...")
        stock = yf.Ticker(ticker)
        try:
            info = stock.info
            # Some free sources metrics
            cap = info.get('marketCap', np.nan)
            pe = info.get('trailingPE', np.nan)
            pb = info.get('priceToBook', np.nan)
            div_yield = info.get('dividendYield', 0)
            if div_yield is None: div_yield = 0
            roe = info.get('returnOnEquity', np.nan)
            if roe is None: roe = np.nan
            
            data.append({
                'Ticker': ticker,
                'Name': info.get('shortName', ticker),
                'MarketCap': cap,
                'PE': pe,
                'PB': pb,
                'DivYield': div_yield * 100, # percentage
                'ROE': roe * 100 # percentage
            })
        except Exception as e:
            print(f"Failed to fetch {ticker}: {e}")
            
    return pd.DataFrame(data)

def calculate_scores(df):
    # Impute missing values with median
    for col in ['PE', 'PB', 'DivYield', 'ROE']:
        df[col] = df[col].fillna(df[col].median())
        
    # We want low PE, low PB, high DivYield, high ROE
    # Z-scores for each factor
    df['PE_Score'] = (df['PE'].mean() - df['PE']) / df['PE'].std() # Invert so higher is better
    df['PB_Score'] = (df['PB'].mean() - df['PB']) / df['PB'].std() # Invert so higher is better
    df['Div_Score'] = (df['DivYield'] - df['DivYield'].mean()) / df['DivYield'].std()
    df['ROE_Score'] = (df['ROE'] - df['ROE'].mean()) / df['ROE'].std()
    
    # Simple multi-factor score: Value (PE, PB) + Quality (ROE) + Yield
    df['Total_Score'] = df['PE_Score'] + df['PB_Score'] + df['Div_Score'] + df['ROE_Score']
    
    # Sort by total score
    df = df.sort_values(by='Total_Score', ascending=False).reset_index(drop=True)
    return df

def main():
    df = fetch_data(universe_tickers)
    df = df.dropna(subset=['MarketCap']) # drop where market cap couldn't be fetched
    
    df_scored = calculate_scores(df)
    
    print("\n--- SAQL Top Holdings vs Output ---")
    df_scored['Is_Top_Holding'] = df_scored['Ticker'].apply(lambda x: x in top_holding_tickers)
    
    print(df_scored[['Ticker', 'Name', 'Total_Score', 'Is_Top_Holding', 'PE', 'ROE', 'DivYield', 'MarketCap']])
    print("\n")
    print("Potential Candidates based on model:")
    candidates = df_scored[~df_scored['Is_Top_Holding']].head(5)
    print(candidates[['Ticker', 'Name', 'Total_Score', 'PE', 'ROE', 'DivYield']])
    
    df_scored.to_csv("quant_model_results.csv", index=False)
    print("\nSaved full results to quant_model_results.csv")

if __name__ == "__main__":
    main()
