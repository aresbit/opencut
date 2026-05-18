import { describe, expect, it } from "bun:test";
import { buildExtractAudioArgs, buildProbeDurationArgs } from "./ffmpeg.ts";

describe("buildExtractAudioArgs", () => {
  it("produces the WAV 16kHz mono extraction pipeline", () => {
    expect(buildExtractAudioArgs("in.mp4", "out.wav")).toEqual([
      "-i",
      "in.mp4",
      "-vn",
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-y",
      "out.wav",
    ]);
  });
});

describe("buildProbeDurationArgs", () => {
  it("produces the format=duration query", () => {
    expect(buildProbeDurationArgs("clip.wav")).toEqual([
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      "clip.wav",
    ]);
  });
});
