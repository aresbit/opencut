import type { Highlight } from "../models.ts";

export interface VideoDimensions {
  width: number;
  height: number;
}

export function buildSegmentTrimFilters(highlights: readonly Highlight[]): string {
  const parts: string[] = [];
  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];
    if (!h) continue;
    const duration = h.end - h.start;
    parts.push(
      `[0:v]trim=start=${h.start}:duration=${duration},setpts=PTS-STARTPTS[v${i}];`,
      `[0:a]atrim=start=${h.start}:duration=${duration},asetpts=PTS-STARTPTS[a${i}];`,
    );
  }
  return parts.join("");
}

export function buildAudioConcatFilter(n: number): string {
  const inputs = Array.from({ length: n }, (_, i) => `[a${i}]`).join("");
  return `${inputs}concat=n=${n}:v=0:a=1[outa];`;
}

export function buildVideoConcatFilter(n: number): string {
  if (n === 1) return "[v0]copy[concat_v];";
  const inputs = Array.from({ length: n }, (_, i) => `[v${i}]`).join("");
  return `${inputs}concat=n=${n}:v=1:a=0[concat_v];`;
}

export function buildOrientationPadFilter(
  dims: VideoDimensions,
  orientation: "landscape" | "portrait",
): string | null {
  const { width, height } = dims;
  if (orientation === "portrait" && width > height) {
    const targetHeight = Math.trunc((width * 16) / 9);
    const padY = Math.trunc((targetHeight - height) / 2);
    return `pad=${width}:${targetHeight}:0:${padY}:black`;
  }
  if (orientation === "landscape" && height > width) {
    const targetWidth = Math.trunc((height * 16) / 9);
    const padX = Math.trunc((targetWidth - width) / 2);
    return `pad=${targetWidth}:${height}:${padX}:0:black`;
  }
  return null;
}

export function buildScaleFilter(target: string | null | undefined): string | null {
  if (!target) return null;
  if (target.endsWith("p")) {
    const num = target.slice(0, -1);
    return `scale=${num}:-1`;
  }
  return `scale=${target}`;
}

export interface BuildFilterComplexOptions {
  highlights: readonly Highlight[];
  dimensions: VideoDimensions;
  orientation: "landscape" | "portrait";
  targetResolution?: string | null;
  subtitlePath: string;
}

export function buildFilterComplex(opts: BuildFilterComplexOptions): string {
  const { highlights, dimensions, orientation, targetResolution, subtitlePath } = opts;
  const parts: string[] = [
    buildSegmentTrimFilters(highlights),
    buildAudioConcatFilter(highlights.length),
    buildVideoConcatFilter(highlights.length),
  ];

  const videoFilters: string[] = [];
  const pad = buildOrientationPadFilter(dimensions, orientation);
  if (pad) videoFilters.push(pad);
  const scale = buildScaleFilter(targetResolution);
  if (scale) videoFilters.push(scale);
  videoFilters.push(`ass=filename=${subtitlePath}`);

  parts.push(`[concat_v]${videoFilters.join(",")}[vout];`);
  return parts.join("");
}
