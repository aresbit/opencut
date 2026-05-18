import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHighlight, createSegment } from "../models.ts";
import { generateAssSubtitle } from "./ass.ts";

let dir = "";
let file = "";

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "pycut-ass-"));
  file = path.join(dir, "out.ass");
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const segments = [
  createSegment(0, 2, "hello world"),
  createSegment(2, 4, "another line"),
];

const highlights = [
  createHighlight({
    start: 0,
    end: 4,
    title: "T",
    subtitle: "S",
    segment_keywords: [{ segment_id: 0, keywords: ["world"] }],
  }),
];

describe("generateAssSubtitle", () => {
  it("writes a landscape ASS file with Title, Subtitle, and Original events", async () => {
    await generateAssSubtitle({
      highlights,
      segments,
      outputPath: file,
      firstSubtitleDelay: 0,
    });
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("PlayResX: 1920");
    expect(text).toContain("PlayResY: 1080");
    expect(text).toContain("Dialogue: 0,00:00.00,0:00:04.00,Title,,0,0,0,,T");
    expect(text).toContain("Dialogue: 0,00:00.00,0:00:04.00,Subtitle,,0,0,0,,S");
    expect(text).toContain(",OriginalTop,,0,0,0,,hello ");
    expect(text).toContain("world{\\r}");
  });

  it("switches to portrait header when orientation is portrait", async () => {
    await generateAssSubtitle({
      highlights,
      segments,
      outputPath: file,
      orientation: "portrait",
      firstSubtitleDelay: 0,
    });
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("PlayResX: 1080");
    expect(text).toContain("PlayResY: 1920");
  });

  it("emits two Dialogue lines per segment in bilingual mode", async () => {
    const plainHighlight = [createHighlight({ start: 0, end: 4, title: "T", subtitle: "S" })];
    await generateAssSubtitle({
      highlights: plainHighlight,
      segments,
      outputPath: file,
      translate: true,
      translateFn: async (texts) => texts.map((t) => `${t}-fr`),
      firstSubtitleDelay: 0,
    });
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("OriginalTop");
    expect(text).toContain("TranslationBottom");
    expect(text).toContain("hello world-fr");
  });

  it("flips ordering when subtitlePosition is translated-top", async () => {
    await generateAssSubtitle({
      highlights,
      segments,
      outputPath: file,
      translate: true,
      subtitlePosition: "translated-top",
      translateFn: async (texts) => texts.map((t) => `${t}-fr`),
      firstSubtitleDelay: 0,
    });
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("TranslationTop");
    expect(text).toContain("OriginalBottom");
  });

  it("delays the first subtitle by firstSubtitleDelay seconds", async () => {
    await generateAssSubtitle({
      highlights,
      segments,
      outputPath: file,
      firstSubtitleDelay: 1,
    });
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("0:00:01.00,0:00:02.00,OriginalTop");
  });

  it("falls back to originals when translation count mismatches", async () => {
    const plainHighlight = [createHighlight({ start: 0, end: 4, title: "T", subtitle: "S" })];
    await generateAssSubtitle({
      highlights: plainHighlight,
      segments,
      outputPath: file,
      translate: true,
      translateFn: async () => ["only-one"],
      firstSubtitleDelay: 0,
    });
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("hello world");
    expect(text).toContain("another line");
    expect(text).not.toContain("only-one");
  });
});
