import { describe, expect, it } from "bun:test";
import { createSegment } from "../models.ts";
import {
  buildCorrectionsPrompt,
  buildHighlightsPrompt,
  buildSegmentKeywordsPrompt,
  buildTranscription,
} from "./prompts.ts";

const segments = [createSegment(0, 1.5, "hello"), createSegment(1.5, 3, "world")];

describe("buildTranscription", () => {
  it("formats each line with timestamp, ID, and text", () => {
    expect(buildTranscription(segments)).toBe(
      "[0.00s-1.50s] ID:0 hello\n[1.50s-3.00s] ID:1 world",
    );
  });
});

describe("buildHighlightsPrompt", () => {
  it("embeds the target language and transcription", () => {
    const prompt = buildHighlightsPrompt(segments, "en");
    expect(prompt).toContain("目标语言为en");
    expect(prompt).toContain("[0.00s-1.50s] ID:0 hello");
    expect(prompt).toContain('"highlights"');
    expect(prompt).toContain("只返回JSON，不要包含其他文字");
  });
});

describe("buildSegmentKeywordsPrompt", () => {
  it("uses the lighter keyword-only template", () => {
    const prompt = buildSegmentKeywordsPrompt(segments, "zh-CN");
    expect(prompt).toContain("目标语言为zh-CN");
    expect(prompt).toContain('"segment_keywords"');
    expect(prompt).not.toContain('"highlights"');
  });
});

describe("buildCorrectionsPrompt", () => {
  it("embeds the source language and correction shape", () => {
    const prompt = buildCorrectionsPrompt(segments, "en");
    expect(prompt).toContain("原始语言：en");
    expect(prompt).toContain('"corrections"');
    expect(prompt).toContain('如果没有需要修正的内容，返回 {"corrections": []}');
  });
});
