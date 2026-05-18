import { promises as fs } from "node:fs";
import path from "node:path";
import { execa } from "execa";
import type { Highlight } from "../models.ts";
import {
  type BuildFilterComplexOptions,
  type VideoDimensions,
  buildFilterComplex,
} from "./filter-complex.ts";
import { selectFfmpegBinary, selectVideoEncoder } from "./select.ts";

export interface RenderVideoOptions {
  videoPath: string;
  highlights: readonly Highlight[];
  subtitlePath: string;
  outputPath: string;
  orientation?: "landscape" | "portrait";
  targetResolution?: string | null;
  getDimensions: (videoPath: string) => Promise<VideoDimensions>;
  ffmpegBinary?: string;
  videoEncoder?: string;
}

export function buildFfmpegRenderArgs(
  filterComplex: string,
  videoPath: string,
  outputPath: string,
  videoEncoder: string,
): string[] {
  const args: string[] = [
    "-i",
    videoPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[vout]",
    "-map",
    "[outa]",
    "-c:v",
    videoEncoder,
  ];
  if (videoEncoder !== "h264_videotoolbox") {
    args.push("-profile:v", "main");
  }
  args.push(
    "-b:v",
    "6000k",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-max_muxing_queue_size",
    "9999",
    "-hide_banner",
    "-loglevel",
    "error",
    "-stats",
    "-y",
    outputPath,
  );
  return args;
}

export async function copyToSafeAsciiPath(subtitlePath: string): Promise<string> {
  const dir = path.dirname(subtitlePath);
  const safePath = path.join(dir, "safe_sub.ass");
  await fs.copyFile(subtitlePath, safePath);
  return safePath;
}

export async function renderVideoWithSubtitles(opts: RenderVideoOptions): Promise<string> {
  const {
    videoPath,
    highlights,
    subtitlePath,
    outputPath,
    orientation = "landscape",
    targetResolution = null,
    getDimensions,
  } = opts;
  const dimensions = await getDimensions(videoPath);
  const safeSubtitle = await copyToSafeAsciiPath(subtitlePath);
  const filterOpts: BuildFilterComplexOptions = {
    highlights,
    dimensions,
    orientation,
    targetResolution,
    subtitlePath: safeSubtitle,
  };
  const filterComplex = buildFilterComplex(filterOpts);

  const videoEncoder = opts.videoEncoder ?? selectVideoEncoder();
  const ffmpegBinary = opts.ffmpegBinary ?? (await selectFfmpegBinary());
  const args = buildFfmpegRenderArgs(filterComplex, videoPath, outputPath, videoEncoder);

  await execa(ffmpegBinary, args);
  return outputPath;
}
