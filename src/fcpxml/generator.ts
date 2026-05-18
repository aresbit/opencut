import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_HIGHLIGHT_SUBTITLE_COLOR,
  DEFAULT_ORIGINAL_SUBTITLE_COLOR,
  DEFAULT_TRANSLATION_SUBTITLE_COLOR,
} from "../config.ts";
import type { Highlight, Segment } from "../models.ts";
import { xmlEscape } from "./escape.ts";
import { buildFcpxmlTimemap } from "./timemap.ts";
import { buildFcpxmlTitle } from "./title.ts";

export type Orientation = "landscape" | "portrait";

export type TranslateFn = (
  texts: readonly string[],
  sourceLang: string,
  targetLang: string,
) => Promise<string[]>;

export interface GenerateFcpxmlOptions {
  videoPath: string;
  highlights: readonly Highlight[];
  segments: readonly Segment[];
  outputPath: string;
  frameRate?: number;
  speed?: number;
  translate?: boolean;
  sourceLang?: string;
  targetLang?: string;
  orientation?: Orientation;
  enableClip?: boolean;
  filterEmptySegments?: boolean;
  translateFn?: TranslateFn | null;
  originalSubtitleColor?: string;
  translationSubtitleColor?: string;
  highlightSubtitleColor?: string;
  /** Override the default Date.now() used for the <event name="YYYY-MM-DD"> attribute. */
  now?: () => Date;
}

function roundPrecision9(v: number): number {
  return Math.round(v * 1e9) / 1e9;
}

function formatDate(date: Date): string {
  const y = date.getFullYear().toString().padStart(4, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildSegmentKeywordMap(
  highlights: readonly Highlight[],
): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const h of highlights) {
    for (const sk of h.segment_keywords ?? []) {
      const id = sk.segment_id;
      const keywords = (sk.keywords ?? []).filter(Boolean);
      if (id == null || keywords.length === 0) continue;
      const prev = map.get(id) ?? [];
      map.set(id, [...prev, ...keywords]);
    }
  }
  return map;
}

export async function generateFcpxml(opts: GenerateFcpxmlOptions): Promise<string> {
  const {
    videoPath,
    highlights,
    segments,
    outputPath,
    frameRate = 25,
    speed = 1,
    translate = false,
    sourceLang = "zh",
    targetLang = "en",
    orientation = "landscape",
    enableClip = true,
    filterEmptySegments = true,
    translateFn = null,
    originalSubtitleColor = DEFAULT_ORIGINAL_SUBTITLE_COLOR,
    translationSubtitleColor = DEFAULT_TRANSLATION_SUBTITLE_COLOR,
    highlightSubtitleColor = DEFAULT_HIGHLIGHT_SUBTITLE_COLOR,
    now = () => new Date(),
  } = opts;

  if (speed <= 0) throw new Error("FCPXML speed must be greater than 0");

  const fpsInt = Math.trunc(frameRate);
  const timelineSpeed = speed;

  const s2f = (seconds: number): number => Math.ceil(roundPrecision9(seconds * frameRate));
  const s2fStart = (seconds: number): number =>
    Math.max(0, Math.floor(roundPrecision9(seconds * frameRate)));
  const s2fEnd = (seconds: number): number =>
    Math.max(0, Math.ceil(roundPrecision9(seconds * frameRate)));
  const s2fTimeline = (seconds: number): number =>
    Math.ceil(roundPrecision9((seconds * frameRate) / timelineSpeed));
  const ft = (n: number): string => `${n}/${fpsInt}s`;

  const [width, height] = orientation === "landscape" ? [1920, 1080] : [1080, 1920];
  const lastSeg = segments[segments.length - 1];
  const videoDuration = lastSeg ? lastSeg.end : 0;

  const absVideoPath = path.resolve(videoPath);
  const videoUrl = pathToFileURL(absVideoPath).href;
  const videoName = path.parse(videoPath).name;
  const projectName = videoName;
  const exportTimestamp = formatDate(now());
  const videoSrcDurF = s2f(videoDuration);
  const videoDurF = s2fTimeline(videoDuration);

  let activeRaw: Segment[];
  if (enableClip && highlights.length > 0) {
    activeRaw = [];
    for (const h of highlights) {
      for (const seg of segments) {
        if (seg.end > h.start && seg.start < h.end) activeRaw.push(seg);
      }
    }
  } else {
    activeRaw = [...segments];
  }

  const active = filterEmptySegments
    ? activeRaw.filter((s) => (s.text ?? "").trim().length > 0)
    : [...activeRaw];

  let transList: string[];
  if (translate && active.length > 0 && translateFn) {
    const raw = await translateFn(active.map((s) => s.text), sourceLang, targetLang);
    transList = raw.length === active.length ? raw : new Array(active.length).fill("");
  } else {
    transList = new Array(active.length).fill("");
  }

  let totalF: number;
  if (enableClip && highlights.length > 0) {
    totalF = 0;
    let lastEndF = 0;
    for (const seg of active) {
      let startF = s2fStart(seg.start);
      const endF = s2fEnd(seg.end);
      if (lastEndF > 0 && startF < lastEndF) startF = lastEndF;
      const durFSrc = endF - startF;
      if (durFSrc <= 0) continue;
      if (startF > lastEndF) {
        const gapSrc = startF - lastEndF;
        totalF += Math.ceil(gapSrc / timelineSpeed);
      }
      totalF += Math.max(1, Math.ceil(durFSrc / timelineSpeed));
      lastEndF = endF;
    }
  } else {
    totalF = videoDurF;
  }

  const buf: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!DOCTYPE fcpxml>",
    '<fcpxml version="1.11">',
    "  <resources>",
    `    <format id="r1" name="CustomFormat_${width}x${height}_${fpsInt}fps"` +
      ` frameDuration="1/${fpsInt}s" width="${width}" height="${height}"` +
      ' colorSpace="1-1-1 (Rec. 709)"/>',
    `    <asset id="r2" name="${xmlEscape(videoName)}"` +
      ` start="0/${fpsInt}s" hasVideo="1" format="r1" hasAudio="1"` +
      ` audioChannels="2" duration="${ft(videoSrcDurF)}">`,
    `      <media-rep kind="original-media" src="${xmlEscape(videoUrl)}"/>`,
    "    </asset>",
    '    <effect id="r3" name="Title"' +
      ' uid=".../Titles.localized/Build In:Out.localized/Custom.localized/Custom.moti"/>',
    "  </resources>",
    "  <library>",
    `    <event name="${xmlEscape(exportTimestamp)}">`,
    `      <project name="${xmlEscape(projectName)}">`,
    `        <sequence format="r1" tcFormat="NDF" audioLayout="stereo" audioRate="48k"` +
      ` duration="${ft(totalF)}">`,
    "          <spine>",
  ];

  let styleId = 1;
  const segmentIndexMap = new Map<Segment, number>();
  segments.forEach((s, i) => segmentIndexMap.set(s, i));
  const segmentKeywordsMap = buildSegmentKeywordMap(highlights);

  if (enableClip && highlights.length > 0) {
    let timelineOff = 0;
    let lastEndF = 0;
    for (let i = 0; i < active.length; i++) {
      const seg = active[i];
      if (!seg) continue;
      let startF = s2fStart(seg.start);
      const endF = s2fEnd(seg.end);
      if (lastEndF > 0 && startF < lastEndF) startF = lastEndF;
      const durFSrc = endF - startF;
      if (durFSrc <= 0) continue;
      const durF = Math.max(1, Math.ceil(durFSrc / timelineSpeed));

      if (!filterEmptySegments && startF > lastEndF) {
        const gapSrc = startF - lastEndF;
        const gapF = Math.ceil(gapSrc / timelineSpeed);
        if (gapF > 0) {
          if (timelineSpeed !== 1) {
            buf.push(
              `            <asset-clip ref="r2" offset="${ft(timelineOff)}"` +
                ` duration="${ft(gapF)}" start="${ft(lastEndF)}"` +
                ` name="gap-${i}" tcFormat="NDF">`,
              buildFcpxmlTimemap(lastEndF, gapF, gapSrc, fpsInt),
              "            </asset-clip>",
            );
          } else {
            buf.push(
              `            <asset-clip ref="r2" offset="${ft(timelineOff)}"` +
                ` duration="${ft(gapF)}" start="${ft(lastEndF)}"` +
                ` name="gap-${i}" tcFormat="NDF"/>`,
            );
          }
          timelineOff += gapF;
        }
      }

      const translation = transList[i] ?? "";
      const segmentId = segmentIndexMap.get(seg);
      const clipName = (seg.text ? seg.text.slice(0, 40) : String(i)) || String(i);

      buf.push(
        `            <asset-clip ref="r2" offset="${ft(timelineOff)}"` +
          ` duration="${ft(durF)}" start="${ft(startF)}"` +
          ` name="${xmlEscape(clipName)}" tcFormat="NDF">`,
      );
      if (timelineSpeed !== 1) {
        buf.push(buildFcpxmlTimemap(startF, durF, durFSrc, fpsInt));
      }
      buf.push(
        buildFcpxmlTitle({
          text: seg.text,
          translation,
          offsetFrames: startF,
          durationFrames: durF,
          fpsInt,
          styleId,
          orientation,
          segmentKeywords:
            segmentId != null ? segmentKeywordsMap.get(segmentId) ?? [] : [],
          originalSubtitleColor,
          translationSubtitleColor,
          highlightSubtitleColor,
        }),
        "            </asset-clip>",
      );
      styleId += 1;
      timelineOff += durF;
      lastEndF = endF;
    }
  } else {
    buf.push(
      `            <asset-clip ref="r2" offset="0/${fpsInt}s"` +
        ` duration="${ft(videoDurF)}" start="0/${fpsInt}s"` +
        ` name="${xmlEscape(videoName)}" tcFormat="NDF">`,
    );
    if (timelineSpeed !== 1) {
      buf.push(buildFcpxmlTimemap(0, videoDurF, videoSrcDurF, fpsInt));
    }
    for (let i = 0; i < active.length; i++) {
      const seg = active[i];
      if (!seg) continue;
      const startF = s2fTimeline(seg.start);
      const durF = s2fTimeline(seg.end - seg.start);
      if (durF <= 0) continue;
      const translation = transList[i] ?? "";
      const segmentId = segmentIndexMap.get(seg);
      buf.push(
        buildFcpxmlTitle({
          text: seg.text,
          translation,
          offsetFrames: startF,
          durationFrames: durF,
          fpsInt,
          styleId,
          orientation,
          segmentKeywords:
            segmentId != null ? segmentKeywordsMap.get(segmentId) ?? [] : [],
          originalSubtitleColor,
          translationSubtitleColor,
          highlightSubtitleColor,
        }),
      );
      styleId += 1;
    }
    buf.push("            </asset-clip>");
  }

  buf.push(
    "          </spine>",
    "        </sequence>",
    "      </project>",
    "    </event>",
    "  </library>",
    "</fcpxml>",
  );

  const content = `${buf.join("\n")}\n`;
  await fs.writeFile(outputPath, content, "utf8");
  return outputPath;
}
