import { describe, expect, it } from "bun:test";
import type { AnalysisClient } from "../analysis/client.ts";
import { createHighlight, createSegment } from "../models.ts";
import { analyzeContent, clampHighlightsToChunk } from "./highlights.ts";

function fakeClient(response: string): AnalysisClient {
  return {
    model: "test",
    async chat() {
      return response;
    },
  };
}

const segments = [createSegment(0, 1.5, "hi"), createSegment(1.5, 3, "world")];

describe("analyzeContent", () => {
  it("returns empty title and empty highlights when client is null", async () => {
    const out = await analyzeContent(null, segments, "en", "zh");
    expect(out.titleInfo).toEqual({ title: "", subtitle: "" });
    expect(out.highlights).toEqual([]);
  });

  it("uses the first highlight's title and subtitle", async () => {
    const payload = JSON.stringify({
      highlights: [{ start: 0, end: 2, title: "T", subtitle: "S" }],
    });
    const out = await analyzeContent(fakeClient(payload), segments, "en", "zh");
    expect(out.titleInfo).toEqual({ title: "T", subtitle: "S" });
    expect(out.highlights).toHaveLength(1);
  });

  it("falls back to default title when LLM produces no highlights", async () => {
    const out = await analyzeContent(fakeClient("{}"), segments, "en", "zh");
    expect(out.titleInfo.title).toBe("视频精华");
  });
});

describe("clampHighlightsToChunk", () => {
  const highlights = [
    createHighlight({ start: 0, end: 5 }),
    createHighlight({ start: 4, end: 10 }),
  ];

  it("trims highlights to fit inside the chunk window", () => {
    const out = clampHighlightsToChunk(highlights, 2, 6);
    expect(out).toHaveLength(2);
    expect(out[0]?.start).toBe(2);
    expect(out[0]?.end).toBe(5);
    expect(out[1]?.start).toBe(4);
    expect(out[1]?.end).toBe(6);
  });

  it("drops highlights that fall fully outside the chunk window", () => {
    const out = clampHighlightsToChunk(highlights, 20, 30);
    expect(out).toEqual([]);
  });
});
