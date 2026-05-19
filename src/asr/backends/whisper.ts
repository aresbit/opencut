import { promises as fs } from "node:fs";
import type { AsrBackend, AsrResult, AsrWord } from "../types.ts";

export interface WhisperBackendOptions {
  modelPath: string;
  language?: string;
  /** Maximum words per segment hint passed to whisper.cpp. */
  maxLen?: number;
  /**
   * Enable GPU offload (CUDA / Metal). Defaults to `true` to match
   * smart-whisper, which silently falls back to CPU when no GPU is
   * available. Set to `false` to force CPU and skip the detection cost.
   */
  gpu?: boolean;
}

interface SmartWhisperModule {
  Whisper: new (modelPath: string, opts?: { gpu?: boolean }) => {
    transcribe(
      audio: Float32Array,
      params?: Record<string, unknown>,
    ): Promise<{ result: Promise<Array<{ text: string; from: number; to: number }>> }>;
    free(): Promise<void>;
  };
}

async function loadWavAsFloat32(path: string): Promise<Float32Array> {
  const buf = await fs.readFile(path);
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`Not a RIFF/WAVE file: ${path}`);
  }
  let offset = 12;
  let fmtChannels = 0;
  let fmtBits = 0;
  let dataOffset = -1;
  let dataLen = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      fmtChannels = buf.readUInt16LE(offset + 10);
      fmtBits = buf.readUInt16LE(offset + 22);
    } else if (id === "data") {
      dataOffset = offset + 8;
      dataLen = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataOffset < 0) throw new Error(`No data chunk in WAV: ${path}`);
  if (fmtBits !== 16 || fmtChannels !== 1) {
    throw new Error(`Expected 16-bit mono WAV, got ${fmtBits}-bit ${fmtChannels}-channel`);
  }
  const sampleCount = Math.floor(dataLen / 2);
  const pcm = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    pcm[i] = buf.readInt16LE(dataOffset + i * 2) / 32768;
  }
  return pcm;
}

async function loadSmartWhisper(): Promise<SmartWhisperModule> {
  try {
    return (await import("smart-whisper")) as unknown as SmartWhisperModule;
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new Error(
      "Whisper ASR requires the smart-whisper package " +
        "(install with: bun add smart-whisper). " +
        `Original import error: ${detail}`,
      err instanceof Error ? { cause: err } : undefined,
    );
  }
}

export function createWhisperBackend(opts: WhisperBackendOptions): AsrBackend {
  let whisper: Awaited<ReturnType<SmartWhisperModule["Whisper"]["prototype"]["transcribe"]>> extends never
    ? never
    : InstanceType<SmartWhisperModule["Whisper"]> | null = null;

  async function ensureLoaded() {
    if (whisper) return whisper;
    const mod = await loadSmartWhisper();
    whisper = new mod.Whisper(opts.modelPath, { gpu: opts.gpu ?? true });
    return whisper;
  }

  return {
    async transcribe(audioPath, { sourceLang }): Promise<AsrResult> {
      const w = await ensureLoaded();
      const pcm = await loadWavAsFloat32(audioPath);
      const handle = await w.transcribe(pcm, {
        language: opts.language ?? sourceLang,
        token_timestamps: true,
        max_len: opts.maxLen ?? 1,
      });
      const segments = await handle.result;

      const words: AsrWord[] = segments
        .map((s) => ({
          text: String(s.text ?? "").trim(),
          start: Number(s.from ?? 0) / 1000,
          end: Number(s.to ?? 0) / 1000,
        }))
        .filter((w) => w.text.length > 0);

      const text = words.map((w) => w.text).join(" ");
      return { text, words };
    },

    async unload() {
      if (whisper) {
        await whisper.free();
        whisper = null;
      }
    },
  };
}
