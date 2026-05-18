import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHighlight, createSegment } from "../models.ts";
import { buildSegmentKeywordMap, generateFcpxml } from "./generator.ts";

let dir = "";
let output = "";
let videoPath = "";

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "pycut-fcp-"));
  output = path.join(dir, "out.fcpxml");
  videoPath = path.join(dir, "demo_video.mp4");
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const fixedNow = () => new Date(2026, 4, 19);

describe("generateFcpxml file metadata", () => {
  it("uses the video stem for project name and a YYYY-MM-DD event name", async () => {
    await generateFcpxml({
      videoPath,
      highlights: [],
      segments: [createSegment(0, 1, "hello"), createSegment(1, 2, "world")],
      outputPath: output,
      enableClip: false,
      now: fixedNow,
    });
    const content = await fs.readFile(output, "utf8");
    expect(content).toContain('<project name="demo_video">');
    expect(content).toMatch(/<event name="2026-05-19">/);
  });
});

describe("generateFcpxml keyword highlighting", () => {
  it("highlights only the keyword runs in full-video mode", async () => {
    await generateFcpxml({
      videoPath,
      highlights: [
        createHighlight({
          start: 0,
          end: 2,
          title: "hello",
          segment_keywords: [{ segment_id: 0, keywords: ["world"] }],
        }),
      ],
      segments: [createSegment(0, 2, "hello world")],
      outputPath: output,
      enableClip: false,
      now: fixedNow,
    });
    const content = await fs.readFile(output, "utf8");
    expect(content).toContain('<text-style ref="ts1">hello </text-style>');
    expect(content).toContain('<text-style ref="ts1_h">world</text-style>');
    expect(content).toContain('id="ts1_h"');
  });

  it("highlights only the keyword runs in clip mode", async () => {
    await generateFcpxml({
      videoPath,
      highlights: [
        createHighlight({
          start: 0,
          end: 2,
          title: "hello",
          segment_keywords: [{ segment_id: 0, keywords: ["world"] }],
        }),
      ],
      segments: [createSegment(0, 2, "hello world")],
      outputPath: output,
      enableClip: true,
      now: fixedNow,
    });
    const content = await fs.readFile(output, "utf8");
    expect(content).toContain('<text-style ref="ts1_h">world</text-style>');
    expect(content).not.toContain('<text-style ref="ts1">hello world</text-style>');
  });

  it("preserves segment ids after empty segments are filtered out", async () => {
    await generateFcpxml({
      videoPath,
      highlights: [
        createHighlight({
          start: 1,
          end: 3,
          title: "hello",
          segment_keywords: [{ segment_id: 1, keywords: ["world"] }],
        }),
      ],
      segments: [createSegment(0, 1, ""), createSegment(1, 3, "hello world")],
      outputPath: output,
      enableClip: false,
      now: fixedNow,
    });
    const content = await fs.readFile(output, "utf8");
    expect(content).toContain('<text-style ref="ts1_h">world</text-style>');
  });
});

describe("generateFcpxml XML escaping", () => {
  it("escapes XML special characters in clip name, title name, and text", async () => {
    const sourceText = `Say "hi" & <world> > friends`;
    const translationText = `译文 "1 < 2" & friends`;
    await generateFcpxml({
      videoPath: path.join(dir, 'demo "quoted" & clip.mp4'),
      highlights: [
        createHighlight({
          start: 0,
          end: 2,
          title: sourceText,
          subtitle: translationText,
          segment_keywords: [{ segment_id: 0, keywords: [`"hi" & <world>`] }],
        }),
      ],
      segments: [createSegment(0, 2, sourceText)],
      outputPath: output,
      enableClip: true,
      translate: true,
      translateFn: async (texts) => texts.map(() => translationText),
      now: fixedNow,
    });

    const content = await fs.readFile(output, "utf8");
    expect(content).toContain(
      'name="Say &quot;hi&quot; &amp; &lt;world&gt; &gt; friends"',
    );
    expect(content).toContain(
      '<text-style ref="ts1_h">"hi" &amp; &lt;world&gt;</text-style>',
    );
    expect(content).toContain('译文 "1 &lt; 2" &amp; friends');
  });
});

describe("generateFcpxml color overrides", () => {
  it("emits configured original/translation/highlight font colors", async () => {
    await generateFcpxml({
      videoPath,
      highlights: [
        createHighlight({
          start: 0,
          end: 2,
          title: "hello",
          segment_keywords: [{ segment_id: 0, keywords: ["world"] }],
        }),
      ],
      segments: [createSegment(0, 2, "hello world")],
      outputPath: output,
      enableClip: false,
      translate: true,
      translateFn: async (texts) => texts.map((t) => `tr:${t}`),
      originalSubtitleColor: "#123456",
      translationSubtitleColor: "#ABCDEF",
      highlightSubtitleColor: "#FEDCBA",
      now: fixedNow,
    });
    const content = await fs.readFile(output, "utf8");
    expect(content).toContain('fontColor="0.0706 0.2039 0.3373 1"');
    expect(content).toContain('fontColor="0.9961 0.8627 0.7294 1"');
    expect(content).toContain('fontColor="0.6706 0.8039 0.9373 1"');
  });
});

describe("buildSegmentKeywordMap", () => {
  it("aggregates keywords by segment_id and skips empties", () => {
    const map = buildSegmentKeywordMap([
      createHighlight({
        start: 0,
        end: 1,
        segment_keywords: [
          { segment_id: 0, keywords: ["a"] },
          { segment_id: 1, keywords: [] },
        ],
      }),
      createHighlight({
        start: 1,
        end: 2,
        segment_keywords: [{ segment_id: 0, keywords: ["b"] }],
      }),
    ]);
    expect(map.get(0)).toEqual(["a", "b"]);
    expect(map.has(1)).toBe(false);
  });
});
