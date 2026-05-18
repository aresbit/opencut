import { describe, expect, it } from "bun:test";
import { createHighlight } from "../models.ts";
import {
  buildAudioConcatFilter,
  buildFilterComplex,
  buildOrientationPadFilter,
  buildScaleFilter,
  buildSegmentTrimFilters,
  buildVideoConcatFilter,
} from "./filter-complex.ts";

const highlights = [
  createHighlight({ start: 0, end: 5 }),
  createHighlight({ start: 10, end: 12 }),
];

describe("buildSegmentTrimFilters", () => {
  it("emits trim + atrim for each highlight with PTS reset", () => {
    expect(buildSegmentTrimFilters(highlights)).toBe(
      [
        "[0:v]trim=start=0:duration=5,setpts=PTS-STARTPTS[v0];",
        "[0:a]atrim=start=0:duration=5,asetpts=PTS-STARTPTS[a0];",
        "[0:v]trim=start=10:duration=2,setpts=PTS-STARTPTS[v1];",
        "[0:a]atrim=start=10:duration=2,asetpts=PTS-STARTPTS[a1];",
      ].join(""),
    );
  });
});

describe("buildAudioConcatFilter", () => {
  it("concatenates audio inputs", () => {
    expect(buildAudioConcatFilter(2)).toBe("[a0][a1]concat=n=2:v=0:a=1[outa];");
  });
});

describe("buildVideoConcatFilter", () => {
  it("uses copy for a single segment", () => {
    expect(buildVideoConcatFilter(1)).toBe("[v0]copy[concat_v];");
  });

  it("concatenates multiple video segments", () => {
    expect(buildVideoConcatFilter(3)).toBe(
      "[v0][v1][v2]concat=n=3:v=1:a=0[concat_v];",
    );
  });
});

describe("buildOrientationPadFilter", () => {
  it("pads landscape source into portrait frame", () => {
    expect(buildOrientationPadFilter({ width: 1920, height: 1080 }, "portrait")).toBe(
      "pad=1920:3413:0:1166:black",
    );
  });

  it("pads portrait source into landscape frame", () => {
    expect(buildOrientationPadFilter({ width: 1080, height: 1920 }, "landscape")).toBe(
      "pad=3413:1920:1166:0:black",
    );
  });

  it("returns null when no padding is required", () => {
    expect(buildOrientationPadFilter({ width: 1920, height: 1080 }, "landscape")).toBeNull();
    expect(buildOrientationPadFilter({ width: 1080, height: 1920 }, "portrait")).toBeNull();
  });
});

describe("buildScaleFilter", () => {
  it("accepts a Np shortcut", () => {
    expect(buildScaleFilter("720p")).toBe("scale=720:-1");
  });

  it("accepts an explicit WxH", () => {
    expect(buildScaleFilter("1280:720")).toBe("scale=1280:720");
  });

  it("returns null when no target is given", () => {
    expect(buildScaleFilter(null)).toBeNull();
    expect(buildScaleFilter("")).toBeNull();
  });
});

describe("buildFilterComplex", () => {
  it("composes segments, concat, pad/scale, and ass filter", () => {
    const out = buildFilterComplex({
      highlights,
      dimensions: { width: 1920, height: 1080 },
      orientation: "portrait",
      targetResolution: "720p",
      subtitlePath: "/tmp/safe_sub.ass",
    });
    expect(out).toContain("trim=start=0:duration=5");
    expect(out).toContain("concat=n=2:v=0:a=1[outa]");
    expect(out).toContain("concat=n=2:v=1:a=0[concat_v]");
    expect(out).toContain("pad=1920:3413:0:1166:black");
    expect(out).toContain("scale=720:-1");
    expect(out).toContain("ass=filename=/tmp/safe_sub.ass");
    expect(out).toMatch(/\[concat_v\]pad=.+,scale=.+,ass=.+\[vout\];/);
  });

  it("emits only the ass filter when no pad or scale is needed", () => {
    const out = buildFilterComplex({
      highlights: [createHighlight({ start: 0, end: 1 })],
      dimensions: { width: 1920, height: 1080 },
      orientation: "landscape",
      subtitlePath: "/tmp/safe_sub.ass",
    });
    expect(out).toContain("[concat_v]ass=filename=/tmp/safe_sub.ass[vout];");
  });
});
