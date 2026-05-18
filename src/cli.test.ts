import { describe, expect, it } from "bun:test";
import { buildProgram } from "./cli.ts";
import { VERSION } from "./index.ts";

describe("cli", () => {
  it("registers the program name and version", () => {
    const program = buildProgram();
    expect(program.name()).toBe("pycut");
    expect(program.version()).toBe(VERSION);
  });

  it("declares every output-shaping flag", () => {
    const help = buildProgram().helpInformation();
    for (const flag of [
      "--transcript",
      "--asr-model",
      "--api-key",
      "--base-url",
      "--model",
      "--translate",
      "--source-lang",
      "--target-lang",
      "--orientation",
      "--subtitle-position",
      "--no-clip",
      "--highlight",
      "--correct-words",
      "--format",
      "--fcpxml-frame-rate",
      "--fcpxml-speed",
    ]) {
      expect(help).toContain(flag);
    }
  });
});
