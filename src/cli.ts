import { promises as fs } from "node:fs";
import path from "node:path";
import { Command, Option } from "commander";
import { execa } from "execa";
import { createClient } from "./analysis/client.ts";
import { createWhisperBackend } from "./asr/backends/whisper.ts";
import type { AsrBackend, VadBackend } from "./asr/types.ts";
import {
  type ProcessVideoOptions,
  processVideo,
} from "./clipper/process.ts";
import {
  DEFAULT_FCPXML_FRAME_RATE,
  DEFAULT_FCPXML_SPEED,
  DEFAULT_FIRST_SUBTITLE_DELAY,
  DEFAULT_HIGHLIGHT_SUBTITLE_COLOR,
  DEFAULT_MARGIN_LEFT_MS,
  DEFAULT_MARGIN_RIGHT_MS,
  DEFAULT_MAX_CHARS,
  DEFAULT_MAX_DURATION_SECONDS,
  DEFAULT_MAX_SUBTITLE_CHARS,
  DEFAULT_MAX_TITLE_CHARS,
  DEFAULT_ORIGINAL_SUBTITLE_COLOR,
  DEFAULT_SEGMENT_DURATION,
  DEFAULT_TRANSLATION_SUBTITLE_COLOR,
} from "./config.ts";
import { expandVideoInputs } from "./io/inputs.ts";
import { GoogleTranslator, type TranslationBackend } from "./translation.ts";
import { normalizeHexColor } from "./text.ts";
import { VERSION } from "./index.ts";

interface CliOptions {
  transcript?: string;
  outputDir?: string;
  asrModel?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  segmentDuration: string;
  maxDuration: string;
  maxChars: string;
  translate: boolean;
  sourceLang: string;
  targetLang: string;
  orientation: "landscape" | "portrait";
  subtitlePosition: "original-top" | "translated-top";
  originalSubtitleColor: string;
  translationSubtitleColor: string;
  highlightSubtitleColor: string;
  firstSubtitleDelay: string;
  maxTitleChars: string;
  maxSubtitleChars: string;
  clip: boolean;
  highlight: boolean;
  correctWords: boolean;
  filterEmptySegments: boolean;
  filterFillers: boolean;
  marginLeft: string;
  marginRight: string;
  format: string;
  fcpxmlFrameRate: string;
  fcpxmlSpeed: string;
}

function parseFloatStrict(name: string, value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) throw new Error(`${name} expects a number, got '${value}'`);
  return n;
}

function parseIntStrict(name: string, value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) throw new Error(`${name} expects an integer, got '${value}'`);
  return n;
}

function resolveOutputDir(videoPath: string, explicit: string | undefined): string {
  if (explicit) return explicit;
  const parsed = path.parse(path.resolve(videoPath));
  return path.join(parsed.dir, parsed.name);
}

async function getVideoDimensions(videoPath: string): Promise<{ width: number; height: number }> {
  const { stdout } = await execa("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=s=x:p=0",
    videoPath,
  ]);
  const parts = stdout.trim().split("x");
  return { width: Number.parseInt(parts[0] ?? "0", 10), height: Number.parseInt(parts[1] ?? "0", 10) };
}

function buildAsrBackend(modelPath: string | undefined, sourceLang: string): AsrBackend {
  const envModel = process.env.OPENCUT_WHISPER_MODEL ?? process.env.PYCUT_WHISPER_MODEL;
  const resolved = modelPath ?? envModel ?? "";
  if (!resolved) {
    throw new Error(
      "ASR model path is required. Pass --asr-model /path/to/ggml-model.bin " +
        "or set OPENCUT_WHISPER_MODEL (PYCUT_WHISPER_MODEL still works for legacy setups). " +
        "Download GGML weights from https://huggingface.co/ggerganov/whisper.cpp",
    );
  }
  return createWhisperBackend({ modelPath: resolved, language: sourceLang });
}

async function maybeBuildVadBackend(): Promise<VadBackend | undefined> {
  return undefined;
}

function buildTranslator(): TranslationBackend extends never ? never : GoogleTranslator {
  return new GoogleTranslator();
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("opencut")
    .description(
      "AI-powered video clipping CLI.\n\n" +
        "Set OPENAI_API_KEY or pass --api-key to enable highlight extraction.\n" +
        "Use --base-url for any OpenAI-compatible endpoint (Gemini, DeepSeek, Ollama, etc.).",
    )
    .version(VERSION)
    .argument("<video-inputs...>", "Video files, directories, or glob patterns")
    .option("--transcript <file>", "Reuse an existing transcript JSON and skip ASR")
    .option("-o, --output-dir <dir>", "Output directory (default: sibling folder named after each input)")
    .option(
      "--asr-model <path>",
      "Path to a whisper.cpp GGML model file (or set OPENCUT_WHISPER_MODEL; PYCUT_WHISPER_MODEL is honored for backwards compatibility)",
    )
    .option("--api-key <key>", "OpenAI-compatible API key (or set OPENAI_API_KEY)")
    .option("--base-url <url>", "Base URL for OpenAI-compatible API")
    .option("--model <name>", "Model name for LLM analysis")
    .option(
      "--segment-duration <seconds>",
      "Audio chunk size in seconds for long media",
      String(DEFAULT_SEGMENT_DURATION),
    )
    .option(
      "--max-duration <seconds>",
      "Maximum subtitle segment duration",
      String(DEFAULT_MAX_DURATION_SECONDS),
    )
    .option("--max-chars <n>", "Maximum characters per subtitle segment", String(DEFAULT_MAX_CHARS))
    .option("--translate", "Translate subtitles", false)
    .option("--source-lang <code>", "Source language code", "en")
    .option("--target-lang <code>", "Target language code", "en")
    .addOption(
      new Option("--orientation <mode>", "Video orientation")
        .choices(["landscape", "portrait"])
        .default("landscape"),
    )
    .addOption(
      new Option("--subtitle-position <pos>", "Bilingual subtitle stacking")
        .choices(["original-top", "translated-top"])
        .default("translated-top"),
    )
    .option(
      "--original-subtitle-color <hex>",
      "Original subtitle color (#RRGGBB)",
      DEFAULT_ORIGINAL_SUBTITLE_COLOR,
    )
    .option(
      "--translation-subtitle-color <hex>",
      "Translation subtitle color (#RRGGBB)",
      DEFAULT_TRANSLATION_SUBTITLE_COLOR,
    )
    .option(
      "--highlight-subtitle-color <hex>",
      "Keyword highlight color (#RRGGBB)",
      DEFAULT_HIGHLIGHT_SUBTITLE_COLOR,
    )
    .option(
      "--first-subtitle-delay <seconds>",
      "Delay before the first subtitle frame",
      String(DEFAULT_FIRST_SUBTITLE_DELAY),
    )
    .option(
      "--max-title-chars <n>",
      "Maximum highlight title length",
      String(DEFAULT_MAX_TITLE_CHARS),
    )
    .option(
      "--max-subtitle-chars <n>",
      "Maximum highlight subtitle length",
      String(DEFAULT_MAX_SUBTITLE_CHARS),
    )
    .option("--no-clip", "Disable AI highlight extraction; keep the full subtitle timeline")
    .option("--highlight", "Detect subtitle keywords in --no-clip mode (needs API key)", false)
    .option(
      "--correct-words",
      "Use LLM to correct ASR mistakes (needs API key)",
      false,
    )
    .option("--no-filter-empty-segments", "Keep empty subtitle segments")
    .option("--no-filter-fillers", "Keep filler words such as um/uh")
    .option(
      "--margin-left <ms>",
      "Start shift in milliseconds",
      String(DEFAULT_MARGIN_LEFT_MS),
    )
    .option(
      "--margin-right <ms>",
      "End shift in milliseconds",
      String(DEFAULT_MARGIN_RIGHT_MS),
    )
    .option("--format <list>", "Comma-separated output formats", "srt")
    .option(
      "--fcpxml-frame-rate <fps>",
      "FCPXML frame rate",
      String(DEFAULT_FCPXML_FRAME_RATE),
    )
    .option(
      "--fcpxml-speed <multiplier>",
      "FCPXML timeline speed multiplier",
      String(DEFAULT_FCPXML_SPEED),
    )
    .action(async (videoInputs: string[], rawOpts: CliOptions) => {
      const opts = rawOpts;
      const inputs = await expandVideoInputs(videoInputs);
      if (inputs.length === 0) {
        throw new Error("No valid video files found in inputs");
      }
      if (opts.transcript && inputs.length > 1) {
        throw new Error("--transcript can only be used with a single video input");
      }

      const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.GEMINI_API_KEY ?? null;
      console.log(`🔑 Using API Key: ${apiKey ? "Provided" : "Not Provided"}`);

      const analysisClient = await createClient({
        apiKey,
        baseUrl: opts.baseUrl ?? null,
        model: opts.model ?? null,
      });
      const translator = buildTranslator();
      const translateFn = opts.translate
        ? async (texts: readonly string[], src: string, tgt: string) =>
            translator.translateBulk(texts, src, tgt)
        : null;

      const asrBackend = buildAsrBackend(opts.asrModel, opts.sourceLang);
      const vadBackend = await maybeBuildVadBackend();

      for (let i = 0; i < inputs.length; i++) {
        const videoPath = inputs[i];
        if (!videoPath) continue;
        console.log(`\n▶️  [${i + 1}/${inputs.length}] ${videoPath}`);
        const outputDir = resolveOutputDir(videoPath, opts.outputDir);
        const fmt: ProcessVideoOptions = {
          videoPath,
          outputDir,
          asrBackend,
          ...(vadBackend ? { vadBackend } : {}),
          ...(analysisClient ? { analysisClient } : { analysisClient: null }),
          translateFn,
          getVideoDimensions,
          translate: opts.translate,
          sourceLang: opts.sourceLang,
          targetLang: opts.targetLang,
          orientation: opts.orientation,
          subtitlePosition: opts.subtitlePosition,
          firstSubtitleDelay: parseFloatStrict("--first-subtitle-delay", opts.firstSubtitleDelay),
          enableClip: opts.clip,
          enableHighlight: opts.highlight,
          correctWords: opts.correctWords,
          filterEmptySegments: opts.filterEmptySegments,
          filterFillers: opts.filterFillers,
          marginLeft: parseFloatStrict("--margin-left", opts.marginLeft) / 1000,
          marginRight: parseFloatStrict("--margin-right", opts.marginRight) / 1000,
          outputFormats: opts.format,
          fcpxmlFrameRate: parseFloatStrict("--fcpxml-frame-rate", opts.fcpxmlFrameRate),
          fcpxmlSpeed: parseFloatStrict("--fcpxml-speed", opts.fcpxmlSpeed),
          ...(opts.transcript ? { transcriptJsonPath: opts.transcript } : {}),
          originalSubtitleColor: normalizeHexColor(opts.originalSubtitleColor),
          translationSubtitleColor: normalizeHexColor(opts.translationSubtitleColor),
          highlightSubtitleColor: normalizeHexColor(opts.highlightSubtitleColor),
          segmentDuration: parseIntStrict("--segment-duration", opts.segmentDuration),
          maxChars: parseIntStrict("--max-chars", opts.maxChars),
        };
        const result = await processVideo(fmt);
        const finalAudio = await fs
          .stat(path.join(outputDir, "audio.wav"))
          .catch(() => null);
        if (finalAudio) await fs.unlink(path.join(outputDir, "audio.wav"));
        console.log("📦 Output files:");
        for (const [key, value] of Object.entries(result)) {
          console.log(`  - ${key}: ${value}`);
        }
      }
    });

  return program;
}

async function main(argv: string[]): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}

const entry = process.argv[1] ?? "";
const isMain =
  import.meta.url === `file://${entry}` ||
  entry.endsWith("/cli.ts") ||
  entry.endsWith("/cli.js");

if (isMain) {
  main(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
