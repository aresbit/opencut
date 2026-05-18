import { describe, expect, it } from "bun:test";
import { segmentsToSrt } from "./srt.ts";

describe("segmentsToSrt", () => {
  it("formats consecutive entries with 1-based indexes", () => {
    const out = segmentsToSrt([
      { start: 0, end: 1, text: "hello" },
      { start: 1, end: 2, text: "world" },
    ]);
    expect(out).toBe(
      [
        "1",
        "00:00:00,000 --> 00:00:01,000",
        "hello",
        "",
        "2",
        "00:00:01,000 --> 00:00:02,000",
        "world",
        "",
      ].join("\n").trim() + "\n",
    );
  });

  it("applies margins and clamps overlaps to previous end", () => {
    const out = segmentsToSrt(
      [
        { start: 0, end: 1, text: "a" },
        { start: 0.5, end: 1.5, text: "b" },
      ],
      0,
      0.5,
    );
    expect(out).toContain("00:00:00,000 --> 00:00:01,500");
    expect(out).toContain("00:00:01,500 --> 00:00:02,000");
  });

  it("returns just a newline for empty entries", () => {
    expect(segmentsToSrt([])).toBe("\n");
  });
});
