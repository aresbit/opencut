import { describe, expect, it } from "bun:test";
import { createSegment } from "../models.ts";
import type { AnalysisClient } from "./client.ts";
import { correctWords } from "./corrections.ts";
import { extractHighlights } from "./highlights.ts";
import { extractKeywordsForSegments } from "./keywords.ts";

function fakeClient(response: string): AnalysisClient {
  return {
    model: "test-model",
    async chat() {
      return response;
    },
  };
}

function failingClient(): AnalysisClient {
  return {
    model: "test-model",
    async chat() {
      throw new Error("network down");
    },
  };
}

const segments = [createSegment(0, 1.5, "hello"), createSegment(1.5, 3, "world")];

describe("extractHighlights", () => {
  it("parses sanitized highlights from raw JSON", async () => {
    const payload = JSON.stringify({
      highlights: [{ start: 0, end: 5, title: "T", keywords: ["k"] }],
    });
    const result = await extractHighlights(fakeClient(payload), segments, "en", "zh-CN");
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("T");
    expect(result[0]?.keywords).toEqual(["k"]);
  });

  it("strips markdown fences before parsing", async () => {
    const payload = `\`\`\`json\n${JSON.stringify({
      highlights: [{ start: 0, end: 5 }],
    })}\n\`\`\``;
    const result = await extractHighlights(fakeClient(payload), segments, "en", "zh-CN");
    expect(result).toHaveLength(1);
  });

  it("returns [] on API failure", async () => {
    const result = await extractHighlights(failingClient(), segments, "en", "zh-CN");
    expect(result).toEqual([]);
  });

  it("returns [] when payload omits highlights", async () => {
    const result = await extractHighlights(fakeClient("{}"), segments, "en", "zh-CN");
    expect(result).toEqual([]);
  });
});

describe("extractKeywordsForSegments", () => {
  it("returns sanitized segment keyword entries", async () => {
    const payload = JSON.stringify({
      segment_keywords: [
        { segment_id: 0, keywords: ["hi"] },
        { segment_id: "bad", keywords: ["nope"] },
      ],
    });
    const result = await extractKeywordsForSegments(
      fakeClient(payload),
      segments,
      "en",
      "zh-CN",
    );
    expect(result).toEqual([{ segment_id: 0, keywords: ["hi"] }]);
  });

  it("returns [] on API failure", async () => {
    expect(await extractKeywordsForSegments(failingClient(), segments, "en", "zh-CN")).toEqual([]);
  });
});

describe("correctWords", () => {
  it("returns corrections from a valid response", async () => {
    const payload = JSON.stringify({
      corrections: [
        { segment_id: 0, corrected: "they're saying hello" },
        { segment_id: 1, corrected: "it's a great idea" },
      ],
    });
    const result = await correctWords(fakeClient(payload), segments, "en");
    expect(result).toHaveLength(2);
    expect(result[1]?.corrected).toBe("it's a great idea");
  });

  it("handles ```json fences in the response", async () => {
    const inner = JSON.stringify({ corrections: [{ segment_id: 0, corrected: "ok" }] });
    const payload = `\`\`\`json\n${inner}\n\`\`\``;
    const result = await correctWords(fakeClient(payload), segments, "en");
    expect(result).toEqual([{ segment_id: 0, corrected: "ok" }]);
  });

  it("returns [] when corrections list is empty", async () => {
    const result = await correctWords(
      fakeClient(JSON.stringify({ corrections: [] })),
      segments,
      "en",
    );
    expect(result).toEqual([]);
  });

  it("returns [] on API failure", async () => {
    expect(await correctWords(failingClient(), segments, "en")).toEqual([]);
  });
});
