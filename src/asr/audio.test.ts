import { describe, expect, it } from "bun:test";
import { buildSliceArgs } from "./audio.ts";

describe("buildSliceArgs", () => {
  it("produces seek/duration based ffmpeg args", () => {
    expect(buildSliceArgs("in.wav", 1.5, 4, "out.wav")).toEqual([
      "-ss",
      "1.500",
      "-t",
      "2.500",
      "-i",
      "in.wav",
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

  it("clamps negative duration to zero", () => {
    expect(buildSliceArgs("in.wav", 5, 4, "out.wav").slice(0, 4)).toEqual([
      "-ss",
      "5.000",
      "-t",
      "0.000",
    ]);
  });
});
