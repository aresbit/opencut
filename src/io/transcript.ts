import { promises as fs } from "node:fs";
import { type Highlight, type Segment, type WordTimestamp, createSegment } from "../models.ts";

export interface TranscriptMeta {
  title: string;
  subtitle: string;
  highlights: Highlight[];
}

export interface TranscriptLoadResult {
  segments: Segment[];
  meta: TranscriptMeta;
}

function emptyMeta(): TranscriptMeta {
  return { title: "", subtitle: "", highlights: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coerceWords(value: unknown): WordTimestamp[] {
  if (!Array.isArray(value)) return [];
  const out: WordTimestamp[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    out.push({
      word: String(raw.word ?? ""),
      start: toFiniteNumber(raw.start, 0),
      end: toFiniteNumber(raw.end, 0),
      punctuation: String(raw.punctuation ?? ""),
    });
  }
  return out;
}

function coerceSegments(raw: unknown): Segment[] {
  if (!Array.isArray(raw)) return [];
  const segments: Segment[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const start = toFiniteNumber(item.start, Number.NaN);
    if (!Number.isFinite(start)) continue;
    const end = toFiniteNumber(item.end, start);
    const text = String(item.text ?? "");
    const words = coerceWords(item.words);
    segments.push(createSegment(start, end, text, words));
  }
  return segments;
}

function coerceHighlights(raw: unknown): Highlight[] {
  if (!Array.isArray(raw)) return [];
  const out: Highlight[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const start = toFiniteNumber(item.start, Number.NaN);
    if (!Number.isFinite(start)) continue;
    const end = toFiniteNumber(item.end, start);
    out.push({
      start,
      end,
      title: String(item.title ?? ""),
      subtitle: String(item.subtitle ?? ""),
      content: String(item.content ?? ""),
      keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
      segment_keywords: Array.isArray(item.segment_keywords)
        ? (item.segment_keywords.filter(isRecord) as Highlight["segment_keywords"])
        : [],
    });
  }
  return out;
}

export async function loadSegmentsFromTranscriptJson(
  transcriptPath: string,
): Promise<TranscriptLoadResult> {
  const raw = await fs.readFile(transcriptPath, "utf8");
  const payload = JSON.parse(raw) as unknown;

  if (Array.isArray(payload)) {
    return { segments: coerceSegments(payload), meta: emptyMeta() };
  }

  if (isRecord(payload)) {
    return {
      segments: coerceSegments(payload.segments),
      meta: {
        title: String(payload.title ?? ""),
        subtitle: String(payload.subtitle ?? ""),
        highlights: coerceHighlights(payload.highlights),
      },
    };
  }

  console.warn(
    `⚠️  Unexpected transcript JSON root type ${typeof payload}, treating as empty`,
  );
  return { segments: [], meta: emptyMeta() };
}

export interface TranscriptSavePayload {
  segments: Segment[];
  title?: string;
  subtitle?: string;
  highlights?: Highlight[];
}

export async function saveTranscriptJson(
  outputPath: string,
  payload: TranscriptSavePayload,
): Promise<void> {
  const body = {
    title: payload.title ?? "",
    subtitle: payload.subtitle ?? "",
    segments: payload.segments,
    highlights: payload.highlights ?? [],
  };
  await fs.writeFile(outputPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}
