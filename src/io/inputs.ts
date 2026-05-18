import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import fg from "fast-glob";

export const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".mkv",
  ".avi",
  ".m4v",
  ".webm",
]);

export const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  ".wav",
  ".mp3",
  ".m4a",
  ".aac",
  ".flac",
  ".ogg",
]);

export const SUPPORTED_MEDIA_EXTENSIONS: ReadonlySet<string> = new Set([
  ...SUPPORTED_VIDEO_EXTENSIONS,
  ...SUPPORTED_AUDIO_EXTENSIONS,
]);

function expandHome(input: string): string {
  if (!input.startsWith("~")) return input;
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function isMediaPath(file: string): boolean {
  return SUPPORTED_MEDIA_EXTENSIONS.has(path.extname(file).toLowerCase());
}

async function statSafe(target: string): Promise<{ isFile: boolean; isDir: boolean }> {
  try {
    const s = await fs.stat(target);
    return { isFile: s.isFile(), isDir: s.isDirectory() };
  } catch {
    return { isFile: false, isDir: false };
  }
}

function looksLikeGlob(value: string): boolean {
  return /[*?[\]]/.test(value);
}

async function walkMediaFiles(dir: string): Promise<string[]> {
  const matches = await fg("**/*", {
    cwd: dir,
    onlyFiles: true,
    absolute: true,
    caseSensitiveMatch: false,
    dot: false,
    suppressErrors: true,
  });
  return matches.filter(isMediaPath);
}

async function resolveGlob(pattern: string): Promise<string[]> {
  const matches = await fg(pattern, {
    onlyFiles: true,
    absolute: true,
    caseSensitiveMatch: false,
    dot: false,
    suppressErrors: true,
  });
  return matches.filter(isMediaPath);
}

export async function expandVideoInputs(rawInputs: readonly string[]): Promise<string[]> {
  const resolved: string[] = [];

  for (const raw of rawInputs) {
    const expanded = expandHome(raw);
    const abs = path.resolve(expanded);
    let matches: string[] = [];

    const stats = await statSafe(abs);
    if (stats.isDir) {
      matches = await walkMediaFiles(abs);
    } else if (looksLikeGlob(raw)) {
      matches = await resolveGlob(expanded);
    } else if (stats.isFile && isMediaPath(abs)) {
      matches = [abs];
    }

    matches.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    for (const m of matches) resolved.push(path.resolve(m));
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const p of resolved) {
    if (seen.has(p)) continue;
    seen.add(p);
    deduped.push(p);
  }
  return deduped;
}
