import { describe, expect, it } from "bun:test";
import { buildFcpxmlTimemap } from "./timemap.ts";

describe("buildFcpxmlTimemap", () => {
  it("produces start and end timepts mapping clip-local to source time", () => {
    const out = buildFcpxmlTimemap(0, 25, 30, 25);
    expect(out).toContain('time="0/25s"');
    expect(out).toContain('time="25/25s"');
    expect(out).toContain('value="30/25s"');
  });
});
