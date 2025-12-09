/**
 * Build Library Index Script
 *
 * Run this to index KiCad libraries after downloading/updating them.
 * Usage: pnpm index-libraries
 */

import { LibraryIndexService } from "../services/library-index.js";
import { config } from "../config.js";

async function main() {
  console.log("=== vibeCAD Library Indexer ===");
  console.log(`Library path: ${config.libraryPath}`);
  console.log(`Index path: ${config.indexPath}`);
  console.log("");

  const service = new LibraryIndexService(config.libraryPath, config.indexPath);
  await service.buildIndex();

  const stats = service.getStats();
  console.log("");
  console.log("=== Index Statistics ===");
  console.log(`Components: ${stats.componentCount}`);
  console.log(`Categories: ${stats.categoryCount}`);
  console.log(`Symbol files: ${stats.symbolFileCount}`);
  console.log(`Footprint libraries: ${stats.footprintLibraryCount}`);
}

main().catch(console.error);
