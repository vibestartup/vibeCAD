/**
 * Component Library System
 *
 * Provides an abstracted interface for loading components from multiple sources:
 * - KiCad libraries (.kicad_sym, .kicad_mod)
 * - LCSC/JLCPCB parts database (future)
 * - SnapEDA component search (future)
 * - User-created libraries
 * - Built-in libraries
 */

export * from "./provider";
export * from "./kicad";
