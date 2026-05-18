import type { Segment } from "../models.ts";
import { type AnalysisClient, extractJsonPayload } from "./client.ts";
import { buildSegmentKeywordsPrompt } from "./prompts.ts";
import { type SegmentKeywordEntry, sanitizeSegmentKeywords } from "./sanitize.ts";

export async function extractKeywordsForSegments(
  client: AnalysisClient,
  segments: readonly Segment[],
  _sourceLang: string,
  targetLang: string,
): Promise<SegmentKeywordEntry[]> {
  const prompt = buildSegmentKeywordsPrompt(segments, targetLang);
  try {
    const raw = (await client.chat(prompt)).trim();
    const json = extractJsonPayload(raw);
    const data = JSON.parse(json) as Record<string, unknown>;
    return sanitizeSegmentKeywords(data.segment_keywords ?? []);
  } catch (err) {
    console.error(`❌ Keyword extraction failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}
