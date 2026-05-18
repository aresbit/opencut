import os from "node:os";
import { execa } from "execa";

export function selectVideoEncoder(platformName: string = os.platform()): string {
  return platformName === "darwin" ? "h264_videotoolbox" : "libx264";
}

export const DEFAULT_FFMPEG_CANDIDATES = [
  "/opt/homebrew/Cellar/ffmpeg-full/8.1/bin/ffmpeg",
  "ffmpeg-full",
  "ffmpeg",
];

export type FfmpegProbe = (binary: string) => Promise<boolean>;

export async function probeFfmpegHasAssSupport(binary: string): Promise<boolean> {
  try {
    const { stdout } = await execa(binary, ["-filters"], { reject: false });
    return stdout.includes(" ass ") || stdout.includes("subtitles");
  } catch {
    return false;
  }
}

export async function selectFfmpegBinary(
  candidates: readonly string[] = DEFAULT_FFMPEG_CANDIDATES,
  probe: FfmpegProbe = probeFfmpegHasAssSupport,
): Promise<string> {
  for (const candidate of candidates) {
    if (await probe(candidate)) return candidate;
  }
  return "ffmpeg";
}
