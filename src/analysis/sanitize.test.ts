import { describe, expect, it } from "bun:test";
import {
  sanitizeCorrections,
  sanitizeHighlights,
  sanitizeKeywordList,
  sanitizeSegmentKeywords,
  sanitizeTextField,
} from "./sanitize.ts";

describe("sanitizeKeywordList", () => {
  it("keeps strings and finite numbers, drops everything else", () => {
    expect(sanitizeKeywordList(["a", 1, 2.5, null, undefined, false, {}, []])).toEqual([
      "a",
      "1",
      "2.5",
    ]);
  });
  it("returns empty for non-array", () => {
    expect(sanitizeKeywordList("nope")).toEqual([]);
    expect(sanitizeKeywordList(null)).toEqual([]);
  });
});

describe("sanitizeSegmentKeywords", () => {
  it("requires integer segment_id and coerces keywords", () => {
    const out = sanitizeSegmentKeywords([
      { segment_id: 0, keywords: ["a", 1] },
      { segment_id: 1.5, keywords: ["skip"] },
      { segment_id: "1", keywords: ["skip"] },
      { keywords: ["no-id"] },
      "garbage",
    ]);
    expect(out).toEqual([{ segment_id: 0, keywords: ["a", "1"] }]);
  });
});

describe("sanitizeTextField", () => {
  it("turns null/undefined into empty string and stringifies other values", () => {
    expect(sanitizeTextField(null)).toBe("");
    expect(sanitizeTextField(undefined)).toBe("");
    expect(sanitizeTextField("hi")).toBe("hi");
    expect(sanitizeTextField(42)).toBe("42");
  });
});

describe("sanitizeHighlights", () => {
  it("keeps well-formed entries with safe defaults", () => {
    const out = sanitizeHighlights([
      { start: 0, end: 10 },
      { start: "5", end: "12.5", title: "t", keywords: ["a"], segment_keywords: [
        { segment_id: 0, keywords: ["b"] },
      ] },
      { start: "bad", end: 1 },
      { end: 5 },
      "garbage",
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      start: 0,
      end: 10,
      title: "",
      subtitle: "",
      content: "",
      keywords: [],
      segment_keywords: [],
    });
    expect(out[1]).toEqual({
      start: 5,
      end: 12.5,
      title: "t",
      subtitle: "",
      content: "",
      keywords: ["a"],
      segment_keywords: [{ segment_id: 0, keywords: ["b"] }],
    });
  });

  it("returns empty when input is not an array", () => {
    expect(sanitizeHighlights({})).toEqual([]);
  });
});

describe("sanitizeCorrections", () => {
  it("requires integer segment_id and a non-null corrected value", () => {
    expect(sanitizeCorrections([])).toEqual([]);
    expect(
      sanitizeCorrections([{ segment_id: 0, corrected: "fixed" }]),
    ).toEqual([{ segment_id: 0, corrected: "fixed" }]);
    expect(sanitizeCorrections([{ segment_id: "zero", corrected: "x" }])).toEqual([]);
    expect(sanitizeCorrections([{ segment_id: 0 }])).toEqual([]);
    expect(sanitizeCorrections(["junk", null, 42])).toEqual([]);
    expect(sanitizeCorrections([{ segment_id: 1, corrected: 123 }])).toEqual([
      { segment_id: 1, corrected: "123" },
    ]);
  });
});
