import type { AsrBackend, AsrResult, AsrWord } from "../types.ts";

export interface WhisperBackendOptions {
  modelPath: string;
  language?: string;
  /** Maximum words per segment hint passed to whisper.cpp. */
  maxLen?: number;
}

interface SmartWhisperModule {
  Whisper: new (modelPath: string, opts?: { gpu?: boolean }) => {
    transcribe(
      audio: string | Float32Array,
      params?: Record<string, unknown>,
    ): Promise<{ result: Promise<Array<{ text: string; from: number; to: number }>> }>;
    free(): Promise<void>;
  };
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
    whisper = new mod.Whisper(opts.modelPath);
    return whisper;
  }

  return {
    async transcribe(audioPath, { sourceLang }): Promise<AsrResult> {
      const w = await ensureLoaded();
      const handle = await w.transcribe(audioPath, {
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
