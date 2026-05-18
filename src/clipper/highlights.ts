import { extractHighlights } from "../analysis/highlights.ts";
import type { AnalysisClient } from "../analysis/client.ts";
import { type Highlight, type Segment, createHighlight } from "../models.ts";

export interface TitleInfo {
  title: string;
  subtitle: string;
}

export interface AnalyzeContentResult {
  titleInfo: TitleInfo;
  highlights: Highlight[];
}

export async function analyzeWithHighlights(
  client: AnalysisClient | null,
  segments: readonly Segment[],
  sourceLang: string,
  targetLang: string,
): Promise<Highlight[]> {
  if (!client) return [];
  const raw = await extractHighlights(client, segments, sourceLang, targetLang);
  return raw.map((h) =>
    createHighlight({
      start: h.start,
      end: h.end,
      title: h.title,
      subtitle: h.subtitle,
      content: h.content,
      keywords: h.keywords,
      segment_keywords: h.segment_keywords.map((sk) => ({
        segment_id: sk.segment_id,
        keywords: sk.keywords,
      })),
    }),
  );
}

export async function analyzeContent(
  client: AnalysisClient | null,
  segments: readonly Segment[],
  sourceLang: string,
  targetLang: string,
): Promise<AnalyzeContentResult> {
  if (!client) {
    return { titleInfo: { title: "", subtitle: "" }, highlights: [] };
  }
  const highlights = await analyzeWithHighlights(client, segments, sourceLang, targetLang);
  const first = highlights[0];
  const titleInfo: TitleInfo = first?.title
    ? { title: first.title, subtitle: first.subtitle }
    : { title: "视频精华", subtitle: "Video Highlights" };
  return { titleInfo, highlights };
}

export function clampHighlightsToChunk(
  highlights: readonly Highlight[],
  chunkStart: number,
  chunkEnd: number,
): Highlight[] {
  const out: Highlight[] = [];
  for (const h of highlights) {
    const start = Math.max(h.start, chunkStart);
    const end = Math.min(h.end, chunkEnd);
    if (end <= start) continue;
    out.push(start !== h.start || end !== h.end ? { ...h, start, end } : h);
  }
  return out;
}
