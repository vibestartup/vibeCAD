/**
 * Path Utilities
 *
 * Pure functions for path manipulation. All paths use forward slashes
 * and are absolute (start with /).
 */

/**
 * Normalize a path: resolve . and .., remove trailing slashes (except root),
 * collapse multiple slashes.
 */
export function normalize(path: string): string {
  // Handle empty or relative paths
  if (!path || path === "") {
    return "/";
  }

  // Ensure path starts with /
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  // Split into segments
  const segments = path.split("/").filter((s) => s !== "" && s !== ".");
  const result: string[] = [];

  for (const segment of segments) {
    if (segment === "..") {
      // Go up one level, but don't go above root
      if (result.length > 0) {
        result.pop();
      }
    } else {
      result.push(segment);
    }
  }

  // Reconstruct path
  const normalized = "/" + result.join("/");
  return normalized;
}

/**
 * Join path segments into a single normalized path.
 */
export function join(...parts: string[]): string {
  if (parts.length === 0) {
    return "/";
  }

  // Start with the first absolute path, or root
  let result = "";
  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith("/")) {
      // Absolute path resets the result
      result = part;
    } else if (result === "" || result === "/") {
      result = "/" + part;
    } else {
      result = result + "/" + part;
    }
  }

  return normalize(result);
}

/**
 * Resolve a relative path against a base path.
 * If the relative path is absolute, it is returned normalized.
 */
export function resolve(base: string, relative: string): string {
  if (!relative) {
    return normalize(base);
  }

  if (relative.startsWith("/")) {
    // Absolute path
    return normalize(relative);
  }

  // Relative path: join with base directory
  const baseDir = dirname(base);
  return join(baseDir, relative);
}

/**
 * Get the directory name (parent path) of a path.
 */
export function dirname(path: string): string {
  const normalized = normalize(path);
  if (normalized === "/") {
    return "/";
  }

  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === 0) {
    return "/";
  }

  return normalized.slice(0, lastSlash);
}

/**
 * Get the base name (file/directory name) of a path.
 */
export function basename(path: string, ext?: string): string {
  const normalized = normalize(path);
  if (normalized === "/") {
    return "";
  }

  const lastSlash = normalized.lastIndexOf("/");
  let name = normalized.slice(lastSlash + 1);

  // Remove extension if provided
  if (ext && name.endsWith(ext)) {
    name = name.slice(0, -ext.length);
  }

  return name;
}

/**
 * Get the extension of a path (including the dot).
 */
export function extname(path: string): string {
  const name = basename(path);
  const dotIndex = name.lastIndexOf(".");

  if (dotIndex <= 0) {
    // No extension, or dot is first character (hidden file)
    return "";
  }

  return name.slice(dotIndex);
}

/**
 * Check if a path is absolute (starts with /).
 */
export function isAbsolute(path: string): boolean {
  return path.startsWith("/");
}

/**
 * Get the relative path from one path to another.
 */
export function relative(from: string, to: string): string {
  const fromNorm = normalize(from);
  const toNorm = normalize(to);

  if (fromNorm === toNorm) {
    return ".";
  }

  const fromParts = fromNorm.split("/").filter(Boolean);
  const toParts = toNorm.split("/").filter(Boolean);

  // Find common prefix length
  let commonLength = 0;
  while (
    commonLength < fromParts.length &&
    commonLength < toParts.length &&
    fromParts[commonLength] === toParts[commonLength]
  ) {
    commonLength++;
  }

  // Build relative path
  const upCount = fromParts.length - commonLength;
  const downParts = toParts.slice(commonLength);

  const relativeParts = [...Array(upCount).fill(".."), ...downParts];

  return relativeParts.length > 0 ? relativeParts.join("/") : ".";
}

/**
 * Check if a child path is inside a parent path.
 */
export function isInside(parent: string, child: string): boolean {
  const parentNorm = normalize(parent);
  const childNorm = normalize(child);

  if (parentNorm === "/") {
    return true;
  }

  return childNorm.startsWith(parentNorm + "/") || childNorm === parentNorm;
}

/**
 * Validate a path segment (file or directory name).
 * Returns true if valid, false otherwise.
 */
export function isValidName(name: string): boolean {
  if (!name || name === "" || name === "." || name === "..") {
    return false;
  }

  // Check for invalid characters
  const invalidChars = /[<>:"|?*\x00-\x1f\\]/;
  if (invalidChars.test(name)) {
    return false;
  }

  // Check for reserved names (Windows)
  const reserved = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
  if (reserved.test(name)) {
    return false;
  }

  // Check length
  if (name.length > 255) {
    return false;
  }

  return true;
}

/**
 * Validate an entire path.
 * Returns true if all segments are valid.
 */
export function isValidPath(path: string): boolean {
  const normalized = normalize(path);
  if (normalized === "/") {
    return true;
  }

  const segments = normalized.split("/").filter(Boolean);
  return segments.every(isValidName);
}

/**
 * Split a path into its segments.
 */
export function segments(path: string): string[] {
  const normalized = normalize(path);
  if (normalized === "/") {
    return [];
  }
  return normalized.split("/").filter(Boolean);
}

/**
 * Get all parent paths of a path, from root to immediate parent.
 * e.g., "/a/b/c" -> ["/", "/a", "/a/b"]
 */
export function parents(path: string): string[] {
  const normalized = normalize(path);
  if (normalized === "/") {
    return [];
  }

  const result: string[] = ["/"];
  const parts = segments(normalized);

  for (let i = 0; i < parts.length - 1; i++) {
    result.push("/" + parts.slice(0, i + 1).join("/"));
  }

  return result;
}
