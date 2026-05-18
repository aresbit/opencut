import { z } from "zod";

export const wordTimestampSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
  punctuation: z.string().default(""),
});

export type WordTimestamp = z.infer<typeof wordTimestampSchema>;

export const segmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
  words: z.array(wordTimestampSchema).default([]),
});

export type Segment = z.infer<typeof segmentSchema>;

export const segmentKeywordSchema = z
  .object({
    segment_id: z.number().optional(),
    words: z.array(z.string()).default([]),
  })
  .passthrough();

export type SegmentKeyword = z.infer<typeof segmentKeywordSchema>;

export const highlightSchema = z.object({
  start: z.number(),
  end: z.number(),
  title: z.string().default(""),
  subtitle: z.string().default(""),
  content: z.string().default(""),
  keywords: z.array(z.string()).default([]),
  segment_keywords: z.array(segmentKeywordSchema).default([]),
});

export type Highlight = z.infer<typeof highlightSchema>;

export function createSegment(
  start: number,
  end: number,
  text: string,
  words: WordTimestamp[] = [],
): Segment {
  return { start, end, text, words };
}

export function createHighlight(init: Partial<Highlight> & Pick<Highlight, "start" | "end">): Highlight {
  return {
    title: "",
    subtitle: "",
    content: "",
    keywords: [],
    segment_keywords: [],
    ...init,
  };
}
