/**
 * Mathematical primitives for CAD operations.
 * All types are immutable (readonly tuples).
 */

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Vec4 = readonly [number, number, number, number];

/** 3x3 matrix in row-major order */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

/** 4x4 matrix in row-major order (flat array for WebGL compatibility) */
export type Mat4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

// ============================================================================
// Vec2 operations
// ============================================================================

export const vec2 = {
  create: (x: number, y: number): Vec2 => [x, y],
  zero: (): Vec2 => [0, 0],

  add: (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]],
  sub: (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]],
  scale: (v: Vec2, s: number): Vec2 => [v[0] * s, v[1] * s],
  negate: (v: Vec2): Vec2 => [-v[0], -v[1]],

  dot: (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1],
  cross: (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0],

  length: (v: Vec2): number => Math.sqrt(v[0] * v[0] + v[1] * v[1]),
  lengthSq: (v: Vec2): number => v[0] * v[0] + v[1] * v[1],

  normalize: (v: Vec2): Vec2 => {
    const len = vec2.length(v);
    return len > 0 ? vec2.scale(v, 1 / len) : [0, 0];
  },

  distance: (a: Vec2, b: Vec2): number => vec2.length(vec2.sub(b, a)),
  distanceSq: (a: Vec2, b: Vec2): number => vec2.lengthSq(vec2.sub(b, a)),

  lerp: (a: Vec2, b: Vec2, t: number): Vec2 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ],

  rotate: (v: Vec2, angle: number): Vec2 => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
  },

  equals: (a: Vec2, b: Vec2, epsilon = 1e-10): boolean =>
    Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon,
};

// ============================================================================
// Vec3 operations
// ============================================================================

export const vec3 = {
  create: (x: number, y: number, z: number): Vec3 => [x, y, z],
  zero: (): Vec3 => [0, 0, 0],
  unitX: (): Vec3 => [1, 0, 0],
  unitY: (): Vec3 => [0, 1, 0],
  unitZ: (): Vec3 => [0, 0, 1],

  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s],
  negate: (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]],

  dot: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],

  cross: (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],

  length: (v: Vec3): number => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
  lengthSq: (v: Vec3): number => v[0] * v[0] + v[1] * v[1] + v[2] * v[2],

  normalize: (v: Vec3): Vec3 => {
    const len = vec3.length(v);
    return len > 0 ? vec3.scale(v, 1 / len) : [0, 0, 0];
  },

  distance: (a: Vec3, b: Vec3): number => vec3.length(vec3.sub(b, a)),
  distanceSq: (a: Vec3, b: Vec3): number => vec3.lengthSq(vec3.sub(b, a)),

  lerp: (a: Vec3, b: Vec3, t: number): Vec3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ],

  equals: (a: Vec3, b: Vec3, epsilon = 1e-10): boolean =>
    Math.abs(a[0] - b[0]) < epsilon &&
    Math.abs(a[1] - b[1]) < epsilon &&
    Math.abs(a[2] - b[2]) < epsilon,
};

// ============================================================================
// Mat3 operations
// ============================================================================

export const mat3 = {
  identity: (): Mat3 => [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],

  fromRows: (r0: Vec3, r1: Vec3, r2: Vec3): Mat3 => [r0, r1, r2],

  multiply: (a: Mat3, b: Mat3): Mat3 => {
    const result: [number[], number[], number[]] = [[], [], []];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        result[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
      }
    }
    return result as unknown as Mat3;
  },

  transformVec3: (m: Mat3, v: Vec3): Vec3 => [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ],

  transpose: (m: Mat3): Mat3 => [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ],

  determinant: (m: Mat3): number =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]),
};

// ============================================================================
// Constants
// ============================================================================

export const EPSILON = 1e-10;
export const PI = Math.PI;
export const TWO_PI = 2 * Math.PI;
export const HALF_PI = Math.PI / 2;
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export function degToRad(deg: number): number {
  return deg * DEG_TO_RAD;
}

export function radToDeg(rad: number): number {
  return rad * RAD_TO_DEG;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function approxEqual(a: number, b: number, epsilon = EPSILON): boolean {
  return Math.abs(a - b) < epsilon;
}
