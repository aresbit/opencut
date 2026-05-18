import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildFfmpegRenderArgs, copyToSafeAsciiPath } from "./render.ts";

describe("buildFfmpegRenderArgs", () => {
  it("includes -profile:v main when not on videotoolbox", () => {
    const args = buildFfmpegRenderArgs("FC", "in.mp4", "out.mp4", "libx264");
    expect(args).toContain("-profile:v");
    expect(args).toContain("main");
    expect(args).toEqual(expect.arrayContaining(["-i", "in.mp4", "-y", "out.mp4"]));
  });

  it("omits -profile:v when using videotoolbox", () => {
    const args = buildFfmpegRenderArgs("FC", "in.mp4", "out.mp4", "h264_videotoolbox");
    expect(args).not.toContain("-profile:v");
    expect(args).toContain("-c:v");
    expect(args).toContain("h264_videotoolbox");
  });

  it("places filter_complex right after -i", () => {
    const args = buildFfmpegRenderArgs("FC", "in.mp4", "out.mp4", "libx264");
    const idx = args.indexOf("-filter_complex");
    expect(idx).toBeGreaterThan(0);
    expect(args[idx + 1]).toBe("FC");
  });
});

describe("copyToSafeAsciiPath", () => {
  let dir = "";

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "pycut-render-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("copies the source subtitle file to safe_sub.ass in the same directory", async () => {
    const src = path.join(dir, "spicy 中文 (1).ass");
    await fs.writeFile(src, "ass body", "utf8");
    const safe = await copyToSafeAsciiPath(src);
    expect(safe).toBe(path.join(dir, "safe_sub.ass"));
    expect(await fs.readFile(safe, "utf8")).toBe("ass body");
  });
});
