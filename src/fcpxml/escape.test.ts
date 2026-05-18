import { describe, expect, it } from "bun:test";
import { formatG, xmlEscape } from "./escape.ts";

describe("xmlEscape", () => {
  it("escapes ampersand, lt, gt always", () => {
    expect(xmlEscape("a & b < c > d", false)).toBe("a &amp; b &lt; c &gt; d");
  });

  it("escapes quotes when quote=true (default)", () => {
    expect(xmlEscape(`Say "hi" & <world>`)).toBe(
      "Say &quot;hi&quot; &amp; &lt;world&gt;",
    );
    expect(xmlEscape("it's")).toBe("it&#x27;s");
  });

  it("leaves quotes alone when quote=false", () => {
    expect(xmlEscape(`a "b"`, false)).toBe(`a "b"`);
  });
});

describe("formatG", () => {
  it("formats integers without a decimal point", () => {
    expect(formatG(0)).toBe("0");
    expect(formatG(66)).toBe("66");
    expect(formatG(60.0)).toBe("60");
  });

  it("trims trailing zeros from finite decimals", () => {
    expect(formatG(52.8)).toBe("52.8");
  });

  it("collapses float-precision noise like 60*1.1 to 66", () => {
    expect(formatG(60 * 1.1)).toBe("66");
  });
});
