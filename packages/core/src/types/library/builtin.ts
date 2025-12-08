/**
 * Built-in component library - basic passive components and common ICs.
 */

import { ComponentLibrary, createBuiltinLibrary, addSymbolToLibrary, addFootprintToLibrary, addComponentToLibrary } from "./library";
import { Component, createComponent, setComponentDescription, addComponentKeywords, addComponentSymbol, addComponentFootprint, setComponentSpec, setComponentManufacturer, addComponentSupplier } from "./component";
import {
  createResistorSymbol,
  createCapacitorSymbol,
  createLedSymbol,
  createNpnSymbol,
  createGroundSymbol,
  createVccSymbol,
} from "../schematic/symbol";
import { create0805Footprint } from "../pcb/footprint";
import { LayerId } from "../id";

// ============================================================================
// Built-in Library Creator
// ============================================================================

/**
 * Create the built-in basic components library.
 * Requires layer IDs to be passed in since they're document-specific.
 */
export function createBuiltinBasicsLibrary(
  layers: {
    topCopper: LayerId;
    topSilk: LayerId;
    topFab: LayerId;
    topCrtYd: LayerId;
  }
): ComponentLibrary {
  let library = createBuiltinLibrary(
    "Basic Components",
    "Built-in library of common passive components"
  );

  // ========================================
  // Symbols
  // ========================================

  const resistorSymbol = createResistorSymbol();
  const capacitorSymbol = createCapacitorSymbol();
  const ledSymbol = createLedSymbol();
  const npnSymbol = createNpnSymbol();
  const gndSymbol = createGroundSymbol();
  const vccSymbol = createVccSymbol();

  // Note: For built-in library, we add symbols directly (bypass readOnly check)
  library = {
    ...library,
    symbols: new Map([
      [resistorSymbol.id, resistorSymbol],
      [capacitorSymbol.id, capacitorSymbol],
      [ledSymbol.id, ledSymbol],
      [npnSymbol.id, npnSymbol],
      [gndSymbol.id, gndSymbol],
      [vccSymbol.id, vccSymbol],
    ]),
  };

  // ========================================
  // Footprints
  // ========================================

  const fp0805 = create0805Footprint(
    layers.topCopper,
    layers.topSilk,
    layers.topFab,
    layers.topCrtYd
  );

  library = {
    ...library,
    footprints: new Map([
      [fp0805.id, fp0805],
    ]),
  };

  // ========================================
  // Components
  // ========================================

  // Generic Resistor
  let resistor = createComponent("Resistor", "resistor", library.id);
  resistor = setComponentDescription(resistor, "Generic SMD Resistor");
  resistor = addComponentKeywords(resistor, ["resistor", "smd", "passive", "r"]);
  resistor = { ...resistor, symbols: [resistorSymbol.id] };
  resistor = { ...resistor, footprints: [fp0805.id], defaultFootprintId: fp0805.id };
  resistor = setComponentSpec(resistor, "package", "0805");
  resistor = setComponentSpec(resistor, "tolerance", 1); // 1%

  // Generic Capacitor
  let capacitor = createComponent("Capacitor", "capacitor", library.id);
  capacitor = setComponentDescription(capacitor, "Generic SMD Capacitor");
  capacitor = addComponentKeywords(capacitor, ["capacitor", "smd", "passive", "c", "cap"]);
  capacitor = { ...capacitor, symbols: [capacitorSymbol.id] };
  capacitor = { ...capacitor, footprints: [fp0805.id], defaultFootprintId: fp0805.id };
  capacitor = setComponentSpec(capacitor, "package", "0805");

  // LED
  let led = createComponent("LED", "led", library.id);
  led = setComponentDescription(led, "Generic SMD LED");
  led = addComponentKeywords(led, ["led", "light", "diode", "indicator"]);
  led = { ...led, symbols: [ledSymbol.id] };
  led = { ...led, footprints: [fp0805.id], defaultFootprintId: fp0805.id };
  led = setComponentSpec(led, "package", "0805");
  led = setComponentSpec(led, "forward_voltage", 2.0);

  // Power symbols (no footprint)
  let gnd = createComponent("GND", "power", library.id);
  gnd = setComponentDescription(gnd, "Ground symbol");
  gnd = addComponentKeywords(gnd, ["ground", "gnd", "vss", "power"]);
  gnd = { ...gnd, symbols: [gndSymbol.id] };

  let vcc = createComponent("VCC", "power", library.id);
  vcc = setComponentDescription(vcc, "Positive supply symbol");
  vcc = addComponentKeywords(vcc, ["vcc", "vdd", "power", "supply", "positive"]);
  vcc = { ...vcc, symbols: [vccSymbol.id] };

  library = {
    ...library,
    components: new Map([
      [resistor.id, resistor],
      [capacitor.id, capacitor],
      [led.id, led],
      [gnd.id, gnd],
      [vcc.id, vcc],
    ]),
  };

  return library;
}

// ============================================================================
// Pre-defined Component Values
// ============================================================================

/**
 * Standard E24 resistor values (multiplied by decades).
 */
export const E24_VALUES = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
  3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
];

/**
 * Common resistor values.
 */
export const COMMON_RESISTOR_VALUES = [
  // Ohms
  10, 22, 47, 100, 220, 330, 470,
  // kOhms
  1000, 2200, 3300, 4700, 10000, 22000, 47000, 100000,
  // MOhms
  1000000,
];

/**
 * Common capacitor values.
 */
export const COMMON_CAPACITOR_VALUES = [
  // pF
  10e-12, 22e-12, 47e-12, 100e-12, 220e-12, 470e-12,
  // nF
  1e-9, 2.2e-9, 4.7e-9, 10e-9, 22e-9, 47e-9, 100e-9, 220e-9, 470e-9,
  // uF
  1e-6, 2.2e-6, 4.7e-6, 10e-6, 22e-6, 47e-6, 100e-6,
];

/**
 * Format a resistor value for display.
 */
export function formatResistorValue(ohms: number): string {
  if (ohms >= 1e6) {
    const val = ohms / 1e6;
    return Number.isInteger(val) ? `${val}M` : `${val.toFixed(1)}M`;
  }
  if (ohms >= 1e3) {
    const val = ohms / 1e3;
    return Number.isInteger(val) ? `${val}k` : `${val.toFixed(1)}k`;
  }
  return Number.isInteger(ohms) ? `${ohms}` : `${ohms.toFixed(1)}`;
}

/**
 * Format a capacitor value for display.
 */
export function formatCapacitorValue(farads: number): string {
  if (farads >= 1e-6) {
    const val = farads / 1e-6;
    return Number.isInteger(val) ? `${val}uF` : `${val.toFixed(1)}uF`;
  }
  if (farads >= 1e-9) {
    const val = farads / 1e-9;
    return Number.isInteger(val) ? `${val}nF` : `${val.toFixed(1)}nF`;
  }
  const val = farads / 1e-12;
  return Number.isInteger(val) ? `${val}pF` : `${val.toFixed(1)}pF`;
}

/**
 * Parse a resistor value string (e.g., "10k", "4.7M", "100").
 */
export function parseResistorValue(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)\s*([kKmM]?)$/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  if (isNaN(num)) return null;

  const suffix = match[2].toUpperCase();
  switch (suffix) {
    case "K":
      return num * 1e3;
    case "M":
      return num * 1e6;
    default:
      return num;
  }
}

/**
 * Parse a capacitor value string (e.g., "100nF", "10uF", "47pF").
 */
export function parseCapacitorValue(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)\s*([pPnNuU])?[fF]?$/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  if (isNaN(num)) return null;

  const suffix = (match[2] || "").toLowerCase();
  switch (suffix) {
    case "p":
      return num * 1e-12;
    case "n":
      return num * 1e-9;
    case "u":
      return num * 1e-6;
    default:
      return num; // Assume Farads if no suffix
  }
}
