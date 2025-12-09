/**
 * vibeCAD Library Server
 *
 * Lightweight server for serving KiCad libraries to the web client.
 * This keeps heavy library files off the client while providing
 * fast indexed search.
 */

import express from "express";
import cors from "cors";
import { libraryRouter } from "./routes/library.js";
import { config } from "./config.js";

const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "0.1.0" });
});

// API routes
app.use("/api/libraries", libraryRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({ error: err.message });
});

// Start server
const port = config.port;
app.listen(port, () => {
  console.log(`vibeCAD Library Server running on port ${port}`);
  console.log(`Library path: ${config.libraryPath}`);
});
