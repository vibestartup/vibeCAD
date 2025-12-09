/**
 * Library API Routes
 *
 * Provides endpoints for:
 * - GET /api/libraries/kicad/index - Get component index
 * - GET /api/libraries/kicad/search - Search components
 * - GET /api/libraries/kicad/symbol/:file - Get symbol library file
 * - GET /api/libraries/kicad/footprint/:file - Get footprint file
 * - GET /api/libraries/kicad/categories - Get category tree
 */

import { Router, Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { config } from "../config.js";
import { LibraryIndexService } from "../services/library-index.js";

export const libraryRouter = Router();

// Lazy-loaded index service
let indexService: LibraryIndexService | null = null;

async function getIndexService(): Promise<LibraryIndexService> {
  if (!indexService) {
    indexService = new LibraryIndexService(config.libraryPath, config.indexPath);
    await indexService.initialize();
  }
  return indexService;
}

// ============================================================================
// Index Endpoints
// ============================================================================

/**
 * GET /api/libraries/kicad/index
 * Get the full component index (for client-side caching)
 */
libraryRouter.get("/kicad/index", async (_req: Request, res: Response) => {
  try {
    const service = await getIndexService();
    const index = service.getIndex();

    res.set("Cache-Control", `public, max-age=${config.cacheMaxAge}`);
    res.json(index);
  } catch (err) {
    console.error("Failed to get index:", err);
    res.status(500).json({ error: "Failed to load index" });
  }
});

/**
 * GET /api/libraries/kicad/categories
 * Get category tree for browsing
 */
libraryRouter.get("/kicad/categories", async (_req: Request, res: Response) => {
  try {
    const service = await getIndexService();
    const categories = service.getCategoryTree();

    res.set("Cache-Control", `public, max-age=${config.cacheMaxAge}`);
    res.json(categories);
  } catch (err) {
    console.error("Failed to get categories:", err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

// ============================================================================
// Search Endpoints
// ============================================================================

/**
 * GET /api/libraries/kicad/search
 * Search for components
 *
 * Query params:
 * - q: Search text
 * - category: Filter by category
 * - package: Filter by package
 * - limit: Max results (default 50)
 * - offset: Pagination offset
 */
libraryRouter.get("/kicad/search", async (req: Request, res: Response) => {
  try {
    const service = await getIndexService();

    const query = {
      text: req.query.q as string | undefined,
      category: req.query.category as string | undefined,
      package: req.query.package as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const results = service.search(query);
    res.json(results);
  } catch (err) {
    console.error("Search failed:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

/**
 * GET /api/libraries/kicad/components/:category
 * Get components by category
 */
libraryRouter.get("/kicad/components/:category", async (req: Request, res: Response) => {
  try {
    const service = await getIndexService();

    const results = service.getComponentsByCategory(
      req.params.category,
      req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      req.query.offset ? parseInt(req.query.offset as string, 10) : 0
    );

    res.json(results);
  } catch (err) {
    console.error("Failed to get components:", err);
    res.status(500).json({ error: "Failed to load components" });
  }
});

// ============================================================================
// File Endpoints
// ============================================================================

/**
 * GET /api/libraries/kicad/symbol/:file
 * Get a symbol library file content
 */
libraryRouter.get("/kicad/symbol/:file", async (req: Request, res: Response) => {
  try {
    const filename = decodeURIComponent(req.params.file);
    const filepath = path.join(config.libraryPath, "symbols", filename);

    // Security: Ensure path is within library directory
    const resolved = path.resolve(filepath);
    if (!resolved.startsWith(path.resolve(config.libraryPath))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Check file size
    const stat = await fs.stat(resolved);
    if (stat.size > config.maxFileSize) {
      res.status(413).json({ error: "File too large" });
      return;
    }

    const content = await fs.readFile(resolved, "utf-8");

    res.set("Content-Type", "text/plain");
    res.set("Cache-Control", `public, max-age=${config.cacheMaxAge}`);
    res.send(content);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      res.status(404).json({ error: "File not found" });
    } else {
      console.error("Failed to read symbol file:", err);
      res.status(500).json({ error: "Failed to read file" });
    }
  }
});

/**
 * GET /api/libraries/kicad/footprint/:library/:file
 * Get a footprint file content
 */
libraryRouter.get("/kicad/footprint/:library/:file", async (req: Request, res: Response) => {
  try {
    const library = decodeURIComponent(req.params.library);
    const filename = decodeURIComponent(req.params.file);
    const filepath = path.join(config.libraryPath, "footprints", library, filename);

    // Security: Ensure path is within library directory
    const resolved = path.resolve(filepath);
    if (!resolved.startsWith(path.resolve(config.libraryPath))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Check file size
    const stat = await fs.stat(resolved);
    if (stat.size > config.maxFileSize) {
      res.status(413).json({ error: "File too large" });
      return;
    }

    const content = await fs.readFile(resolved, "utf-8");

    res.set("Content-Type", "text/plain");
    res.set("Cache-Control", `public, max-age=${config.cacheMaxAge}`);
    res.send(content);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      res.status(404).json({ error: "File not found" });
    } else {
      console.error("Failed to read footprint file:", err);
      res.status(500).json({ error: "Failed to read file" });
    }
  }
});

// ============================================================================
// Stats Endpoint
// ============================================================================

/**
 * GET /api/libraries/kicad/stats
 * Get library statistics
 */
libraryRouter.get("/kicad/stats", async (_req: Request, res: Response) => {
  try {
    const service = await getIndexService();
    const stats = service.getStats();

    res.json(stats);
  } catch (err) {
    console.error("Failed to get stats:", err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});
