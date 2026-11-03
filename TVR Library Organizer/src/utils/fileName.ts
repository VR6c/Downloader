/** Characters that are invalid in file names on macOS/Windows, plus control characters. */
const FORBIDDEN_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;
const MEDIA_EXTENSION = /\.(mp3|mp4|mov|m4a|webm|wav|flac)$/i;
const MAX_LENGTH = 180;

/**
 * Normalizes a user-typed download file name (no extension): strips forbidden characters,
 * collapses whitespace, drops a trailing media extension and leading/trailing dots.
 * Mirrors `sanitize_custom_filename` in python/engine.py; the engine re-applies it as the authority.
 */
export function sanitizeDownloadFileName(raw: string): string {
  return raw
    .replace(FORBIDDEN_CHARS, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(MEDIA_EXTENSION, '')
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, MAX_LENGTH)
    .trim();
}
