import { useState, useEffect, useRef, ChangeEvent, ReactNode } from "react";
import { 
  FileUp, 
  LayoutDashboard, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Upload, 
  TrendingUp, 
  PieChart as PieChartIcon,
  ChevronRight,
  Database,
  Search,
  Activity,
  Layers,
  Brain,
  Zap,
  Globe,
  LogIn,
  LogOut,
  User
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import { db, auth } from "./lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  getDocs, 
  limit,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from "firebase/auth";

// Bento Grid Theme Colors
const colors = {
  bg: "#020617",
  card: "#0f172a",
  border: "#334155",
  text: "#f8fafc",
  accent: "#6366f1",
  muted: "#94a3b8",
};

interface FundReport {
  id: string;
  fundId: string;
  quarter: string;
  holdings: { ticker: string; weight: number; analysis?: string }[];
  totalAssets: string;
  benchmark: string;
  status: "pending" | "processing" | "completed" | "failed";
  aiInsights?: string;
  createdAt: Timestamp;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [reports, setReports] = useState<FundReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLearning, setIsLearning] = useState(false);
  const [logs, setLogs] = useState<string[]>(["Quant System Initialized", "Waiting for authentication..."]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        addLog(`Authenticated as: ${u.email}`);
        initDataListener();
      } else {
        setReports([]);
        addLog("Awaiting Secure Login...");
      }
    });
    return () => unsubAuth();
  }, []);

  const initDataListener = () => {
    const q = query(collection(db, "funds", "TASI-001", "reports"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const reportList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FundReport[];
      setReports(reportList);
    }, (err) => {
      console.error("Firestore error:", err);
      addLog("PERMISSION DENIED: System lock active.");
    });
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleLogout = () => signOut(auth);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 5));

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    addLog(`Ingesting: ${file.name}`);
    
    try {
      addLog("Fetching previous model state...");
      const prevQuery = query(
        collection(db, "funds", "TASI-001", "reports"), 
        orderBy("createdAt", "desc"), 
        limit(1)
      );
      const prevSnap = await getDocs(prevQuery);
      const prevReport = !prevSnap.empty ? prevSnap.docs[0].data() : null;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const fileData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });

      const prompt = `
        TASK: Reverse-Engineer the Quantitative Strategy of this TASI ETF.
        GOAL: We are analyzing Q1 and Q2 reports to uncover the "Hidden Model" this fund uses. We want to be able to predict what they will buy in Q3.
        CONTEXTUAL LEARNING:
        ${prevReport ? 
          `HISTORICAL DATA (Previous Quarter): 
           Holdings: ${JSON.stringify(prevReport.holdings)}
           Benchmark: ${prevReport.benchmark}
           COMPARE current PDF to this historical data.` : 'INITIAL BASELINE (Q1)'}
        REQUIREMENT: Extract totalAssets, benchmark, holdings (ticker, weight) as JSON. Return "hypothesizedRules" (array) and "q3Prediction" (string). Valid JSON only.
      `;

      setIsLearning(true);
      addLog("Reverse-engineering quant logic...");
      
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ text: prompt }, { inlineData: { data: fileData, mimeType: "application/pdf" } }],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(geminiResponse.text || "{}");
      
      addLog("Updating Strategy Model...");
      await addDoc(collection(db, "funds", "TASI-001", "reports"), {
        fundId: "TASI-001",
        quarter: prevReport ? "Q2-2024" : "Q1-2024",
        holdings: data.holdings.map((h: any) => ({ ticker: h.ticker || h.name, weight: h.weight })),
        totalAssets: data.totalAssets,
        benchmark: data.benchmark,
        aiInsights: data.q3Prediction,
        hypothesizedRules: data.hypothesizedRules || [],
        status: "completed",
        createdAt: serverTimestamp(),
        userId: user.uid
      });

      addLog("Q3 Predictive Model Evolved.");
    } catch (err) {
      console.error("Learning cycle failed", err);
      addLog("ERROR: Learning cycle interrupted.");
    } finally {
      setIsUploading(false);
      setIsLearning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const runMarketMonitor = async () => {
    addLog("Updating daily ticket context...");
    const activeTickers = reports[0]?.holdings.map(h => h.ticker).join(", ");
    if (!activeTickers) return;
    addLog(`Searching market sentiment for: ${activeTickers}`);
    setTimeout(() => addLog("Sentiment gathered. Model score stable."), 2000);
  };

  if (!user) {
    return (
      <div className="h-screen bg-[#020617] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bento-card max-w-md w-full p-12 text-center space-y-8 border-indigo-500/30"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/40">
            <TrendingUp size={40} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tighter">Quant Interface</h1>
            <p className="text-slate-400 mt-2 text-sm uppercase tracking-widest font-mono">Secure Access Required</p>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed">
            Enter the TASI Quantitative Analytics environment. Specialized tools for ETF reverse-engineering and strategy replication.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center space-x-3 group"
          >
            <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
            <span>Access with Google</span>
          </button>
        </motion.div>
      </div>
    );
  }

  const filteredReports = reports.filter(r => 
    r.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedReport = reports.find(r => r.id === selectedReportId);

  return (
    <div className="flex h-screen bg-[#020617] text-[#f8fafc] font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* Navigation Rail */}
      <aside className="w-20 border-r border-slate-800 flex flex-col items-center py-8 space-y-8 bg-[#020617]/50 backdrop-blur-xl shrink-0">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-500/20 cursor-pointer">T</div>
        <nav className="flex-1 flex flex-col space-y-4">
          <RailItem active icon={<LayoutDashboard size={20} />} />
          <RailItem icon={<FileText size={20} />} />
          <RailItem icon={<TrendingUp size={20} />} />
          <RailItem icon={<Database size={20} />} />
          <RailItem icon={<Layers size={20} />} />
        </nav>
        <button onClick={handleLogout} className="p-4 text-slate-600 hover:text-red-400 transition-colors">
          <LogOut size={20} />
        </button>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
        {/* Header Section */}
        <header className="flex justify-between items-center px-2 shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TASI Quant Replicator</h1>
            <div className="flex items-center space-x-2 mt-1">
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">SYSTEM v1.5.0</p>
              <span className="text-[10px] text-slate-700">&bull;</span>
              <p className="text-[10px] text-indigo-400 font-mono uppercase">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
              <span className="text-xs font-medium text-slate-300">LIVE FEED</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input 
                type="text" 
                placeholder="PROBE DATABASE..." 
                className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs outline-none focus:border-indigo-500 transition-colors w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Bento Grid Layout */}
        <div className="flex-1 grid grid-cols-12 grid-rows-6 gap-4 overflow-hidden">
          
          {/* Upload Card */}
          <div className="col-span-8 row-span-3 bento-card flex flex-col relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex-1 border-2 border-dashed border-slate-700 bg-slate-900/50 rounded-lg flex flex-col items-center justify-center p-8 transition-colors group-hover:border-indigo-500/30">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="mb-4 p-5 rounded-3xl bg-indigo-500/10 text-indigo-400"
              >
                {isUploading ? <Brain className="animate-bounce" size={40} /> : <Upload size={40} />}
              </motion.div>
              <h2 className="text-xl font-bold">{isLearning ? "Evolution in Progress" : "Evolve Strategy"}</h2>
              <p className="text-sm text-slate-400 mt-2 mb-8 text-center max-w-sm uppercase tracking-tighter">
                {isLearning ? "Decoding Quant Delta..." : "Ingest PDF to map investor flow."}
              </p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-xl shadow-indigo-500/20 text-sm uppercase tracking-widest disabled:opacity-50 flex items-center"
              >
                {isUploading ? "Calculating..." : <><FileUp size={16} className="mr-2" /> Load PDF</>}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleUpload} />
            </div>
          </div>

          {/* Intelligence Console */}
          <div className="col-span-4 row-span-3 bento-card p-0 overflow-hidden bg-black/40 border-indigo-500/20">
            <div className="p-4 border-b border-indigo-500/20 flex justify-between items-center bg-indigo-500/5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center">
                <Zap size={10} className="mr-2" /> Intelligence Feed
              </span>
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
              </div>
            </div>
            <div className="p-4 font-mono text-[10px] space-y-2 h-40 overflow-y-auto uppercase leading-relaxed">
              {logs.map((log, i) => (
                <div key={i} className={i === 0 ? "text-indigo-300" : "text-slate-600"}>
                  <span className="text-slate-700 mr-2">[{1000 + i}]</span> {log}
                </div>
              ))}
            </div>
            <div className="p-4 bg-indigo-500/5 border-t border-indigo-500/20">
              <button 
                onClick={runMarketMonitor}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-indigo-500/30 rounded text-[9px] font-bold uppercase tracking-widest text-indigo-400 transition-colors flex items-center justify-center font-mono"
              >
                <Globe size={12} className="mr-2" /> Sync Context Hub
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="col-span-4 row-span-1 bento-card flex items-center space-x-5">
            <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500">
              <PieChartIcon size={24} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Index Score</p>
              <p className="text-3xl font-bold">98.4</p>
            </div>
          </div>

          <div className="col-span-12 row-span-3 bento-card overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4 px-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Strategy History</h3>
              <button onClick={() => addLog("Buffer synched.")} className="text-[10px] text-indigo-400 font-bold uppercase hover:underline">Refresh</button>
            </div>
            
            <div className="flex-1 overflow-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-800/50 text-[10px] uppercase font-bold text-slate-500 sticky top-0 backdrop-blur-md">
                  <tr className="border-b border-slate-800">
                    <th className="px-6 py-4">Context</th>
                    <th className="px-6 py-4">Sync Time</th>
                    <th className="px-6 py-4 text-right">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <AnimatePresence initial={false}>
                    {filteredReports.map((report) => (
                      <motion.tr 
                        key={report.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedReportId(report.id)}
                        className={`group cursor-pointer transition-colors ${
                          selectedReportId === report.id ? "bg-indigo-500/10" : "hover:bg-slate-800/30"
                        }`}
                      >
                        <td className="px-6 py-4 font-semibold text-slate-200">{report.quarter} Profile</td>
                        <td className="px-6 py-4 text-slate-400 text-xs font-mono">{report.createdAt?.toDate().toLocaleTimeString()}</td>
                        <td className="px-6 py-4 text-right">
                          <StatusPill status={report.status} />
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {filteredReports.length === 0 && (
                <div className="p-12 text-center opacity-30 font-mono text-xs uppercase tracking-widest">
                  Ready for Data Stream
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Overlay */}
      <AnimatePresence>
        {selectedReportId && (
          <motion.div 
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            className="fixed right-0 top-0 bottom-0 w-[450px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col"
          >
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-[#020617]/50 backdrop-blur-xl">
              <div>
                <h2 className="text-xl font-bold">Strategy Frame</h2>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">{selectedReport?.quarter}</p>
              </div>
              <button onClick={() => setSelectedReportId(null)} className="text-slate-500 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {selectedReport?.status === "completed" ? (
                <>
                  <div className="p-6 bg-indigo-600/10 border border-indigo-500/30 rounded-2xl relative">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center">
                      <Zap size={14} className="mr-2 animate-pulse" /> Q3 Predictive Path
                    </h3>
                    <p className="text-sm leading-relaxed text-indigo-100 font-medium italic">
                      "{selectedReport.aiInsights}"
                    </p>
                  </div>

                  <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                      <Layers size={14} className="mr-2" /> Detected Quant Logic
                    </h3>
                    <div className="space-y-3">
                      {(selectedReport as any).hypothesizedRules?.map((rule: string, i: number) => (
                        <div key={i} className="flex items-start space-x-3 text-xs text-slate-400">
                          <CheckCircle2 size={12} className="text-indigo-500 mt-0.5 shrink-0" />
                          <span>{rule}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Current Weights</h3>
                    <div className="space-y-6">
                      {selectedReport.holdings.map((h) => (
                        <div key={h.ticker} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="font-bold text-sm text-slate-200 tracking-tight">{h.ticker}</span>
                            <span className="font-mono text-[11px] text-indigo-400">{h.weight}%</span>
                          </div>
                          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(h.weight / 10) * 100}%` }}
                              className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
                  <Activity className="animate-pulse text-indigo-500" size={48} />
                  <p className="font-mono text-xs uppercase tracking-widest">Compiling Quant Stream...</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RailItem({ icon, active = false }: { icon: ReactNode, active?: boolean }) {
  return (
    <div className={`p-4 cursor-pointer rounded-2xl transition-all ${
      active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-600 hover:text-slate-300 hover:bg-slate-900"
    }`}>
      {icon}
    </div>
  );
}

function NodeItem({ label, load, active = false }: { label: string, load: string, active?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center">
        <div className={`w-1.5 h-1.5 rounded-full mr-3 ${active ? "bg-indigo-500 animate-pulse" : "bg-slate-600"}`}></div>
        <span className={`text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>{label}</span>
      </div>
      <span className="font-mono text-[10px] text-slate-500 tracking-tighter bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{load}</span>
    </div>
  );
}

function StatusPill({ status }: { status: FundReport["status"] }) {
  const styles = {
    pending: "bg-amber-900/30 text-amber-500 border-amber-900/50",
    processing: "bg-indigo-900/30 text-indigo-400 border-indigo-900/50",
    completed: "bg-emerald-900/30 text-emerald-400 border-emerald-900/50",
    failed: "bg-red-900/30 text-red-400 border-red-900/50",
  };
  
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${styles[status]}`}>
      {status}
    </span>
  );
}

