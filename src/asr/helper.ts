import type { Segment } from "../models.ts";
import { type AlignedWord, attachPunctuationToWords, splitVadSegmentByPunctuation } from "../segments.ts";
import { filterFillerWords, filterText } from "../text.ts";
import { createFfmpegSlicer } from "./audio.ts";
import {
  type AsrBackend,
  type AsrHelperLogger,
  type AsrResult,
  type AudioSlicer,
  DEFAULT_MAX_CHARS,
  DEFAULT_MIN_SPEECH_SAMPLES,
  type VadBackend,
} from "./types.ts";

export interface AsrHelperOptions {
  asr: AsrBackend;
  vad?: VadBackend;
  slicer?: AudioSlicer;
  filterFillers?: boolean;
  getDuration?: (audioPath: string) => Promise<number>;
  logger?: AsrHelperLogger;
}

export interface TranscribeOptions {
  timeOffset?: number;
  maxChars?: number;
  sourceLang?: string;
}

export interface TranscribeWithVadOptions extends TranscribeOptions {
  minSpeechSamples?: number;
  sampleRate?: number;
}

const NOOP_LOGGER: AsrHelperLogger = { info: () => {} };

export class AsrHelper {
  private readonly asr: AsrBackend;
  private readonly vad: VadBackend | undefined;
  private readonly slicer: AudioSlicer;
  private readonly filterFillers: boolean;
  private readonly getDuration: ((audioPath: string) => Promise<number>) | undefined;
  private readonly logger: AsrHelperLogger;

  constructor(opts: AsrHelperOptions) {
    this.asr = opts.asr;
    this.vad = opts.vad;
    this.slicer = opts.slicer ?? createFfmpegSlicer();
    this.filterFillers = opts.filterFillers ?? true;
    this.getDuration = opts.getDuration;
    this.logger = opts.logger ?? NOOP_LOGGER;
  }

  async transcribeAudio(
    audioPath: string,
    opts: TranscribeOptions = {},
  ): Promise<Segment[]> {
    const timeOffset = opts.timeOffset ?? 0;
    const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
    const sourceLang = opts.sourceLang ?? "en";

    const result = await this.asr.transcribe(audioPath, { sourceLang });
    const rawText = String(result.text ?? "").trim();
    if (!rawText) return [];

    const aligned: AlignedWord[] = (result.words ?? [])
      .map((w) => ({
        text: String(w.text ?? "").trim(),
        start_time: Number(w.start ?? 0) + timeOffset,
        end_time: Number(w.end ?? 0) + timeOffset,
      }))
      .filter((w) => w.text.length > 0);

    if (aligned.length === 0) {
      if (this.getDuration == null) {
        throw new Error(
          "ASR backend returned no word timestamps and no getDuration was provided to AsrHelper",
        );
      }
      const duration = await this.getDuration(audioPath);
      return [
        {
          start: timeOffset,
          end: timeOffset + duration,
          text: rawText,
          words: [],
        },
      ];
    }

    const cleanedText = filterText(rawText, this.filterFillers);
    const filteredAligned = filterFillerWords(aligned, this.filterFillers);
    if (filteredAligned.length === 0) return [];

    const wordsWithPunct = attachPunctuationToWords(filteredAligned, cleanedText);
    const first = filteredAligned[0];
    const last = filteredAligned[filteredAligned.length - 1];
    const segStart = first?.start_time ?? timeOffset;
    const segEnd = last?.end_time ?? timeOffset;
    return splitVadSegmentByPunctuation(wordsWithPunct, segStart, segEnd, maxChars);
  }

  async transcribeWithVad(
    audioPath: string,
    opts: TranscribeWithVadOptions = {},
  ): Promise<Segment[]> {
    if (!this.vad) {
      return this.transcribeAudio(audioPath, opts);
    }

    const timeOffset = opts.timeOffset ?? 0;
    const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
    const sourceLang = opts.sourceLang ?? "en";
    const minSpeechSamples = opts.minSpeechSamples ?? DEFAULT_MIN_SPEECH_SAMPLES;
    const sampleRate = opts.sampleRate ?? 16000;

    const spans = await this.vad.detectSpeech(audioPath);
    this.logger.info(`🔊 VAD detected ${spans.length} speech segments`);
    if (spans.length === 0) return [];

    const all: Segment[] = [];
    for (const span of spans) {
      const durationSamples = Math.floor((span.end - span.start) * sampleRate);
      if (durationSamples < minSpeechSamples) continue;

      const slice = await this.slicer.slice(audioPath, span.start, span.end);
      try {
        const segs = await this.transcribeAudio(slice.path, {
          timeOffset: span.start + timeOffset,
          maxChars,
          sourceLang,
        });
        all.push(...segs);
      } finally {
        await slice.cleanup();
      }
    }

    this.logger.info(`✅ VAD+ASR produced ${all.length} segments`);
    return all;
  }

  async unload(): Promise<void> {
    await this.asr.unload();
    if (this.vad) await this.vad.unload();
  }
}

export type { AsrResult };
