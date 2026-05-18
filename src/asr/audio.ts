import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import type { AudioSlice, AudioSlicer } from "./types.ts";

export function buildSliceArgs(
  input: string,
  startSec: number,
  endSec: number,
  output: string,
): string[] {
  const duration = Math.max(endSec - startSec, 0);
  return [
    "-ss",
    startSec.toFixed(3),
    "-t",
    duration.toFixed(3),
    "-i",
    input,
    "-acodec",
    "pcm_s16le",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-y",
    output,
  ];
}

let counter = 0;
function tempSlicePath(): string {
  counter += 1;
  return path.join(os.tmpdir(), `pycut-slice-${process.pid}-${Date.now()}-${counter}.wav`);
}

export function createFfmpegSlicer(): AudioSlicer {
  return {
    async slice(audioPath, startSec, endSec): Promise<AudioSlice> {
      const outPath = tempSlicePath();
      await execa("ffmpeg", buildSliceArgs(audioPath, startSec, endSec, outPath));
      return {
        path: outPath,
        async cleanup() {
          try {
            await fs.unlink(outPath);
          } catch {
            /* ignore */
          }
        },
      };
    },
  };
}
