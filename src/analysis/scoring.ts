import { deflateRawSync } from "node:zlib";
import type { Segment } from "../models.ts";

export interface ScoringWeights {
  entropy: number;
  surprisal: number;
  kl: number;
}

export interface ScoringOptions {
  windowSec?: number;
  stepSec?: number;
  topK?: number;
  contextSec?: number;
  minDurationSec?: number;
  maxDurationSec?: number;
  weights?: ScoringWeights;
}

export interface CandidateWindow {
  start: number;
  end: number;
  segmentIds: number[];
  score: number;
  components: { entropy: number; surprisal: number; kl: number };
}

export const DEFAULT_OPTIONS: Required<Omit<ScoringOptions, "weights">> & { weights: ScoringWeights } = {
  windowSec: 30,
  stepSec: 10,
  topK: 5,
  contextSec: 15,
  minDurationSec: 30,
  maxDurationSec: 120,
  weights: { entropy: 1, surprisal: 1, kl: 1 },
};

const CJK_RE = /[一-鿿぀-ヿ가-힯]/;
const STRIP_RE = /[^\p{L}\p{N}一-鿿]+/gu;
const KEEP_RE = /[\p{L}\p{N}一-鿿]/u;
const BIGRAM_SEP = "";
export const bigramKey = (a: string, b: string): string => `${a}${BIGRAM_SEP}${b}`;

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let latin = "";
  const flush = () => {
    if (!latin) return;
    for (const t of latin.toLowerCase().split(/\s+/)) {
      const stripped = t.replace(STRIP_RE, "");
      if (stripped && KEEP_RE.test(stripped)) tokens.push(stripped);
    }
    latin = "";
  };
  for (const ch of text) {
    if (CJK_RE.test(ch)) {
      flush();
      tokens.push(ch);
    } else {
      latin += ch;
    }
  }
  flush();
  return tokens;
}

export function unigramCounts(tokens: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

export function bigramCounts(tokens: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 1; i < tokens.length; i++) {
    const key = `${tokens[i - 1]}${BIGRAM_SEP}${tokens[i]}`;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

export function compressionEntropy(text: string): number {
  if (!text) return 0;
  const buf = Buffer.from(text, "utf8");
  if (buf.length === 0) return 0;
  const compressed = deflateRawSync(buf, { level: 9 });
  return compressed.length / buf.length;
}

export function klDivergence(
  p: ReadonlyMap<string, number>,
  q: ReadonlyMap<string, number>,
): number {
  const pTotal = sumValues(p);
  const qTotal = sumValues(q);
  if (pTotal === 0 || qTotal === 0) return 0;
  const vocab = new Set<string>([...p.keys(), ...q.keys()]);
  const V = vocab.size || 1;
  let kl = 0;
  for (const w of vocab) {
    const pw = ((p.get(w) ?? 0) + 1) / (pTotal + V);
    const qw = ((q.get(w) ?? 0) + 1) / (qTotal + V);
    kl += pw * Math.log(pw / qw);
  }
  return kl;
}

export function meanBigramSurprisal(
  windowTokens: readonly string[],
  globalUnigrams: ReadonlyMap<string, number>,
  globalBigrams: ReadonlyMap<string, number>,
): number {
  if (windowTokens.length === 0) return 0;
  const V = globalUnigrams.size || 1;
  const N = sumValues(globalUnigrams) || 1;
  let total = 0;
  for (let i = 0; i < windowTokens.length; i++) {
    const w = windowTokens[i];
    if (i === 0) {
      const c = globalUnigrams.get(w) ?? 0;
      total += -Math.log((c + 1) / (N + V));
    } else {
      const prev = windowTokens[i - 1];
      const cPair = globalBigrams.get(`${prev}${BIGRAM_SEP}${w}`) ?? 0;
      const cPrev = globalUnigrams.get(prev) ?? 0;
      total += -Math.log((cPair + 1) / (cPrev + V));
    }
  }
  return total / windowTokens.length;
}

export interface SlidingWindow {
  start: number;
  end: number;
  segmentIds: number[];
}

export function slidingWindows(
  segments: readonly Segment[],
  windowSec: number,
  stepSec: number,
): SlidingWindow[] {
  if (segments.length === 0) return [];
  const t0 = segments[0].start;
  const tN = segments[segments.length - 1].end;
  const out: SlidingWindow[] = [];
  for (let s = t0; s < tN; s += stepSec) {
    const e = Math.min(s + windowSec, tN);
    if (e - s < windowSec * 0.5 && out.length > 0) break;
    const ids: number[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const mid = (seg.start + seg.end) / 2;
      if (mid >= s && mid < e) ids.push(i);
    }
    if (ids.length > 0) out.push({ start: s, end: e, segmentIds: ids });
  }
  return out;
}

interface WindowMetrics {
  win: SlidingWindow;
  entropy: number;
  surprisal: number;
  kl: number;
}

export function prefilterCandidates(
  segments: readonly Segment[],
  opts: ScoringOptions = {},
): CandidateWindow[] {
  const cfg = { ...DEFAULT_OPTIONS, ...opts, weights: { ...DEFAULT_OPTIONS.weights, ...(opts.weights ?? {}) } };
  if (segments.length === 0) return [];

  const fullText = segments.map((s) => s.text).join(" ");
  const fullTokens = tokenize(fullText);
  const globalUnigrams = unigramCounts(fullTokens);
  const globalBigrams = bigramCounts(fullTokens);

  const windows = slidingWindows(segments, cfg.windowSec, cfg.stepSec);
  if (windows.length === 0) return [];

  const metrics: WindowMetrics[] = windows.map((win) => {
    const text = win.segmentIds.map((i) => segments[i].text).join(" ");
    const toks = tokenize(text);
    return {
      win,
      entropy: compressionEntropy(text),
      surprisal: meanBigramSurprisal(toks, globalUnigrams, globalBigrams),
      kl: klDivergence(unigramCounts(toks), globalUnigrams),
    };
  });

  const zEntropy = zScores(metrics.map((m) => m.entropy));
  const zSurp = zScores(metrics.map((m) => m.surprisal));
  const zKL = zScores(metrics.map((m) => m.kl));
  const w = cfg.weights;

  const scored: CandidateWindow[] = metrics.map((m, i) => ({
    start: m.win.start,
    end: m.win.end,
    segmentIds: m.win.segmentIds,
    score: w.entropy * zEntropy[i] + w.surprisal * zSurp[i] + w.kl * zKL[i],
    components: { entropy: zEntropy[i], surprisal: zSurp[i], kl: zKL[i] },
  }));

  scored.sort((a, b) => b.score - a.score);

  const merged = mergeOverlapping(scored, segments, cfg.maxDurationSec);
  const filtered = merged.filter((c) => c.end - c.start >= Math.min(cfg.minDurationSec, cfg.windowSec));
  return filtered.slice(0, cfg.topK);
}

export function expandWithContext(
  candidates: readonly CandidateWindow[],
  segments: readonly Segment[],
  contextSec: number,
): { id: number; segment: Segment }[] {
  const keep = new Set<number>();
  for (const c of candidates) {
    const lo = c.start - contextSec;
    const hi = c.end + contextSec;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (s.end >= lo && s.start <= hi) keep.add(i);
    }
  }
  return [...keep].sort((a, b) => a - b).map((id) => ({ id, segment: segments[id] }));
}

function sumValues(m: ReadonlyMap<string, number>): number {
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}

function zScores(xs: readonly number[]): number[] {
  if (xs.length === 0) return [];
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  const std = Math.sqrt(variance);
  if (std === 0) return xs.map(() => 0);
  return xs.map((x) => (x - mean) / std);
}

function mergeOverlapping(
  ranked: readonly CandidateWindow[],
  segments: readonly Segment[],
  maxDurationSec: number,
): CandidateWindow[] {
  const taken: CandidateWindow[] = [];
  for (const c of ranked) {
    let merged = false;
    for (let i = 0; i < taken.length; i++) {
      const t = taken[i];
      const overlap = Math.min(t.end, c.end) - Math.max(t.start, c.start);
      if (overlap > 0) {
        const newStart = Math.min(t.start, c.start);
        const newEnd = Math.min(newStart + maxDurationSec, Math.max(t.end, c.end));
        const idSet = new Set<number>([...t.segmentIds, ...c.segmentIds]);
        const segmentIds = [...idSet].sort((a, b) => a - b)
          .filter((id) => segments[id].end >= newStart && segments[id].start <= newEnd);
        taken[i] = {
          start: newStart,
          end: newEnd,
          segmentIds,
          score: Math.max(t.score, c.score),
          components: t.score >= c.score ? t.components : c.components,
        };
        merged = true;
        break;
      }
    }
    if (!merged) taken.push(c);
  }
  return taken;
}
