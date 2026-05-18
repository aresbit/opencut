import { describe, expect, it } from "bun:test";
import { formatAssTime, formatSrtTime } from "./time.ts";

describe("formatAssTime", () => {
  it("formats whole and fractional seconds", () => {
    expect(formatAssTime(0)).toBe("0:00:00.00");
    expect(formatAssTime(1.5)).toBe("0:00:01.50");
    expect(formatAssTime(61.234)).toBe("0:01:01.23");
  });

  it("formats hours", () => {
    expect(formatAssTime(3725.78)).toBe("1:02:05.78");
  });

  it("truncates centiseconds toward zero", () => {
    expect(formatAssTime(0.999)).toBe("0:00:00.99");
  });

  it("clamps negative values to zero", () => {
    expect(formatAssTime(-2)).toBe("0:00:00.00");
  });
});

describe("formatSrtTime", () => {
  it("formats milliseconds with comma separator", () => {
    expect(formatSrtTime(0)).toBe("00:00:00,000");
    expect(formatSrtTime(1.234)).toBe("00:00:01,234");
    expect(formatSrtTime(3725.001)).toBe("01:02:05,001");
  });

  it("rounds millisecond values", () => {
    expect(formatSrtTime(0.4999)).toBe("00:00:00,500");
  });

  it("clamps negatives to zero", () => {
    expect(formatSrtTime(-5)).toBe("00:00:00,000");
  });
});
