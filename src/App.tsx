import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Clock, Activity, ShieldAlert, BarChart3, Target } from 'lucide-react';
import { motion } from 'motion/react';

type StockCandidate = {
  Ticker: string;
  Name: string;
  Total_Score: number;
  PE: number;
  ROE: number;
  DivYield: number;
};

type QuantData = {
  updatedAt: string;
  top5: StockCandidate[];
  bottom5: StockCandidate[];
};

export default function App() {
  const [data, setData] = useState<QuantData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data.json')
      .then((res) => {
        if (!res.ok) throw new Error('Data not found');
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Activity className="h-10 w-10 animate-spin text-emerald-400 opacity-80" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center text-center">
        <ShieldAlert className="h-16 w-16 text-red-400 mb-4 opacity-80" />
        <h2 className="text-2xl font-bold">Model Data Unavailable</h2>
        <p className="text-slate-400 mt-2">Could not fetch public/data.json - Run the model script first.</p>
      </div>
    );
  }

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleString('en-US', {
      timeZone: 'Asia/Riyadh',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  return (
    <div className="min-h-screen px-4 md:px-8 py-10 max-w-7xl mx-auto">
      <header className="mb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 pb-2">
              SAQL Quant Replicator
            </h1>
            <p className="text-slate-400 text-lg sm:max-w-xl">
              Daily automated quantitative factor model predicting top TASI alternatives matching SAQL ETF active logic.
            </p>
          </div>
          <div className="glass-panel px-4 py-3 mt-6 md:mt-0 flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Latest Run</span>
              <span className="text-sm font-medium">{formatTime(data.updatedAt)}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="space-y-10">
        {/* Top 5 SECTION */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-semibold">Confirmed Buys <span className="text-emerald-400">(Top 5)</span></h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.top5.map((stock, i) => (
              <motion.div
                key={stock.Ticker}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-panel p-6 relative overflow-hidden group hover:glow transition-all duration-500"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
                
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <h3 className="text-2xl font-bold flex items-center gap-3">
                      {stock.Name}
                    </h3>
                    <div className="text-emerald-400 text-sm font-medium mt-1 font-mono">{stock.Ticker}</div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-sm px-3 py-1 rounded-full flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    Score: {stock.Total_Score.toFixed(2)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-8 relative z-10">
                  <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                    <div className="text-xs text-slate-400 font-medium mb-1 uppercase">P/E Ratio</div>
                    <div className="text-lg font-semibold">{stock.PE.toFixed(1)}x</div>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                    <div className="text-xs text-slate-400 font-medium mb-1 uppercase">Div Yield</div>
                    <div className="text-lg font-semibold">{stock.DivYield.toFixed(2)}%</div>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                    <div className="text-xs text-slate-400 font-medium mb-1 uppercase">ROE</div>
                    <div className="text-lg font-semibold">{stock.ROE.toFixed(1)}%</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Bottom 5 SECTION */}
        <section className="pt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30">
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-3xl font-semibold">Least Attractive <span className="text-red-400">(Bottom 5)</span></h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.bottom5.map((stock, i) => (
              <motion.div
                key={stock.Ticker}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="glass-panel p-6 border-red-500/20"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-slate-200">
                      {stock.Name}
                    </h3>
                    <div className="text-red-400 text-sm font-medium mt-1 font-mono">{stock.Ticker}</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 text-red-300 font-mono text-sm px-3 py-1 rounded-full flex items-center gap-1.5">
                    Score: {stock.Total_Score.toFixed(2)}
                  </div>
                </div>
                
                <div className="flex gap-6 mt-6">
                  <div>
                    <div className="text-xs text-slate-500 font-medium uppercase mb-0.5">P/E</div>
                    <div className="text-sm font-semibold text-slate-300">{stock.PE.toFixed(1)}x</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium uppercase mb-0.5">ROE</div>
                    <div className="text-sm font-semibold text-slate-300">{stock.ROE.toFixed(1)}%</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-20 pt-8 border-t border-slate-800/60 pb-8 flex justify-between items-center text-slate-500 text-sm">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          <span>Automated Factor Ranking System</span>
        </div>
        <div>TASI-Quant-Replicator • Open Source</div>
      </footer>
    </div>
  );
}
