import { describe, expect, it } from "vitest";
import { buildProgram } from "./cli.js";
import { VERSION } from "./index.js";

describe("cli scaffolding", () => {
  it("registers the program name and version", () => {
    const program = buildProgram();
    expect(program.name()).toBe("pycut");
    expect(program.version()).toBe(VERSION);
  });
});
