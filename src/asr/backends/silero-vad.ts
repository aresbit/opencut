import type { VadBackend, VadSpan } from "../types.ts";

export interface SileroVadOptions {
  modelPath?: string;
  minSpeechMs?: number;
  minSilenceMs?: number;
  speechPadMs?: number;
}

interface VadNodeModule {
  NonRealTimeVAD: {
    new (opts?: Record<string, unknown>): {
      run(audio: Float32Array, sampleRate: number): AsyncIterable<{ start: number; end: number }>;
    };
    new_(opts?: Record<string, unknown>): Promise<{
      run(audio: Float32Array, sampleRate: number): AsyncIterable<{ start: number; end: number }>;
    }>;
  };
}

async function loadVadModule(): Promise<VadNodeModule> {
  try {
    return (await import("@ricky0123/vad-node")) as unknown as VadNodeModule;
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new Error(
      "Silero VAD requires the @ricky0123/vad-node package " +
        "(install with: bun add @ricky0123/vad-node onnxruntime-node). " +
        `Original import error: ${detail}`,
      err instanceof Error ? { cause: err } : undefined,
    );
  }
}

async function readWavMono16kHz(_audioPath: string): Promise<Float32Array> {
  throw new Error(
    "createSileroVadBackend requires a Float32Array audio loader. " +
      "Provide one via the loader option or use the helper's slicer + a custom backend.",
  );
}

export interface SileroVadDeps {
  loadAudio?: (audioPath: string) => Promise<Float32Array>;
}

export function createSileroVadBackend(
  opts: SileroVadOptions = {},
  deps: SileroVadDeps = {},
): VadBackend {
  const loader = deps.loadAudio ?? readWavMono16kHz;
  type Vad = Awaited<ReturnType<VadNodeModule["NonRealTimeVAD"]["new_"]>>;
  let vad: Vad | null = null;

  async function ensureLoaded(): Promise<Vad> {
    if (vad) return vad;
    const mod = await loadVadModule();
    vad = await mod.NonRealTimeVAD.new_({
      positiveSpeechThreshold: 0.5,
      negativeSpeechThreshold: 0.35,
      minSpeechFrames: Math.max(1, Math.floor((opts.minSpeechMs ?? 250) / 32)),
      preSpeechPadFrames: Math.max(0, Math.floor((opts.speechPadMs ?? 30) / 32)),
      redemptionFrames: Math.max(1, Math.floor((opts.minSilenceMs ?? 100) / 32)),
    });
    return vad;
  }

  return {
    async detectSpeech(audioPath): Promise<VadSpan[]> {
      const v = await ensureLoaded();
      const samples = await loader(audioPath);
      const spans: VadSpan[] = [];
      for await (const span of v.run(samples, 16000)) {
        spans.push({ start: span.start / 1000, end: span.end / 1000 });
      }
      return spans;
    },

    async unload() {
      vad = null;
    },
  };
}
