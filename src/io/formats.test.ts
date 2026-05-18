import { describe, expect, it } from "bun:test";
import {
  DEFAULT_OUTPUT_FORMATS,
  normalizeOutputFormats,
  parseOutputFormats,
} from "./formats.ts";

describe("parseOutputFormats", () => {
  it("returns the default list when input is null", () => {
    expect(parseOutputFormats(null)).toEqual([...DEFAULT_OUTPUT_FORMATS]);
    expect(parseOutputFormats(undefined)).toEqual([...DEFAULT_OUTPUT_FORMATS]);
  });

  it("parses, normalizes case, and dedupes", () => {
    expect(parseOutputFormats("srt,Json,SRT")).toEqual(["srt", "json"]);
  });

  it("throws on empty list after splitting", () => {
    expect(() => parseOutputFormats("  ,  ")).toThrow(/empty/);
  });

  it("throws on unsupported format", () => {
    expect(() => parseOutputFormats("srt,exe")).toThrow(/unsupported format 'exe'/);
  });
});

describe("normalizeOutputFormats", () => {
  it("accepts arrays", () => {
    expect(normalizeOutputFormats(["srt", "ass"])).toEqual(["srt", "ass"]);
  });

  it("accepts comma-separated strings", () => {
    expect(normalizeOutputFormats("video,srt")).toEqual(["video", "srt"]);
  });

  it("falls back to defaults for null", () => {
    expect(normalizeOutputFormats(null)).toEqual([...DEFAULT_OUTPUT_FORMATS]);
  });
});
