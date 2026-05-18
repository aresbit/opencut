import type { Segment } from "../models.ts";
import { type AnalysisClient, extractJsonPayload } from "./client.ts";
import { buildHighlightsPrompt } from "./prompts.ts";
import { type HighlightPayload, sanitizeHighlights } from "./sanitize.ts";

export async function extractHighlights(
  client: AnalysisClient,
  segments: readonly Segment[],
  _sourceLang: string,
  targetLang: string,
): Promise<HighlightPayload[]> {
  const prompt = buildHighlightsPrompt(segments, targetLang);
  try {
    const raw = (await client.chat(prompt)).trim();
    const json = extractJsonPayload(raw);
    const data = JSON.parse(json) as Record<string, unknown>;
    return sanitizeHighlights(data.highlights ?? []);
  } catch (err) {
    console.error(`❌ Highlights extraction failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}
