import type { Segment } from "../models.ts";
import { type AnalysisClient, extractJsonPayload } from "./client.ts";
import { buildCorrectionsPrompt } from "./prompts.ts";
import { type CorrectionPayload, sanitizeCorrections } from "./sanitize.ts";

export async function correctWords(
  client: AnalysisClient,
  segments: readonly Segment[],
  sourceLang: string,
): Promise<CorrectionPayload[]> {
  const prompt = buildCorrectionsPrompt(segments, sourceLang);
  try {
    const raw = (await client.chat(prompt)).trim();
    const json = extractJsonPayload(raw);
    const data = JSON.parse(json) as Record<string, unknown>;
    return sanitizeCorrections(data.corrections ?? []);
  } catch (err) {
    console.error(`❌ Word correction failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}
