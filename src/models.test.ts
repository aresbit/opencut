import { describe, expect, it } from "bun:test";
import { createHighlight, createSegment, highlightSchema, segmentSchema } from "./models.ts";

describe("segment schema", () => {
  it("round-trips a populated segment", () => {
    const seg = createSegment(0, 1.5, "hello", [
      { word: "hello", start: 0, end: 1.5, punctuation: "" },
    ]);
    const parsed = segmentSchema.parse(seg);
    expect(parsed).toEqual(seg);
  });

  it("defaults words to an empty array", () => {
    const parsed = segmentSchema.parse({ start: 0, end: 1, text: "hi" });
    expect(parsed.words).toEqual([]);
  });
});

describe("highlight schema", () => {
  it("fills missing string and array fields with defaults", () => {
    const h = createHighlight({ start: 0, end: 5 });
    expect(h.title).toBe("");
    expect(h.keywords).toEqual([]);
    expect(h.segment_keywords).toEqual([]);
    expect(highlightSchema.parse(h)).toEqual(h);
  });

  it("preserves passthrough fields inside segment_keywords", () => {
    const parsed = highlightSchema.parse({
      start: 0,
      end: 5,
      segment_keywords: [{ segment_id: 1, keywords: ["foo"], extra: "kept" }],
    });
    expect(parsed.segment_keywords[0]).toMatchObject({
      segment_id: 1,
      keywords: ["foo"],
      extra: "kept",
    });
  });
});
