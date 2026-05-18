import type { Segment } from "../models.ts";

export function extractTranscriptionForRange(
  segments: readonly Segment[],
  startTime: number,
  endTime: number,
): string {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg.end > startTime && seg.start < endTime) {
      out.push(seg.text);
    }
  }
  return out.join(" ");
}
