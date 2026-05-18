import { describe, expect, it } from "bun:test";
import {
  containsAscii,
  filterFillerWords,
  filterText,
  hexColorToAss,
  hexColorToFcpxml,
  isAsciiWord,
  needsSpace,
  normalizeFillerToken,
  normalizeHexColor,
} from "./text.ts";

describe("ascii predicates", () => {
  it("recognizes pure ascii words", () => {
    expect(isAsciiWord("hello")).toBe(true);
    expect(isAsciiWord("hello1")).toBe(true);
    expect(isAsciiWord("你好")).toBe(false);
    expect(isAsciiWord("hello!")).toBe(false);
  });

  it("detects any ascii char", () => {
    expect(containsAscii("That's")).toBe(true);
    expect(containsAscii("你好world")).toBe(true);
    expect(containsAscii("你好")).toBe(false);
  });
});

describe("needsSpace", () => {
  it("returns false on empty previous text", () => {
    expect(needsSpace("", "hello")).toBe(false);
  });
  it("adds space when current contains ascii", () => {
    expect(needsSpace("hello", "world")).toBe(true);
    expect(needsSpace("你好", "world")).toBe(true);
  });
  it("no space between pure CJK", () => {
    expect(needsSpace("世界", "你好")).toBe(false);
    expect(needsSpace("world", "你好")).toBe(false);
  });
});

describe("filler handling", () => {
  it("normalizes filler tokens by stripping punctuation and casing", () => {
    expect(normalizeFillerToken(" Um,")).toBe("um");
    expect(normalizeFillerToken("额。")).toBe("额");
  });

  it("filters items whose text matches a filler word", () => {
    const items = [
      { text: "um" },
      { text: "hello" },
      { text: "uh," },
      { text: "你好" },
      { text: "  " },
    ];
    const kept = filterFillerWords(items);
    expect(kept.map((i) => i.text)).toEqual(["hello", "你好"]);
  });

  it("passes through when disabled", () => {
    const items = [{ text: "um" }, { text: "uh" }];
    expect(filterFillerWords(items, false)).toEqual(items);
  });

  it("strips fillers from raw text", () => {
    expect(filterText("um hello uh world")).toBe(" hello  world");
    expect(filterText("额你好嗯")).toBe("你好");
  });
});

describe("color helpers", () => {
  it("normalizes hex colors with and without leading hash", () => {
    expect(normalizeHexColor("#ffa500")).toBe("#FFA500");
    expect(normalizeHexColor("ffa500")).toBe("#FFA500");
  });

  it("rejects invalid hex colors", () => {
    expect(() => normalizeHexColor("invalid")).toThrow();
    expect(() => normalizeHexColor("#FFF")).toThrow();
    expect(() => normalizeHexColor("#GGGGGG")).toThrow();
  });

  it("converts to ASS BGR format", () => {
    expect(hexColorToAss("#FFA500")).toBe("&H0000A5FF");
    expect(hexColorToAss("#FFFFFF")).toBe("&H00FFFFFF");
    expect(hexColorToAss("#000000")).toBe("&H00000000");
  });

  it("converts to FCPXML float channels with alpha 1", () => {
    expect(hexColorToFcpxml("#FFFFFF")).toBe("1 1 1 1");
    expect(hexColorToFcpxml("#000000")).toBe("0 0 0 1");
    const orange = hexColorToFcpxml("#FFA500");
    const [r, g, b, a] = orange.split(" ");
    expect(r).toBe("1");
    expect(Number(g)).toBeCloseTo(165 / 255, 3);
    expect(b).toBe("0");
    expect(a).toBe("1");
  });
});
