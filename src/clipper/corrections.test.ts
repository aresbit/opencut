import { describe, expect, it } from "bun:test";
import { createSegment } from "../models.ts";
import { applyCorrections } from "./corrections.ts";

const segments = [
  createSegment(0, 1, "their saying hi"),
  createSegment(1, 2, "untouched"),
  createSegment(2, 3, "its great"),
];

describe("applyCorrections", () => {
  it("returns a shallow copy when there are no corrections", () => {
    const out = applyCorrections(segments, []);
    expect(out).toEqual([...segments]);
    expect(out).not.toBe(segments);
  });

  it("replaces text by segment_id and leaves others untouched", () => {
    const out = applyCorrections(segments, [
      { segment_id: 0, corrected: "they're saying hi" },
      { segment_id: 2, corrected: "it's great" },
    ]);
    expect(out[0]?.text).toBe("they're saying hi");
    expect(out[1]?.text).toBe("untouched");
    expect(out[2]?.text).toBe("it's great");
  });

  it("ignores corrections for out-of-range segment ids", () => {
    const out = applyCorrections(segments, [{ segment_id: 99, corrected: "n/a" }]);
    expect(out.map((s) => s.text)).toEqual(segments.map((s) => s.text));
  });
});
