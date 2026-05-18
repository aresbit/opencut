import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AsrHelper } from "../asr/helper.ts";
import type { AudioSlicer } from "../asr/types.ts";
import { createFfmpegSlicer } from "../asr/audio.ts";
import type { Segment } from "../models.ts";

export interface TranscribeAudioOptions {
  audioPath: string;
  helper: AsrHelper;
  segmentDuration: number;
  maxChars: number;
  sourceLang: string;
  getDuration: (audioPath: string) => Promise<number>;
  slicer?: AudioSlicer;
}

export async function transcribeAudio(opts: TranscribeAudioOptions): Promise<Segment[]> {
  const {
    audioPath,
    helper,
    segmentDuration,
    maxChars,
    sourceLang,
    getDuration,
    slicer = createFfmpegSlicer(),
  } = opts;
  const duration = await getDuration(audioPath);
  if (duration <= segmentDuration) {
    return helper.transcribeWithVad(audioPath, { maxChars, sourceLang });
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pycut-chunks-"));
  try {
    const numChunks = Math.ceil(duration / segmentDuration);
    const all: Segment[] = [];
    for (let i = 0; i < numChunks; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, duration);
      const slice = await slicer.slice(audioPath, startTime, endTime);
      try {
        const segs = await helper.transcribeWithVad(slice.path, {
          timeOffset: startTime,
          maxChars,
          sourceLang,
        });
        all.push(...segs);
      } finally {
        await slice.cleanup();
      }
    }
    return all;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
