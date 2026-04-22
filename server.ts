import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

// Note: uuid needs to be installed if we want to use it
// For now, I'll use a simple random string generator since it's a demo
const app = express();
const PORT = 3000;

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Storage configuration for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// In-memory Database simulation (mimicking SQLAlchemy models)
interface FundReport {
  id: string;
  fund_id: number;
  pdf_storage_path: string;
  report_date: string;
  status: "pending" | "processing" | "completed" | "failed";
  extracted_data?: any;
}

const reports: FundReport[] = [];

// API Routes
app.use(express.json());

// 1. Upload report endpoint
app.post("/api/upload-report", upload.single("file"), (req, res) => {
  const { fund_id, extracted_data } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const dbReport: FundReport = {
    id: uuidv4(),
    fund_id: parseInt(fund_id),
    pdf_storage_path: file.path,
    report_date: "2024-03-31", // Defaults for extraction
    status: extracted_data ? "completed" : "pending",
    extracted_data: extracted_data ? JSON.parse(extracted_data) : undefined,
  };

  reports.push(dbReport);

  // Background processing simulation only if not already extracted
  if (dbReport.status === "pending") {
    processReport(dbReport.id);
  }

  res.json(dbReport);
});

// 2. Get report status
app.get("/api/reports/:id", (req, res) => {
  const report = reports.find((r) => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json(report);
});

// 3. List reports
app.get("/api/reports", (req, res) => {
  res.json(reports);
});

async function processReport(reportId: string) {
  const report = reports.find((r) => r.id === reportId);
  if (!report) return;

  report.status = "processing";
  
  // Simulate heavy processing (AI extraction)
  // In a real app, this would call Gemini API or another service
  setTimeout(() => {
    report.status = "completed";
    report.extracted_data = {
      holdings: [
        { name: "SABIC", weight: 5.4 },
        { name: "Al Rajhi Bank", weight: 8.2 },
        { name: "STC", weight: 3.1 }
      ],
      total_assets: "1.2B SAR",
      benchmark: "TASI"
    };
    console.log(`Report ${reportId} processed.`);
  }, 5000);
}

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
