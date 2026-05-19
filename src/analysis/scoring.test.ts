import { describe, expect, it } from "bun:test";
import { createSegment } from "../models.ts";
import {
  bigramCounts,
  bigramKey,
  compressionEntropy,
  expandWithContext,
  klDivergence,
  meanBigramSurprisal,
  prefilterCandidates,
  slidingWindows,
  tokenize,
  unigramCounts,
} from "./scoring.ts";

describe("tokenize", () => {
  it("splits latin on whitespace and lowercases", () => {
    expect(tokenize("Hello, world! FOO")).toEqual(["hello", "world", "foo"]);
  });

  it("treats each CJK char as its own token", () => {
    expect(tokenize("你好 world 世界")).toEqual(["你", "好", "world", "世", "界"]);
  });

  it("drops pure-punctuation tokens", () => {
    expect(tokenize("--- *** !!!")).toEqual([]);
  });
});

describe("unigramCounts / bigramCounts", () => {
  it("counts tokens", () => {
    const c = unigramCounts(["a", "b", "a", "c"]);
    expect(c.get("a")).toBe(2);
    expect(c.get("b")).toBe(1);
  });

  it("counts bigrams", () => {
    const c = bigramCounts(["a", "b", "a", "b"]);
    expect(c.get(bigramKey("a", "b"))).toBe(2);
    expect(c.get(bigramKey("b", "a"))).toBe(1);
  });
});

describe("compressionEntropy", () => {
  it("returns 0 for empty text", () => {
    expect(compressionEntropy("")).toBe(0);
  });

  it("scores a repetitive string lower than a random one", () => {
    const repetitive = "a".repeat(500);
    const varied = Array.from({ length: 500 }, (_, i) => String.fromCharCode(33 + (i * 37) % 90)).join("");
    expect(compressionEntropy(repetitive)).toBeLessThan(compressionEntropy(varied));
  });
});

describe("klDivergence", () => {
  it("is zero for identical distributions", () => {
    const p = unigramCounts(["a", "b", "c"]);
    expect(klDivergence(p, p)).toBeCloseTo(0, 6);
  });

  it("is positive when P diverges from Q", () => {
    const p = unigramCounts(["a", "a", "a", "a"]);
    const q = unigramCounts(["a", "b", "c", "d"]);
    expect(klDivergence(p, q)).toBeGreaterThan(0);
  });
});

describe("meanBigramSurprisal", () => {
  it("returns lower surprisal for tokens that follow frequent transitions", () => {
    const corpus = ["a", "b", "a", "b", "a", "b"];
    const uni = unigramCounts(corpus);
    const bi = bigramCounts(corpus);
    const expected = meanBigramSurprisal(["a", "b"], uni, bi);
    const rare = meanBigramSurprisal(["x", "y"], uni, bi);
    expect(expected).toBeLessThan(rare);
  });
});

describe("slidingWindows", () => {
  const segments = [
    createSegment(0, 5, "a"),
    createSegment(5, 10, "b"),
    createSegment(10, 15, "c"),
    createSegment(15, 20, "d"),
  ];

  it("covers the timeline with overlapping windows", () => {
    const w = slidingWindows(segments, 10, 5);
    expect(w[0]).toMatchObject({ start: 0, end: 10 });
    expect(w[0].segmentIds).toEqual([0, 1]);
    expect(w.length).toBeGreaterThan(1);
  });

  it("returns empty for empty input", () => {
    expect(slidingWindows([], 30, 10)).toEqual([]);
  });
});

describe("prefilterCandidates", () => {
  it("returns top-K candidates with valid time bounds", () => {
    const segments = Array.from({ length: 30 }, (_, i) =>
      createSegment(i * 5, (i + 1) * 5, i === 15 ? "extraordinary divergent unique phrase" : "filler filler"),
    );
    const cands = prefilterCandidates(segments, { topK: 3, windowSec: 30, stepSec: 10, minDurationSec: 30 });
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.length).toBeLessThanOrEqual(3);
    for (const c of cands) {
      expect(c.end).toBeGreaterThan(c.start);
      expect(c.segmentIds.length).toBeGreaterThan(0);
    }
    const standout = cands.find((c) => c.segmentIds.includes(15));
    expect(standout).toBeDefined();
  });

  it("returns [] for empty segments", () => {
    expect(prefilterCandidates([])).toEqual([]);
  });
});

describe("expandWithContext", () => {
  it("includes neighbors within ±contextSec of each candidate", () => {
    const segments = Array.from({ length: 10 }, (_, i) => createSegment(i * 10, (i + 1) * 10, `s${i}`));
    const cands = [
      { start: 40, end: 50, segmentIds: [4], score: 1, components: { entropy: 0, surprisal: 0, kl: 0 } },
    ];
    const expanded = expandWithContext(cands, segments, 15);
    const ids = expanded.map((e) => e.id);
    expect(ids).toContain(4);
    expect(ids).toContain(3);
    expect(ids).toContain(5);
    expect(ids).not.toContain(0);
  });
});
