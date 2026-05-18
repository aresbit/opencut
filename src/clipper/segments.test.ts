import { describe, expect, it } from "bun:test";
import { createSegment } from "../models.ts";
import {
  filterSubtitleSegments,
  resolveOverlaps,
  splitTranscriptSegments,
} from "./segments.ts";

describe("splitTranscriptSegments", () => {
  it("returns [] for empty input", () => {
    expect(splitTranscriptSegments([], 5)).toEqual([]);
  });

  it("packs consecutive segments until the duration cap", () => {
    const chunks = splitTranscriptSegments(
      [
        createSegment(0, 2, "a"),
        createSegment(2, 4, "b"),
        createSegment(4, 7, "c"),
      ],
      5,
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.map((s) => s.text)).toEqual(["a", "b"]);
    expect(chunks[1]?.map((s) => s.text)).toEqual(["c"]);
  });

  it("emits each segment as its own chunk when each already exceeds the cap", () => {
    const chunks = splitTranscriptSegments(
      [createSegment(0, 10, "a"), createSegment(10, 20, "b")],
      5,
    );
    expect(chunks).toHaveLength(2);
  });
});

describe("resolveOverlaps", () => {
  it("applies left/right margins clamped to 0", () => {
    const out = resolveOverlaps([createSegment(0.05, 1, "a")], -0.1, 0.2);
    expect(out[0]?.start).toBe(0);
    expect(out[0]?.end).toBeCloseTo(1.2, 5);
  });

  it("splits overlapping adjacent segments at the midpoint", () => {
    // Two passes: pass 1 (forward) clamps seg0.end to mid of (1.2, 1.0) = 1.1;
    // pass 2 (per-segment) sees seg1.start=1.0 < seg0.end=1.1 and clamps to
    // mid of (1.1, 1.0) = 1.05.
    const out = resolveOverlaps([
      createSegment(0, 1.2, "a"),
      createSegment(1.0, 2, "b"),
    ]);
    expect(out[0]?.end).toBeCloseTo(1.05, 5);
    expect(out[1]?.start).toBeCloseTo(1.05, 5);
  });

  it("returns [] for empty input", () => {
    expect(resolveOverlaps([])).toEqual([]);
  });
});

describe("filterSubtitleSegments", () => {
  const segments = [
    createSegment(0, 1, "alpha"),
    createSegment(1, 2, ""),
    createSegment(2, 3, "beta"),
  ];

  it("drops empty segments by default", () => {
    const out = filterSubtitleSegments(segments);
    expect(out.map((s) => s.text)).toEqual(["alpha", "beta"]);
  });

  it("keeps empty segments when filterEmptySegments is false", () => {
    const out = filterSubtitleSegments(segments, false);
    expect(out).toHaveLength(3);
  });
});
