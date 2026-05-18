import { describe, expect, it } from "bun:test";
import { buildProgram } from "./cli.ts";
import { VERSION } from "./index.ts";

describe("cli scaffolding", () => {
  it("registers the program name and version", () => {
    const program = buildProgram();
    expect(program.name()).toBe("pycut");
    expect(program.version()).toBe(VERSION);
  });
});
