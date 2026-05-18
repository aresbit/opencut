import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expandVideoInputs, isMediaPath } from "./inputs.ts";

async function mkTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "pycut-io-"));
}

describe("isMediaPath", () => {
  it("accepts known media extensions case-insensitively", () => {
    expect(isMediaPath("clip.MP4")).toBe(true);
    expect(isMediaPath("/abs/path/AUDIO.flac")).toBe(true);
  });

  it("rejects unknown extensions", () => {
    expect(isMediaPath("notes.txt")).toBe(false);
    expect(isMediaPath("noext")).toBe(false);
  });
});

describe("expandVideoInputs", () => {
  let dir = "";

  beforeEach(async () => {
    dir = await mkTempDir();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function touch(rel: string): Promise<string> {
    const full = path.join(dir, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, "");
    return full;
  }

  it("expands a directory to its media files recursively, sorted", async () => {
    await touch("b.mov");
    await touch("nested/a.mp4");
    await touch("ignore.txt");
    const out = await expandVideoInputs([dir]);
    expect(out.map((p) => path.relative(dir, p))).toEqual(["b.mov", "nested/a.mp4"]);
  });

  it("expands a glob pattern case-insensitively", async () => {
    await touch("clip.MP4");
    await touch("notes.txt");
    const out = await expandVideoInputs([path.join(dir, "*.mp4")]);
    expect(out).toHaveLength(1);
    expect(path.basename(out[0] ?? "")).toBe("clip.MP4");
  });

  it("returns a single file when path is a media file", async () => {
    const file = await touch("a.wav");
    const out = await expandVideoInputs([file]);
    expect(out).toEqual([path.resolve(file)]);
  });

  it("dedupes overlapping inputs", async () => {
    const file = await touch("a.mp4");
    const out = await expandVideoInputs([file, file, dir]);
    expect(out).toEqual([path.resolve(file)]);
  });

  it("yields empty for non-existent paths", async () => {
    const out = await expandVideoInputs([path.join(dir, "missing.mp4")]);
    expect(out).toEqual([]);
  });
});
