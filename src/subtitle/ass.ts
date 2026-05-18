import { promises as fs } from "node:fs";
import {
  DEFAULT_HIGHLIGHT_SUBTITLE_COLOR,
  DEFAULT_ORIGINAL_SUBTITLE_COLOR,
  DEFAULT_TRANSLATION_SUBTITLE_COLOR,
} from "../config.ts";
import type { Highlight, Segment, SegmentKeyword } from "../models.ts";
import { hexColorToAss } from "../text.ts";
import { applyKeywordHighlighting } from "./highlighting.ts";
import { formatAssTime } from "./time.ts";

export type Orientation = "landscape" | "portrait";
export type SubtitlePosition = "original-top" | "translated-top";

export type TranslateFn = (
  texts: readonly string[],
  sourceLang: string,
  targetLang: string,
) => Promise<string[]>;

export interface GenerateAssSubtitleOptions {
  highlights: readonly Highlight[];
  segments: readonly Segment[];
  outputPath: string;
  translate?: boolean;
  sourceLang?: string;
  targetLang?: string;
  orientation?: Orientation;
  subtitlePosition?: SubtitlePosition;
  firstSubtitleDelay?: number;
  translateFn?: TranslateFn | null;
  originalSubtitleColor?: string;
  translationSubtitleColor?: string;
  highlightSubtitleColor?: string;
}

function buildHeader(
  orientation: Orientation,
  originalAssColor: string,
  translationAssColor: string,
): string {
  if (orientation === "portrait") {
    return `[Script Info]
Title: Generated Subtitle
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Arial Unicode MS,140.0,&H0000FFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3.0,2,8,20,20,250,0
Style: Subtitle,Arial Unicode MS,100.0,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1.0,1.5,8,20,20,250,0
Style: OriginalTop,Arial Unicode MS,60.0,${originalAssColor},&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1.0,1,2,20,20,520,0
Style: OriginalBottom,Arial Unicode MS,40.0,${originalAssColor},&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1.0,1,2,20,20,460,0
Style: TranslationTop,Arial Unicode MS,60.0,${translationAssColor},&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1.0,1,2,20,20,520,0
Style: TranslationBottom,Arial Unicode MS,40.0,${translationAssColor},&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1.0,1,2,20,20,460,0

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  }
  return `[Script Info]
Title: Generated Subtitle
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Arial Unicode MS,100.0,&H0000FFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3.0,2,2,20,20,100,0
Style: Subtitle,Arial Unicode MS,70.0,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1.0,1.5,2,20,20,100,0
Style: OriginalTop,Arial Unicode MS,50.0,${originalAssColor},&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1.0,1,2,20,20,240,0
Style: OriginalBottom,Arial Unicode MS,35.0,${originalAssColor},&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1.0,1,2,20,20,180,0
Style: TranslationTop,Arial Unicode MS,50.0,${translationAssColor},&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1.0,1,2,20,20,240,0
Style: TranslationBottom,Arial Unicode MS,35.0,${translationAssColor},&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1.0,1,2,20,20,180,0

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

interface ProcessedSegment {
  start: number;
  end: number;
  text: string;
  segmentId: number | null;
}

function buildSegmentKeywordsMap(
  segmentKeywords: readonly SegmentKeyword[] | undefined,
): Map<number, string[]> {
  const map = new Map<number, string[]>();
  if (!segmentKeywords) return map;
  for (const sk of segmentKeywords) {
    const id = sk.segment_id;
    const keywords = sk.keywords ?? [];
    if (typeof id === "number" && keywords.length > 0) {
      map.set(id, keywords);
    }
  }
  return map;
}

export async function generateAssSubtitle(
  options: GenerateAssSubtitleOptions,
): Promise<string> {
  const {
    highlights,
    segments,
    outputPath,
    translate = false,
    sourceLang = "zh",
    targetLang = "en",
    orientation = "landscape",
    subtitlePosition = "original-top",
    firstSubtitleDelay = 1,
    translateFn = null,
    originalSubtitleColor = DEFAULT_ORIGINAL_SUBTITLE_COLOR,
    translationSubtitleColor = DEFAULT_TRANSLATION_SUBTITLE_COLOR,
    highlightSubtitleColor = DEFAULT_HIGHLIGHT_SUBTITLE_COLOR,
  } = options;

  const originalAssColor = `${hexColorToAss(originalSubtitleColor)}&`;
  const translationAssColor = `${hexColorToAss(translationSubtitleColor)}&`;
  const header = buildHeader(orientation, originalAssColor, translationAssColor);

  const segmentIndex = new Map<Segment, number>();
  segments.forEach((s, i) => segmentIndex.set(s, i));

  const events: string[] = [];
  let cumulative = 0;

  for (const h of highlights) {
    const duration = h.end - h.start;
    const highlightEndFmt = formatAssTime(cumulative + duration);

    events.push(`Dialogue: 0,00:00.00,${highlightEndFmt},Title,,0,0,0,,${h.title}`);
    events.push(`Dialogue: 0,00:00.00,${highlightEndFmt},Subtitle,,0,0,0,,${h.subtitle}`);

    const highlightSegments = segments.filter((s) => s.end > h.start && s.start < h.end);
    const segKwMap = buildSegmentKeywordsMap(h.segment_keywords);

    const processed: ProcessedSegment[] = [];
    for (let i = 0; i < highlightSegments.length; i++) {
      const seg = highlightSegments[i];
      if (!seg) continue;
      const segId = segmentIndex.get(seg) ?? null;
      const offsetStart = Math.max(0, seg.start - h.start);
      let offsetEnd = Math.min(duration, seg.end - h.start);
      const next = highlightSegments[i + 1];
      if (next) {
        const nextOffsetStart = Math.max(0, next.start - h.start);
        if (nextOffsetStart > offsetEnd) offsetEnd = nextOffsetStart;
      }
      processed.push({
        start: cumulative + offsetStart,
        end: cumulative + offsetEnd,
        text: seg.text,
        segmentId: segId,
      });
    }

    let translatedTexts: string[] = [];
    if (translate && processed.length > 0 && translateFn) {
      const sources = processed.map((p) => p.text);
      translatedTexts = await translateFn(sources, sourceLang, targetLang);
      if (translatedTexts.length !== processed.length) {
        translatedTexts = sources;
      }
    }

    processed.forEach((seg, segIdx) => {
      let segStartTime = seg.start;
      if (segIdx === 0 && firstSubtitleDelay > 0) {
        segStartTime = Math.max(segStartTime, cumulative + firstSubtitleDelay);
      }
      const segStart = formatAssTime(segStartTime);
      const segEnd = formatAssTime(seg.end);
      const keywords = seg.segmentId != null ? segKwMap.get(seg.segmentId) ?? [] : [];
      const highlightedOriginal = applyKeywordHighlighting(
        seg.text,
        keywords,
        highlightSubtitleColor,
      );

      if (translate && translatedTexts.length > 0) {
        const translatedText = translatedTexts[segIdx] ?? seg.text;
        const highlightedTranslated = applyKeywordHighlighting(
          translatedText,
          keywords,
          highlightSubtitleColor,
        );
        if (subtitlePosition === "original-top") {
          events.push(
            `Dialogue: 0,${segStart},${segEnd},OriginalTop,,0,0,0,,${highlightedOriginal}`,
          );
          events.push(
            `Dialogue: 0,${segStart},${segEnd},TranslationBottom,,0,0,0,,${highlightedTranslated}`,
          );
        } else {
          events.push(
            `Dialogue: 0,${segStart},${segEnd},TranslationTop,,0,0,0,,${highlightedTranslated}`,
          );
          events.push(
            `Dialogue: 0,${segStart},${segEnd},OriginalBottom,,0,0,0,,${highlightedOriginal}`,
          );
        }
      } else {
        events.push(
          `Dialogue: 0,${segStart},${segEnd},OriginalTop,,0,0,0,,${highlightedOriginal}`,
        );
      }
    });

    cumulative += duration;
  }

  await fs.writeFile(outputPath, header + events.join("\n"), "utf8");
  return outputPath;
}
