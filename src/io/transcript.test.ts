import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadSegmentsFromTranscriptJson, saveTranscriptJson } from "./transcript.ts";

let dir = "";
let file = "";

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "pycut-tr-"));
  file = path.join(dir, "tr.json");
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("loadSegmentsFromTranscriptJson", () => {
  it("loads the legacy list format with empty metadata", async () => {
    await fs.writeFile(
      file,
      JSON.stringify([
        { start: 0, end: 1, text: "hi", words: [{ word: "hi", start: 0, end: 1 }] },
      ]),
    );
    const { segments, meta } = await loadSegmentsFromTranscriptJson(file);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.words[0]?.punctuation).toBe("");
    expect(meta).toEqual({ title: "", subtitle: "", highlights: [] });
  });

  it("loads the object format with title, subtitle, highlights", async () => {
    await fs.writeFile(
      file,
      JSON.stringify({
        title: "T",
        subtitle: "S",
        segments: [{ start: 0, end: 2, text: "hello" }],
        highlights: [
          { start: 0, end: 1, title: "h", keywords: ["k"], segment_keywords: [{ segment_id: 0 }] },
        ],
      }),
    );
    const { segments, meta } = await loadSegmentsFromTranscriptJson(file);
    expect(segments).toHaveLength(1);
    expect(meta.title).toBe("T");
    expect(meta.subtitle).toBe("S");
    expect(meta.highlights).toHaveLength(1);
    expect(meta.highlights[0]?.keywords).toEqual(["k"]);
  });

  it("skips malformed segment entries", async () => {
    await fs.writeFile(
      file,
      JSON.stringify([
        "not an object",
        { text: "missing start" },
        { start: "nope", end: 1, text: "bad numeric" },
        { start: 1, end: 2, text: "ok" },
      ]),
    );
    const { segments } = await loadSegmentsFromTranscriptJson(file);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.text).toBe("ok");
  });

  it("returns empty result for an unexpected root type", async () => {
    await fs.writeFile(file, JSON.stringify(42));
    const { segments, meta } = await loadSegmentsFromTranscriptJson(file);
    expect(segments).toEqual([]);
    expect(meta).toEqual({ title: "", subtitle: "", highlights: [] });
  });
});

describe("saveTranscriptJson", () => {
  it("writes a pretty-printed payload and round-trips it", async () => {
    await saveTranscriptJson(file, {
      title: "T",
      subtitle: "S",
      segments: [{ start: 0, end: 1, text: "hi", words: [] }],
      highlights: [],
    });
    const raw = await fs.readFile(file, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    const { segments, meta } = await loadSegmentsFromTranscriptJson(file);
    expect(meta.title).toBe("T");
    expect(segments).toHaveLength(1);
  });
});
