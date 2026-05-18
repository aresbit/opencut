import { describe, expect, it } from "bun:test";
import { createSegment } from "../models.ts";
import { extractTranscriptionForRange } from "./transcription.ts";

const segments = [
  createSegment(0, 1, "alpha"),
  createSegment(1, 2, "beta"),
  createSegment(2, 3, "gamma"),
  createSegment(3, 4, "delta"),
];

describe("extractTranscriptionForRange", () => {
  it("picks segments that overlap the range", () => {
    expect(extractTranscriptionForRange(segments, 1, 3)).toBe("beta gamma");
  });

  it("includes partially overlapping segments at boundaries", () => {
    expect(extractTranscriptionForRange(segments, 0.5, 2.5)).toBe("alpha beta gamma");
  });

  it("returns an empty string when the range falls outside", () => {
    expect(extractTranscriptionForRange(segments, 10, 20)).toBe("");
  });
});
