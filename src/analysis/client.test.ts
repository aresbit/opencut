import { describe, expect, it } from "bun:test";
import { createClient, extractJsonPayload } from "./client.ts";

describe("extractJsonPayload", () => {
  it("returns text trimmed when there is no fence", () => {
    expect(extractJsonPayload("  {} ")).toBe("{}");
  });

  it("strips ```json fenced blocks", () => {
    const text = '```json\n{"a":1}\n```';
    expect(extractJsonPayload(text)).toBe('{"a":1}');
  });

  it("strips bare ``` fenced blocks", () => {
    const text = '```\n{"a":1}\n```';
    expect(extractJsonPayload(text)).toBe('{"a":1}');
  });
});

describe("createClient", () => {
  it("returns null when no api key is provided", async () => {
    expect(await createClient({ apiKey: "" })).toBeNull();
    expect(await createClient({ apiKey: null })).toBeNull();
    expect(await createClient({ apiKey: undefined })).toBeNull();
  });
});
