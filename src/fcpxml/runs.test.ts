import { describe, expect, it } from "bun:test";
import { splitSourceTextRuns } from "./runs.ts";

describe("splitSourceTextRuns", () => {
  it("returns a single non-highlighted run when no keywords match", () => {
    expect(splitSourceTextRuns("hello world", [])).toEqual([
      { text: "hello world", highlighted: false },
    ]);
  });

  it("splits at keyword boundaries (case-insensitive)", () => {
    expect(splitSourceTextRuns("Hello World", ["world"])).toEqual([
      { text: "Hello ", highlighted: false },
      { text: "World", highlighted: true },
    ]);
  });

  it("prefers the longer keyword among overlaps", () => {
    const runs = splitSourceTextRuns("abcabcd", ["abc", "abcd"]);
    expect(runs).toContainEqual({ text: "abcd", highlighted: true });
  });

  it("escapes regex special characters", () => {
    const runs = splitSourceTextRuns(`foo.bar`, ["foo.bar"]);
    expect(runs).toEqual([{ text: "foo.bar", highlighted: true }]);
  });

  it("returns [] for empty input", () => {
    expect(splitSourceTextRuns("", ["x"])).toEqual([]);
  });
});
