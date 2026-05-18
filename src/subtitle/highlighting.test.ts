import { describe, expect, it } from "bun:test";
import { applyKeywordHighlighting } from "./highlighting.ts";

describe("applyKeywordHighlighting", () => {
  it("returns text unchanged when keywords are empty", () => {
    expect(applyKeywordHighlighting("hello world", [])).toBe("hello world");
  });

  it("wraps each keyword with ASS color and scale tags", () => {
    const out = applyKeywordHighlighting("hello world", ["world"], "#FFFF00");
    expect(out).toBe("hello {\\c&H0000FFFF&\\fscx110\\fscy110}world{\\r}");
  });

  it("matches case-insensitively", () => {
    const out = applyKeywordHighlighting("Hello World", ["hello"], "#FFFF00");
    expect(out).toContain("{\\c&H0000FFFF&\\fscx110\\fscy110}Hello{\\r}");
  });

  it("prefers the longer keyword when overlapping", () => {
    const out = applyKeywordHighlighting("abcabcd", ["abc", "abcd"], "#FFFF00");
    expect(out).toContain("abcd");
    expect((out.match(/abcd/g) ?? [])).toHaveLength(1);
  });

  it("escapes regex special characters in keywords", () => {
    const out = applyKeywordHighlighting("foo.bar baz", ["foo.bar"], "#FFFF00");
    expect(out).toBe("{\\c&H0000FFFF&\\fscx110\\fscy110}foo.bar{\\r} baz");
  });

  it("returns text unchanged when all keywords are empty strings", () => {
    expect(applyKeywordHighlighting("hello", ["", ""], "#FFFF00")).toBe("hello");
  });
});
