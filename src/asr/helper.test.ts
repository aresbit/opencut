import { describe, expect, it } from "bun:test";
import { AsrHelper } from "./helper.ts";
import type { AsrBackend, AsrResult, AudioSlicer, VadBackend, VadSpan } from "./types.ts";

function fakeAsr(result: AsrResult | (() => AsrResult)): AsrBackend & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async transcribe(audioPath) {
      calls.push(audioPath);
      return typeof result === "function" ? result() : result;
    },
    async unload() {},
  };
}

function fakeVad(spans: VadSpan[]): VadBackend {
  return {
    async detectSpeech() {
      return spans;
    },
    async unload() {},
  };
}

const identitySlicer: AudioSlicer = {
  async slice(audioPath, _start, _end) {
    return {
      path: audioPath,
      cleanup: async () => {},
    };
  },
};

describe("AsrHelper.transcribeAudio", () => {
  it("returns [] when ASR yields empty text", async () => {
    const helper = new AsrHelper({ asr: fakeAsr({ text: "  ", words: [] }) });
    expect(await helper.transcribeAudio("a.wav")).toEqual([]);
  });

  it("falls back to a single segment using getDuration when no words are aligned", async () => {
    const helper = new AsrHelper({
      asr: fakeAsr({ text: "hello world", words: [] }),
      getDuration: async () => 3.5,
    });
    const segs = await helper.transcribeAudio("a.wav", { timeOffset: 10 });
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ start: 10, end: 13.5, text: "hello world" });
  });

  it("throws when no words are aligned and no getDuration is provided", async () => {
    const helper = new AsrHelper({ asr: fakeAsr({ text: "hello", words: [] }) });
    await expect(helper.transcribeAudio("a.wav")).rejects.toThrow(/getDuration/);
  });

  it("applies time offset to word timestamps and splits on punctuation", async () => {
    const helper = new AsrHelper({
      asr: fakeAsr({
        text: "Hello, world.",
        words: [
          { text: "Hello", start: 0, end: 0.5 },
          { text: "world", start: 0.6, end: 1.0 },
        ],
      }),
    });
    const segs = await helper.transcribeAudio("a.wav", { timeOffset: 5 });
    expect(segs).toHaveLength(2);
    expect(segs[0]?.text).toBe("Hello");
    expect(segs[0]?.start).toBe(5);
    expect(segs[1]?.text).toBe("world");
    expect(segs[1]?.end).toBeCloseTo(6.0, 5);
  });

  it("filters filler words when enabled", async () => {
    const helper = new AsrHelper({
      asr: fakeAsr({
        text: "um hello world",
        words: [
          { text: "um", start: 0, end: 0.2 },
          { text: "hello", start: 0.2, end: 0.6 },
          { text: "world", start: 0.6, end: 1.0 },
        ],
      }),
      filterFillers: true,
    });
    const segs = await helper.transcribeAudio("a.wav");
    expect(segs).toHaveLength(1);
    expect(segs[0]?.words.map((w) => w.word)).toEqual(["hello", "world"]);
  });

  it("keeps filler words when disabled", async () => {
    const helper = new AsrHelper({
      asr: fakeAsr({
        text: "um hello",
        words: [
          { text: "um", start: 0, end: 0.2 },
          { text: "hello", start: 0.2, end: 0.6 },
        ],
      }),
      filterFillers: false,
    });
    const segs = await helper.transcribeAudio("a.wav");
    expect(segs[0]?.words.map((w) => w.word)).toEqual(["um", "hello"]);
  });
});

describe("AsrHelper.transcribeWithVad", () => {
  it("returns [] when VAD finds nothing", async () => {
    const helper = new AsrHelper({
      asr: fakeAsr({ text: "x", words: [] }),
      vad: fakeVad([]),
      slicer: identitySlicer,
    });
    expect(await helper.transcribeWithVad("a.wav")).toEqual([]);
  });

  it("falls back to single-file ASR when no VAD is configured", async () => {
    const asr = fakeAsr({
      text: "Hello.",
      words: [{ text: "Hello", start: 0, end: 0.5 }],
    });
    const helper = new AsrHelper({ asr });
    const segs = await helper.transcribeWithVad("a.wav");
    expect(segs).toHaveLength(1);
    expect(asr.calls).toEqual(["a.wav"]);
  });

  it("runs ASR for each VAD span and accumulates with the right offsets", async () => {
    const asr = fakeAsr({
      text: "Hi.",
      words: [{ text: "Hi", start: 0, end: 0.3 }],
    });
    const helper = new AsrHelper({
      asr,
      vad: fakeVad([
        { start: 1, end: 2 },
        { start: 5, end: 6 },
      ]),
      slicer: identitySlicer,
    });
    const segs = await helper.transcribeWithVad("a.wav", { timeOffset: 10 });
    expect(asr.calls).toHaveLength(2);
    expect(segs[0]?.start).toBe(11);
    expect(segs[1]?.start).toBe(15);
  });

  it("skips VAD spans that are shorter than minSpeechSamples", async () => {
    const asr = fakeAsr({
      text: "Hi.",
      words: [{ text: "Hi", start: 0, end: 0.05 }],
    });
    const helper = new AsrHelper({
      asr,
      vad: fakeVad([
        { start: 0, end: 0.05 },
        { start: 1, end: 2 },
      ]),
      slicer: identitySlicer,
    });
    const segs = await helper.transcribeWithVad("a.wav");
    expect(asr.calls).toHaveLength(1);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.start).toBe(1);
  });

  it("cleans up each slice after ASR even when ASR throws", async () => {
    const cleaned: string[] = [];
    const slicer: AudioSlicer = {
      async slice(audioPath, _s, _e) {
        return {
          path: `${audioPath}.slice`,
          cleanup: async () => {
            cleaned.push(audioPath);
          },
        };
      },
    };
    const helper = new AsrHelper({
      asr: {
        async transcribe() {
          throw new Error("boom");
        },
        async unload() {},
      },
      vad: fakeVad([{ start: 0, end: 1 }]),
      slicer,
    });
    await expect(helper.transcribeWithVad("a.wav")).rejects.toThrow(/boom/);
    expect(cleaned).toEqual(["a.wav"]);
  });
});
