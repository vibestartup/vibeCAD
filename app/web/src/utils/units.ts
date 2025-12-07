/**
 * Units utility - conversion and formatting based on user settings.
 *
 * Internal units are always millimeters (mm).
 * This module converts to/from display units.
 */

import type { LengthUnit, AngleUnit } from "../store/settings-store";

// ============================================================================
// Conversion Factors (to mm)
// ============================================================================

const LENGTH_TO_MM: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

const MM_TO_LENGTH: Record<LengthUnit, number> = {
  mm: 1,
  cm: 0.1,
  m: 0.001,
  in: 1 / 25.4,
  ft: 1 / 304.8,
};

// ============================================================================
// Length Conversion
// ============================================================================

/**
 * Convert from internal units (mm) to display units.
 */
export function mmToDisplay(mm: number, unit: LengthUnit): number {
  return mm * MM_TO_LENGTH[unit];
}

/**
 * Convert from display units to internal units (mm).
 */
export function displayToMm(value: number, unit: LengthUnit): number {
  return value * LENGTH_TO_MM[unit];
}

// ============================================================================
// Angle Conversion
// ============================================================================

/**
 * Convert from internal units (radians) to display units.
 */
export function radToDisplay(rad: number, unit: AngleUnit): number {
  if (unit === "deg") {
    return rad * (180 / Math.PI);
  }
  return rad;
}

/**
 * Convert from display units to internal units (radians).
 */
export function displayToRad(value: number, unit: AngleUnit): number {
  if (unit === "deg") {
    return value * (Math.PI / 180);
  }
  return value;
}

// ============================================================================
// Formatting
// ============================================================================

const UNIT_LABELS: Record<LengthUnit, string> = {
  mm: "mm",
  cm: "cm",
  m: "m",
  in: "in",
  ft: "ft",
};

const ANGLE_UNIT_LABELS: Record<AngleUnit, string> = {
  deg: "°",
  rad: "rad",
};

/**
 * Format a length value for display with unit suffix.
 * @param mm Value in millimeters
 * @param unit Display unit
 * @param decimals Number of decimal places (default: auto based on magnitude)
 */
export function formatLength(mm: number, unit: LengthUnit, decimals?: number): string {
  const value = mmToDisplay(mm, unit);
  const absValue = Math.abs(value);

  // Auto-determine decimal places if not specified
  let decimalPlaces = decimals;
  if (decimalPlaces === undefined) {
    if (absValue === 0) {
      decimalPlaces = 0;
    } else if (absValue < 0.1) {
      decimalPlaces = 3;
    } else if (absValue < 1) {
      decimalPlaces = 2;
    } else if (absValue < 10) {
      decimalPlaces = 1;
    } else {
      decimalPlaces = 0;
    }
  }

  return `${value.toFixed(decimalPlaces)}${UNIT_LABELS[unit]}`;
}

/**
 * Format an angle value for display with unit suffix.
 * @param rad Value in radians
 * @param unit Display unit
 * @param decimals Number of decimal places
 */
export function formatAngle(rad: number, unit: AngleUnit, decimals: number = 1): string {
  const value = radToDisplay(rad, unit);
  return `${value.toFixed(decimals)}${ANGLE_UNIT_LABELS[unit]}`;
}

/**
 * Get the unit label for a length unit.
 */
export function getLengthUnitLabel(unit: LengthUnit): string {
  return UNIT_LABELS[unit];
}

/**
 * Get the unit label for an angle unit.
 */
export function getAngleUnitLabel(unit: AngleUnit): string {
  return ANGLE_UNIT_LABELS[unit];
}

// ============================================================================
// Grid Spacing Calculation
// ============================================================================

/**
 * Calculate appropriate grid spacing based on camera distance and display unit.
 * Returns spacing in millimeters (internal units).
 */
export function calculateGridSpacing(
  cameraDistance: number,
  unit: LengthUnit
): { major: number; minor: number; label: string } {
  // Base spacing depends on camera distance
  const baseSpacing = cameraDistance / 8;

  // Nice numbers vary by unit system
  const niceNumbersMm = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const niceNumbersIn = [
    0.254,    // 0.01 in
    0.635,    // 0.025 in
    1.27,     // 0.05 in
    2.54,     // 0.1 in
    6.35,     // 0.25 in
    12.7,     // 0.5 in
    25.4,     // 1 in
    50.8,     // 2 in
    127,      // 5 in
    254,      // 10 in
    304.8,    // 1 ft
    609.6,    // 2 ft
    1524,     // 5 ft
    3048,     // 10 ft
  ];

  const niceNumbers = (unit === "in" || unit === "ft") ? niceNumbersIn : niceNumbersMm;

  let majorSpacing = niceNumbers[0];
  for (const n of niceNumbers) {
    if (n >= baseSpacing) {
      majorSpacing = n;
      break;
    }
    majorSpacing = n;
  }

  // Minor grid is 1/5 of major
  const minorSpacing = majorSpacing / 5;

  // Format label in display units
  const label = formatLength(majorSpacing, unit);

  return { major: majorSpacing, minor: minorSpacing, label };
}

/**
 * Format a tick label value (in mm) for display.
 */
export function formatTickLabel(mm: number, unit: LengthUnit): string {
  if (mm === 0) return "0";
  return formatLength(mm, unit, 0);
}
