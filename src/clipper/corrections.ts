import type { CorrectionPayload } from "../analysis/sanitize.ts";
import type { Segment } from "../models.ts";

export function applyCorrections(
  segments: readonly Segment[],
  corrections: readonly CorrectionPayload[],
): Segment[] {
  if (corrections.length === 0) return [...segments];
  const map = new Map<number, string>();
  for (const c of corrections) map.set(c.segment_id, c.corrected);
  return segments.map((seg, idx) => {
    const corrected = map.get(idx);
    return corrected !== undefined ? { ...seg, text: corrected } : seg;
  });
}
