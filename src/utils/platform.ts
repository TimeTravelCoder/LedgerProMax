/**
 * Platform detection utility — synchronous for immediate UI decisions.
 * Uses navigator.userAgent (fast, no async required on first paint).
 *
 * For Rust-backed verification (tauri-plugin-os), import { platform } from
 * "@tauri-apps/plugin-os" and call `await platform()` for the canonical OS
 * name ("macos" | "windows" | "linux").
 */

function detectPlatform(): "macos" | "windows" | "linux" | "unknown" {
  // When running inside Tauri, the userAgent reliably includes the OS name
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return "macos";
  if (/Win/i.test(ua)) return "windows";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "unknown";
}

const PLATFORM = detectPlatform();

/** True when the app is running on macOS (any architecture). */
export const IS_MACOS = PLATFORM === "macos";

/** True when the app is running on Windows (any architecture). */
export const IS_WINDOWS = PLATFORM === "windows";

/** True when the app is running on Linux. */
export const IS_LINUX = PLATFORM === "linux";

/**
 * Native path separator for the current OS.
 *   - macOS / Linux: "/"
 *   - Windows:        "\\"
 */
export const PATH_SEP = IS_WINDOWS ? "\\" : "/";

/**
 * Modifier key symbol for UI labels.
 *   - macOS: "⌘"
 *   - other: "Ctrl"
 */
export const MOD_KEY = IS_MACOS ? "⌘" : "Ctrl";

/**
 * Modifier key symbol with "+" appended, for shortcut strings.
 *   - macOS: "⌘+"
 *   - other: "Ctrl+"
 */
export const MOD_KEY_SYMBOL = IS_MACOS ? "⌘+" : "Ctrl+";

/**
 * Normalise a file path for the current OS by replacing any mix of forward-
 * and backslashes with the native separator.
 */
export function normalizePathForOS(input: string): string {
  return input.replace(/[/\\]+/g, PATH_SEP);
}

/**
 * Normalise to POSIX-style forward slashes (used for internal routing, DB
 * keys, and ZIP entry names that are always "/"-separated).
 */
export function normalizePathUnix(input: string): string {
  return input.replace(/\\/g, "/").replace(/\/+/g, "/");
}
