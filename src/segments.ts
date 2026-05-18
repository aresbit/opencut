import { type Segment, type WordTimestamp, createSegment } from "./models.ts";
import { PUNCT_ALL, needsSpace } from "./text.ts";

export interface AlignedWord {
  text: string;
  start_time: number;
  end_time: number;
}

export function attachPunctuationToWords(
  items: Iterable<AlignedWord>,
  text = "",
): WordTimestamp[] {
  const words: WordTimestamp[] = [];
  const textLower = text ? text.toLowerCase() : "";
  const textLen = textLower.length;
  let pos = 0;

  for (const it of items) {
    const token = String(it.text ?? "").trim();
    if (!token) continue;

    let punct = "";
    if (text) {
      const idx = textLower.indexOf(token.toLowerCase(), pos);
      if (idx !== -1) {
        let searchPos = idx + token.length;
        while (searchPos < textLen && text[searchPos] === " ") searchPos++;
        while (searchPos < textLen && PUNCT_ALL.has(text[searchPos] as string)) {
          punct += text[searchPos];
          searchPos++;
        }
        pos = idx + token.length;
      }
    }

    words.push({
      word: token,
      start: Number(it.start_time ?? 0),
      end: Number(it.end_time ?? 0),
      punctuation: punct,
    });
  }

  return words;
}

function buildText(words: WordTimestamp[]): string {
  let text = "";
  let prev = "";
  for (const w of words) {
    if (needsSpace(prev, w.word)) text += " ";
    text += w.word;
    prev = w.word;
  }
  return text;
}

function emitBucket(
  bucket: WordTimestamp[],
  segStart: number,
  segEnd: number,
): Segment {
  const first = bucket[0];
  const last = bucket[bucket.length - 1];
  if (!first || !last) {
    return createSegment(segStart, segEnd, "", []);
  }
  const start = Math.max(first.start, segStart);
  let end = Math.min(last.end, segEnd);
  if (end < start) end = start;

  const clamped: WordTimestamp[] = bucket.map((w) => {
    const cs = Math.max(Math.min(w.start, end), start);
    let ce = Math.max(Math.min(w.end, end), start);
    if (ce < cs) ce = cs;
    return { ...w, start: cs, end: ce };
  });

  return createSegment(start, end, buildText(bucket), clamped);
}

export type BucketSplitter = (
  bucket: WordTimestamp[],
  segStart: number,
  segEnd: number,
  maxChars: number,
) => Segment[];

export function splitVadSegmentByPunctuation(
  words: WordTimestamp[],
  segStart: number,
  segEnd: number,
  maxChars = 0,
  splitOversized?: BucketSplitter,
): Segment[] {
  if (words.length === 0) return [];

  const buckets: WordTimestamp[][] = [];
  let bucket: WordTimestamp[] = [];
  for (const w of words) {
    bucket.push(w);
    if (w.punctuation) {
      buckets.push(bucket);
      bucket = [];
    }
  }
  if (bucket.length > 0) buckets.push(bucket);

  const result: Segment[] = [];
  for (const b of buckets) {
    if (maxChars > 0 && splitOversized) {
      result.push(...splitOversized(b, segStart, segEnd, maxChars));
    } else {
      result.push(emitBucket(b, segStart, segEnd));
    }
  }
  return result;
}
