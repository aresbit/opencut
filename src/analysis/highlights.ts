import type { Segment } from "../models.ts";
import { type AnalysisClient, extractJsonPayload } from "./client.ts";
import { buildHighlightsPrompt } from "./prompts.ts";
import { type HighlightPayload, sanitizeHighlights } from "./sanitize.ts";
import {
  type CandidateWindow,
  type ScoringOptions,
  expandWithContext,
  prefilterCandidates,
} from "./scoring.ts";

export interface ExtractHighlightsOptions {
  prefilter?: boolean | ScoringOptions;
}

export async function extractHighlights(
  client: AnalysisClient,
  segments: readonly Segment[],
  _sourceLang: string,
  targetLang: string,
  options: ExtractHighlightsOptions = {},
): Promise<HighlightPayload[]> {
  const prefilterCfg = options.prefilter ?? true;
  const candidates: CandidateWindow[] = prefilterCfg === false
    ? []
    : prefilterCandidates(segments, typeof prefilterCfg === "object" ? prefilterCfg : {});

  const contextSec = typeof prefilterCfg === "object" && prefilterCfg.contextSec != null
    ? prefilterCfg.contextSec
    : 15;
  const condensed = candidates.length > 0
    ? expandWithContext(candidates, segments, contextSec)
    : segments.map((segment, id) => ({ id, segment }));

  if (candidates.length > 0) {
    const ranges = candidates
      .map((c) => `${c.start.toFixed(1)}s-${c.end.toFixed(1)}s(score=${c.score.toFixed(2)})`)
      .join(", ");
    console.log(`📊 Prefilter kept ${candidates.length}/${Math.ceil(segments.length)} windows: ${ranges}`);
  }

  const prompt = buildHighlightsPrompt(condensed, targetLang);
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
