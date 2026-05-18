import { execa } from "execa";

export function buildExtractAudioArgs(input: string, output: string): string[] {
  return [
    "-i",
    input,
    "-vn",
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

export function buildProbeDurationArgs(input: string): string[] {
  return [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    input,
  ];
}

export async function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  await execa("ffmpeg", buildExtractAudioArgs(videoPath, outputPath));
  return outputPath;
}

export async function getAudioDuration(audioPath: string): Promise<number> {
  const { stdout } = await execa("ffprobe", buildProbeDurationArgs(audioPath));
  const value = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(value)) {
    throw new Error(`ffprobe returned non-numeric duration for ${audioPath}: ${stdout}`);
  }
  return value;
}
