import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { correctWords } from "../analysis/corrections.ts";
import type { AnalysisClient } from "../analysis/client.ts";
import { extractKeywordsForSegments } from "../analysis/keywords.ts";
import { AsrHelper } from "../asr/helper.ts";
import type { AsrBackend, VadBackend } from "../asr/types.ts";
import { extractAudio, getAudioDuration } from "../io/ffmpeg.ts";
import {
  DEFAULT_OUTPUT_FORMATS,
  type OutputFormat,
  normalizeOutputFormats,
} from "../io/formats.ts";
import {
  type TranscriptMeta,
  loadSegmentsFromTranscriptJson,
  saveTranscriptJson,
} from "../io/transcript.ts";
import { type Highlight, type Segment, createHighlight } from "../models.ts";
import { renderVideoWithSubtitles } from "../renderer/render.ts";
import type { VideoDimensions } from "../renderer/filter-complex.ts";
import { generateAssSubtitle, type TranslateFn } from "../subtitle/ass.ts";
import { segmentsToSrt } from "../subtitle/srt.ts";
import { generateFcpxml } from "../fcpxml/generator.ts";
import { applyCorrections } from "./corrections.ts";
import { analyzeContent, clampHighlightsToChunk } from "./highlights.ts";
import {
  filterSubtitleSegments,
  resolveOverlaps,
  splitTranscriptSegments,
} from "./segments.ts";
import { transcribeAudio } from "./transcribe.ts";

export interface ProcessVideoOptions {
  videoPath: string;
  outputDir: string;
  asrBackend: AsrBackend;
  vadBackend?: VadBackend;
  analysisClient?: AnalysisClient | null;
  translateFn?: TranslateFn | null;
  getVideoDimensions?: (videoPath: string) => Promise<VideoDimensions>;
  translate?: boolean;
  sourceLang?: string;
  targetLang?: string;
  orientation?: "landscape" | "portrait";
  subtitlePosition?: "original-top" | "translated-top";
  firstSubtitleDelay?: number;
  enableClip?: boolean;
  enableHighlight?: boolean;
  correctWords?: boolean;
  filterEmptySegments?: boolean;
  filterFillers?: boolean;
  marginLeft?: number;
  marginRight?: number;
  outputFormats?: readonly string[] | string | null;
  fcpxmlFrameRate?: number;
  fcpxmlSpeed?: number;
  transcriptJsonPath?: string | null;
  originalSubtitleColor?: string;
  translationSubtitleColor?: string;
  highlightSubtitleColor?: string;
  segmentDuration?: number;
  maxChars?: number;
}

export type ProcessVideoResult = Record<string, string>;

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeText(filePath: string, body: string): Promise<void> {
  await fs.writeFile(filePath, body, "utf8");
}

function chunkSuffix(idx: number): string {
  return `part${idx.toString().padStart(3, "0")}`;
}

export async function processVideo(opts: ProcessVideoOptions): Promise<ProcessVideoResult> {
  const {
    videoPath,
    outputDir,
    asrBackend,
    vadBackend,
    analysisClient = null,
    translateFn = null,
    getVideoDimensions,
    translate = false,
    sourceLang = "en",
    targetLang = "en",
    orientation = "landscape",
    subtitlePosition = "translated-top",
    firstSubtitleDelay = 1,
    enableClip = true,
    enableHighlight = false,
    correctWords: shouldCorrectWords = false,
    filterEmptySegments = true,
    filterFillers = true,
    marginLeft = -0.1,
    marginRight = 0.15,
    outputFormats,
    fcpxmlFrameRate = 25,
    fcpxmlSpeed = 1,
    transcriptJsonPath = null,
    originalSubtitleColor,
    translationSubtitleColor,
    highlightSubtitleColor,
    segmentDuration = 300,
    maxChars = 30,
  } = opts;

  await fs.mkdir(outputDir, { recursive: true });
  const videoName = path.parse(videoPath).name;
  const results: ProcessVideoResult = {};

  const selectedFormats = new Set<OutputFormat>(
    outputFormats == null ? [...DEFAULT_OUTPUT_FORMATS] : normalizeOutputFormats(outputFormats),
  );
  const wantAss = selectedFormats.has("ass");
  const wantSrt = selectedFormats.has("srt");
  const wantFcpxml = selectedFormats.has("fcpxml");
  const wantVideo = selectedFormats.has("video");
  const wantTxt = selectedFormats.has("txt");
  const wantJson = selectedFormats.has("json");
  const renderWithHighlights =
    enableClip && (wantAss || wantVideo || wantFcpxml);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pycut-run-"));
  try {
    const transcriptPath = path.join(outputDir, `${videoName}_transcript.json`);
    let segments: Segment[];
    let transcriptMeta: TranscriptMeta = { title: "", subtitle: "", highlights: [] };

    if (transcriptJsonPath) {
      const loaded = await loadSegmentsFromTranscriptJson(transcriptJsonPath);
      segments = loaded.segments;
      transcriptMeta = loaded.meta;
      console.log(`📂 Using provided transcript: ${transcriptJsonPath}`);
      if (path.resolve(transcriptJsonPath) !== path.resolve(transcriptPath)) {
        await fs.copyFile(transcriptJsonPath, transcriptPath);
      }
    } else if (await pathExists(transcriptPath)) {
      const loaded = await loadSegmentsFromTranscriptJson(transcriptPath);
      segments = loaded.segments;
      transcriptMeta = loaded.meta;
      console.log(`♻️  Reusing existing transcript: ${transcriptPath}`);
    } else {
      const audioPath = path.join(tmpDir, "audio.wav");
      await extractAudio(videoPath, audioPath);
      const helper = new AsrHelper({
        asr: asrBackend,
        ...(vadBackend ? { vad: vadBackend } : {}),
        filterFillers,
        getDuration: getAudioDuration,
      });
      segments = await transcribeAudio({
        audioPath,
        helper,
        segmentDuration,
        maxChars,
        sourceLang,
        getDuration: getAudioDuration,
      });
      await helper.unload();
      await saveTranscriptJson(transcriptPath, { segments, highlights: [] });
      console.log(`💾 Transcription saved to ${transcriptPath}`);
    }

    if (shouldCorrectWords && analysisClient) {
      console.log("🔍 Correcting ASR errors with LLM…");
      const corrections = await correctWords(analysisClient, segments, sourceLang);
      if (corrections.length > 0) {
        segments = applyCorrections(segments, corrections);
        await saveTranscriptJson(transcriptPath, {
          title: transcriptMeta.title,
          subtitle: transcriptMeta.subtitle,
          segments,
          highlights: transcriptMeta.highlights,
        });
        console.log(`✅ Applied ${corrections.length} correction(s)`);
      }
    }

    let subtitleSegments = filterSubtitleSegments(segments, filterEmptySegments);
    if (marginLeft !== 0 || marginRight !== 0) {
      subtitleSegments = resolveOverlaps(subtitleSegments, marginLeft, marginRight);
    }
    results.transcript = transcriptPath;

    if (wantJson && !(wantAss || wantSrt || wantFcpxml || wantVideo || wantTxt)) {
      return results;
    }

    if (wantTxt) {
      const txtPath = path.join(outputDir, `${videoName}.txt`);
      const body = subtitleSegments
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join("\n");
      await writeText(txtPath, body ? `${body}\n` : "");
      results.txt = txtPath;
    }

    if (renderWithHighlights) {
      const chunks = splitTranscriptSegments(subtitleSegments, segmentDuration);
      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunkSegments = chunks[chunkIdx];
        if (!chunkSegments || chunkSegments.length === 0) continue;
        const firstSeg = chunkSegments[0];
        const lastSeg = chunkSegments[chunkSegments.length - 1];
        if (!firstSeg || !lastSeg) continue;
        const chunkStart = firstSeg.start;
        const chunkEnd = lastSeg.end;
        const { titleInfo, highlights: rawHighlights } = await analyzeContent(
          analysisClient,
          chunkSegments,
          sourceLang,
          targetLang,
        );
        let highlights = clampHighlightsToChunk(rawHighlights, chunkStart, chunkEnd);
        if (highlights.length === 0) {
          highlights = [
            createHighlight({
              start: chunkStart,
              end: chunkEnd,
              title: titleInfo.title || "完整视频",
              subtitle: titleInfo.subtitle || "Full Video",
              content: "完整片段内容",
            }),
          ];
        }

        const suffix = chunkSuffix(chunkIdx + 1);
        const highlightsJsonPath = path.join(
          outputDir,
          `${videoName}_${suffix}_highlights.json`,
        );
        await saveTranscriptJson(highlightsJsonPath, {
          title: titleInfo.title,
          subtitle: titleInfo.subtitle,
          segments: chunkSegments,
          highlights,
        });
        results[`highlights_json_${suffix}`] = highlightsJsonPath;

        if (wantSrt) {
          const srtPath = path.join(outputDir, `${videoName}_${suffix}_subtitles.srt`);
          await writeText(
            srtPath,
            segmentsToSrt(chunkSegments.filter((s) => s.text.trim().length > 0)),
          );
          results[`srt_${suffix}`] = srtPath;
        }

        let subtitlePath: string | null = null;
        if (wantAss || wantVideo) {
          subtitlePath = wantAss
            ? path.join(outputDir, `${videoName}_${suffix}_subtitles.ass`)
            : path.join(tmpDir, `${videoName}_${suffix}_subtitles.ass`);
          await generateAssSubtitle({
            highlights,
            segments: chunkSegments,
            outputPath: subtitlePath,
            translate,
            sourceLang,
            targetLang,
            orientation,
            subtitlePosition,
            firstSubtitleDelay,
            translateFn,
            ...(originalSubtitleColor !== undefined ? { originalSubtitleColor } : {}),
            ...(translationSubtitleColor !== undefined ? { translationSubtitleColor } : {}),
            ...(highlightSubtitleColor !== undefined ? { highlightSubtitleColor } : {}),
          });
          if (wantAss) results[`subtitles_${suffix}`] = subtitlePath;
        }

        if (wantFcpxml) {
          const fcpxmlPath = path.join(outputDir, `${videoName}_${suffix}.fcpxml`);
          await generateFcpxml({
            videoPath,
            highlights,
            segments: chunkSegments,
            outputPath: fcpxmlPath,
            frameRate: fcpxmlFrameRate,
            speed: fcpxmlSpeed,
            translate,
            sourceLang,
            targetLang,
            orientation,
            enableClip: true,
            filterEmptySegments,
            translateFn,
            ...(originalSubtitleColor !== undefined ? { originalSubtitleColor } : {}),
            ...(translationSubtitleColor !== undefined ? { translationSubtitleColor } : {}),
            ...(highlightSubtitleColor !== undefined ? { highlightSubtitleColor } : {}),
          });
          results[`fcpxml_${suffix}`] = fcpxmlPath;
        }

        if (wantVideo && subtitlePath) {
          if (!getVideoDimensions) {
            throw new Error("processVideo requires getVideoDimensions to render video output");
          }
          const finalVideoPath = path.join(outputDir, `${videoName}_${suffix}_final.mp4`);
          await renderVideoWithSubtitles({
            videoPath,
            highlights,
            subtitlePath,
            outputPath: finalVideoPath,
            orientation,
            getDimensions: getVideoDimensions,
          });
          results[`final_video_${suffix}`] = finalVideoPath;
        }
      }
    } else {
      const chunks = splitTranscriptSegments(subtitleSegments, segmentDuration);
      const merged: Segment[] = chunks.flat();
      if (merged.length === 0) {
        return results;
      }

      const allKeywords: Array<{ segment_id: number; keywords: string[] }> = [];
      if (enableHighlight && analysisClient) {
        console.log("🔍 Extracting keywords via LLM…");
        let offset = 0;
        for (const chunk of chunks) {
          const chunkKws = await extractKeywordsForSegments(
            analysisClient,
            chunk,
            sourceLang,
            targetLang,
          );
          for (const kw of chunkKws) {
            allKeywords.push({
              segment_id: kw.segment_id + offset,
              keywords: kw.keywords,
            });
          }
          offset += chunk.length;
        }
      }

      const kwLookup = new Map<number, string[]>();
      for (const kw of allKeywords) kwLookup.set(kw.segment_id, kw.keywords);

      const mergedHighlights: Highlight[] = filterFillers
        ? merged.map((seg, idx) =>
            createHighlight({
              start: seg.start,
              end: seg.end,
              segment_keywords: kwLookup.has(idx)
                ? [{ segment_id: idx, keywords: kwLookup.get(idx) ?? [] }]
                : [],
            }),
          )
        : [
            createHighlight({
              start: merged[0]?.start ?? 0,
              end: merged[merged.length - 1]?.end ?? 0,
              title: transcriptMeta.title,
              subtitle: transcriptMeta.subtitle,
              segment_keywords: allKeywords,
            }),
          ];

      if (wantSrt) {
        const srtPath = path.join(outputDir, `${videoName}_subtitles.srt`);
        await writeText(
          srtPath,
          segmentsToSrt(merged.filter((s) => s.text.trim().length > 0)),
        );
        results.srt = srtPath;
      }

      let subtitlePath: string | null = null;
      if (wantAss || wantVideo) {
        subtitlePath = wantAss
          ? path.join(outputDir, `${videoName}_subtitles.ass`)
          : path.join(tmpDir, `${videoName}_subtitles.ass`);
        await generateAssSubtitle({
          highlights: mergedHighlights,
          segments: merged,
          outputPath: subtitlePath,
          translate,
          sourceLang,
          targetLang,
          orientation,
          subtitlePosition,
          firstSubtitleDelay: 0,
          translateFn,
          ...(originalSubtitleColor !== undefined ? { originalSubtitleColor } : {}),
          ...(translationSubtitleColor !== undefined ? { translationSubtitleColor } : {}),
          ...(highlightSubtitleColor !== undefined ? { highlightSubtitleColor } : {}),
        });
        if (wantAss) results.subtitles = subtitlePath;
      }

      if (wantFcpxml) {
        const fcpxmlPath = path.join(outputDir, `${videoName}.fcpxml`);
        await generateFcpxml({
          videoPath,
          highlights: mergedHighlights,
          segments: merged,
          outputPath: fcpxmlPath,
          frameRate: fcpxmlFrameRate,
          speed: fcpxmlSpeed,
          translate,
          sourceLang,
          targetLang,
          orientation,
          enableClip: true,
          filterEmptySegments,
          translateFn,
          ...(originalSubtitleColor !== undefined ? { originalSubtitleColor } : {}),
          ...(translationSubtitleColor !== undefined ? { translationSubtitleColor } : {}),
          ...(highlightSubtitleColor !== undefined ? { highlightSubtitleColor } : {}),
        });
        results.fcpxml = fcpxmlPath;
      }

      if (wantVideo && subtitlePath) {
        if (!getVideoDimensions) {
          throw new Error("processVideo requires getVideoDimensions to render video output");
        }
        const finalVideoPath = path.join(outputDir, `${videoName}_final.mp4`);
        await renderVideoWithSubtitles({
          videoPath,
          highlights: mergedHighlights,
          subtitlePath,
          outputPath: finalVideoPath,
          orientation,
          getDimensions: getVideoDimensions,
        });
        results.final_video = finalVideoPath;
      }
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  return results;
}
