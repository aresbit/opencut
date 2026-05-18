import { describe, expect, it } from "bun:test";
import { attachPunctuationToWords, splitVadSegmentByPunctuation } from "./segments.ts";

describe("attachPunctuationToWords", () => {
  it("captures trailing punctuation from the source text", () => {
    const items = [
      { text: "Hello", start_time: 0, end_time: 0.5 },
      { text: "world", start_time: 0.5, end_time: 1.0 },
    ];
    const words = attachPunctuationToWords(items, "Hello, world.");
    expect(words).toHaveLength(2);
    expect(words[0]?.word).toBe("Hello");
    expect(words[0]?.punctuation).toBe(",");
    expect(words[1]?.word).toBe("world");
    expect(words[1]?.punctuation).toBe(".");
  });

  it("matches case-insensitively and skips blank tokens", () => {
    const items = [
      { text: "HELLO", start_time: 0, end_time: 0.5 },
      { text: "  ", start_time: 0.5, end_time: 0.6 },
      { text: "world", start_time: 0.6, end_time: 1.0 },
    ];
    const words = attachPunctuationToWords(items, "hello world!");
    expect(words.map((w) => w.word)).toEqual(["HELLO", "world"]);
    expect(words[1]?.punctuation).toBe("!");
  });

  it("returns empty punctuation when text is omitted", () => {
    const items = [{ text: "hi", start_time: 0, end_time: 0.5 }];
    const words = attachPunctuationToWords(items);
    expect(words[0]?.punctuation).toBe("");
  });
});

describe("splitVadSegmentByPunctuation", () => {
  it("splits buckets at punctuation marks and clamps timings", () => {
    const words = [
      { word: "hello", start: 0, end: 0.4, punctuation: "," },
      { word: "world", start: 0.5, end: 1.0, punctuation: "." },
      { word: "again", start: 1.1, end: 1.5, punctuation: "" },
    ];
    const segs = splitVadSegmentByPunctuation(words, 0, 2);
    expect(segs).toHaveLength(3);
    expect(segs[0]?.text).toBe("hello");
    expect(segs[1]?.text).toBe("world");
    expect(segs[2]?.text).toBe("again");
    expect(segs[0]?.start).toBe(0);
    expect(segs[2]?.end).toBe(1.5);
  });

  it("respects outer segment bounds", () => {
    const words = [
      { word: "long", start: -0.5, end: 0.4, punctuation: "" },
      { word: "tail", start: 0.4, end: 3.0, punctuation: "" },
    ];
    const segs = splitVadSegmentByPunctuation(words, 0, 2);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.start).toBe(0);
    expect(segs[0]?.end).toBe(2);
    expect(segs[0]?.words[0]?.start).toBe(0);
    expect(segs[0]?.words[1]?.end).toBe(2);
  });

  it("invokes the custom splitter for oversized buckets when maxChars > 0", () => {
    const words = [
      { word: "alpha", start: 0, end: 0.2, punctuation: "" },
      { word: "beta", start: 0.2, end: 0.4, punctuation: "" },
      { word: "gamma", start: 0.4, end: 0.6, punctuation: "" },
    ];
    const segs = splitVadSegmentByPunctuation(words, 0, 1, 3, (b, ss, se) => [
      { start: ss, end: se, text: b.map((w) => w.word).join("|"), words: b },
    ]);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.text).toBe("alpha|beta|gamma");
  });

  it("returns empty for empty word list", () => {
    expect(splitVadSegmentByPunctuation([], 0, 1)).toEqual([]);
  });
});
