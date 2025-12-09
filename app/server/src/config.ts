/**
 * Server configuration
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  corsOrigins: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:5173", "http://localhost:3000"],

  // Path to KiCad libraries (can be a git submodule or local directory)
  libraryPath: process.env.LIBRARY_PATH || path.resolve(__dirname, "../../libraries/kicad"),

  // Index file path
  indexPath: process.env.INDEX_PATH || path.resolve(__dirname, "../../data/library-index.json"),

  // Maximum file size to serve (in bytes)
  maxFileSize: 10 * 1024 * 1024, // 10MB

  // Cache settings
  cacheMaxAge: 3600, // 1 hour
};
