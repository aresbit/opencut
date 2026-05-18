import { describe, expect, it } from "bun:test";
import {
  type BackendFactory,
  GoogleTranslator,
  type TranslationBackend,
  type TranslatorLogger,
} from "./translation.ts";

function makeLogger(): TranslatorLogger & { warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  return {
    warnings,
    errors,
    warn: (m) => warnings.push(m),
    error: (m) => errors.push(m),
  };
}

class ExitError extends Error {
  constructor(public code: number) {
    super(`exit ${code}`);
  }
}

function terminateThrowing(code: number): never {
  throw new ExitError(code);
}

function makeBackend(
  translate: (texts: readonly string[]) => Promise<string[]>,
): TranslationBackend {
  return {
    async translateBatch(texts) {
      return translate(texts);
    },
  };
}

describe("GoogleTranslator", () => {
  it("returns empty for empty input", async () => {
    const t = new GoogleTranslator({
      backendFactory: async () => makeBackend(async () => []),
    });
    expect(await t.translateBulk([])).toEqual([]);
  });

  it("returns translated texts on success", async () => {
    const backend = makeBackend(async (texts) => texts.map((t) => `${t}-ok`));
    const t = new GoogleTranslator({ backendFactory: async () => backend });
    expect(await t.translateBulk(["a", "b"], "en", "fr")).toEqual(["a-ok", "b-ok"]);
  });

  it("retries up to maxAttempts and succeeds on the final attempt", async () => {
    let calls = 0;
    const backend = makeBackend(async (texts) => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return texts.map((t) => `${t}-ok`);
    });
    const logger = makeLogger();
    const t = new GoogleTranslator({
      backendFactory: async () => backend,
      logger,
      terminate: terminateThrowing,
    });
    expect(await t.translateBulk(["hi"])).toEqual(["hi-ok"]);
    expect(calls).toBe(3);
    expect(logger.warnings).toHaveLength(2);
    expect(logger.errors).toHaveLength(0);
  });

  it("terminates with code 1 after three consecutive failures", async () => {
    const backend = makeBackend(async () => {
      throw new Error("always");
    });
    const logger = makeLogger();
    const t = new GoogleTranslator({
      backendFactory: async () => backend,
      logger,
      terminate: terminateThrowing,
    });
    let caught: ExitError | undefined;
    try {
      await t.translateBulk(["hi"]);
    } catch (e) {
      caught = e as ExitError;
    }
    expect(caught).toBeInstanceOf(ExitError);
    expect(caught?.code).toBe(1);
    expect(logger.warnings).toHaveLength(3);
    expect(logger.errors).toHaveLength(1);
  });

  it("returns originals without terminating when count mismatches", async () => {
    const backend = makeBackend(async () => ["only-one"]);
    const logger = makeLogger();
    let terminated = false;
    const t = new GoogleTranslator({
      backendFactory: async () => backend,
      logger,
      terminate: ((_c: number) => {
        terminated = true;
        throw new ExitError(_c);
      }) as (code: number) => never,
    });
    expect(await t.translateBulk(["a", "b"])).toEqual(["a", "b"]);
    expect(terminated).toBe(false);
    expect(logger.warnings[0]).toMatch(/keeping originals/);
  });

  it("propagates backend factory errors with the helpful import message", async () => {
    const factory: BackendFactory = async () => {
      throw new Error(
        "Translation requires @vitalets/google-translate-api. Original import error: ImportError: blocked",
      );
    };
    const t = new GoogleTranslator({ backendFactory: factory });
    await expect(t.translateBulk(["hi"])).rejects.toThrow(
      /Translation requires @vitalets\/google-translate-api/,
    );
  });

  it("translateText returns the first translated value", async () => {
    const backend = makeBackend(async (texts) => texts.map((t) => `${t}-ok`));
    const t = new GoogleTranslator({ backendFactory: async () => backend });
    expect(await t.translateText("hello", "en", "fr")).toBe("hello-ok");
  });
});
