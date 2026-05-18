import type { Segment } from "../models.ts";

export function splitTranscriptSegments(
  segments: readonly Segment[],
  maxDuration: number,
): Segment[][] {
  if (segments.length === 0) return [];

  const chunks: Segment[][] = [];
  let current: Segment[] = [];
  let chunkStart: number | null = null;

  for (const seg of segments) {
    if (current.length === 0) {
      current = [seg];
      chunkStart = seg.start;
      continue;
    }
    if (chunkStart !== null && seg.end - chunkStart <= maxDuration) {
      current.push(seg);
    } else {
      chunks.push(current);
      current = [seg];
      chunkStart = seg.start;
    }
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function resolveOverlaps(
  segments: readonly Segment[],
  marginLeft = 0,
  marginRight = 0,
): Segment[] {
  if (segments.length === 0) return [];

  const shifted: Segment[] = segments.map((seg) => ({
    ...seg,
    start: Math.max(0, seg.start + marginLeft),
    end: Math.max(0, seg.end + marginRight),
  }));

  const resolved: Segment[] = [];
  for (let i = 0; i < shifted.length; i++) {
    const seg = shifted[i];
    if (!seg) continue;
    let { start, end } = seg;
    const prev = resolved[resolved.length - 1];
    if (prev && start < prev.end) {
      const mid = (prev.end + start) / 2;
      resolved[resolved.length - 1] = { ...prev, end: mid };
      start = mid;
    }
    const next = shifted[i + 1];
    if (next && end > next.start) {
      end = (end + next.start) / 2;
    }
    resolved.push({ ...seg, start, end });
  }
  return resolved;
}

export function filterSubtitleSegments(
  segments: readonly Segment[],
  filterEmptySegments = true,
): Segment[] {
  const filtered = filterEmptySegments
    ? segments.filter((s) => (s.text ?? "").trim().length > 0)
    : [...segments];
  return resolveOverlaps(filtered);
}
