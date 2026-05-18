import { describe, expect, it } from "bun:test";
import { selectFfmpegBinary, selectVideoEncoder } from "./select.ts";

describe("selectVideoEncoder", () => {
  it("returns videotoolbox on darwin", () => {
    expect(selectVideoEncoder("darwin")).toBe("h264_videotoolbox");
  });

  it("returns libx264 elsewhere", () => {
    expect(selectVideoEncoder("linux")).toBe("libx264");
    expect(selectVideoEncoder("win32")).toBe("libx264");
  });
});

describe("selectFfmpegBinary", () => {
  it("returns the first candidate whose probe succeeds", async () => {
    const seen: string[] = [];
    const probe = async (bin: string) => {
      seen.push(bin);
      return bin === "ffmpeg-full";
    };
    const out = await selectFfmpegBinary(["custom", "ffmpeg-full", "ffmpeg"], probe);
    expect(out).toBe("ffmpeg-full");
    expect(seen).toEqual(["custom", "ffmpeg-full"]);
  });

  it("falls back to plain ffmpeg when no candidate matches", async () => {
    const out = await selectFfmpegBinary(["a", "b"], async () => false);
    expect(out).toBe("ffmpeg");
  });
});
