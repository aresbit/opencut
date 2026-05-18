function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeKeywordList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (item == null) continue;
    if (typeof item === "string") {
      out.push(item);
      continue;
    }
    if (typeof item === "number" && Number.isFinite(item)) {
      out.push(String(item));
    }
  }
  return out;
}

export interface SegmentKeywordEntry {
  segment_id: number;
  keywords: string[];
}

export function sanitizeSegmentKeywords(value: unknown): SegmentKeywordEntry[] {
  if (!Array.isArray(value)) return [];
  const out: SegmentKeywordEntry[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = item.segment_id;
    if (typeof id !== "number" || !Number.isInteger(id)) continue;
    out.push({
      segment_id: id,
      keywords: sanitizeKeywordList(item.keywords ?? []),
    });
  }
  return out;
}

export function sanitizeTextField(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

export interface HighlightPayload {
  start: number;
  end: number;
  title: string;
  subtitle: string;
  content: string;
  keywords: string[];
  segment_keywords: SegmentKeywordEntry[];
}

export function sanitizeHighlights(value: unknown): HighlightPayload[] {
  if (!Array.isArray(value)) return [];
  const out: HighlightPayload[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (!("start" in item) || !("end" in item)) continue;
    const start = Number(item.start);
    const end = Number(item.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    out.push({
      start,
      end,
      title: sanitizeTextField(item.title ?? ""),
      subtitle: sanitizeTextField(item.subtitle ?? ""),
      content: sanitizeTextField(item.content ?? ""),
      keywords: sanitizeKeywordList(item.keywords ?? []),
      segment_keywords: sanitizeSegmentKeywords(item.segment_keywords ?? []),
    });
  }
  return out;
}

export interface CorrectionPayload {
  segment_id: number;
  corrected: string;
}

export function sanitizeCorrections(value: unknown): CorrectionPayload[] {
  if (!Array.isArray(value)) return [];
  const out: CorrectionPayload[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = item.segment_id;
    if (typeof id !== "number" || !Number.isInteger(id)) continue;
    const corrected = item.corrected;
    if (corrected == null) continue;
    out.push({ segment_id: id, corrected: String(corrected) });
  }
  return out;
}
