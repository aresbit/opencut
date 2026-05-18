export const MAX_CONSECUTIVE_FAILURES = 3;

export interface TranslationBackend {
  translateBatch(texts: readonly string[], opts: { from: string; to: string }): Promise<string[]>;
}

export type BackendFactory = () => Promise<TranslationBackend>;

export interface TranslatorLogger {
  warn(message: string): void;
  error(message: string): void;
}

export interface GoogleTranslatorOptions {
  backendFactory?: BackendFactory;
  maxAttempts?: number;
  terminate?: (code: number) => never;
  logger?: TranslatorLogger;
}

const DEFAULT_LOGGER: TranslatorLogger = {
  warn: (m) => console.warn(m),
  error: (m) => console.error(m),
};

function defaultTerminate(code: number): never {
  process.exit(code);
}

export async function defaultGoogleBackendFactory(): Promise<TranslationBackend> {
  let translate: (text: string, options: { from: string; to: string }) => Promise<{ text: string }>;
  try {
    const mod = (await import("@vitalets/google-translate-api")) as {
      translate: typeof translate;
    };
    translate = mod.translate;
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new Error(
      "Translation requires @vitalets/google-translate-api " +
        "(try: bun add @vitalets/google-translate-api). " +
        `Original import error: ${detail}`,
      err instanceof Error ? { cause: err } : undefined,
    );
  }

  return {
    async translateBatch(texts, { from, to }) {
      const out: string[] = [];
      for (const t of texts) {
        const res = await translate(t, { from, to });
        out.push(String(res.text).trim());
      }
      return out;
    },
  };
}

export class GoogleTranslator {
  private readonly backendFactory: BackendFactory;
  private readonly maxAttempts: number;
  private readonly terminate: (code: number) => never;
  private readonly logger: TranslatorLogger;

  constructor(opts: GoogleTranslatorOptions = {}) {
    this.backendFactory = opts.backendFactory ?? defaultGoogleBackendFactory;
    this.maxAttempts = opts.maxAttempts ?? MAX_CONSECUTIVE_FAILURES;
    this.terminate = opts.terminate ?? defaultTerminate;
    this.logger = opts.logger ?? DEFAULT_LOGGER;
  }

  async translateBulk(
    texts: readonly string[],
    sourceLang = "zh",
    targetLang = "en",
  ): Promise<string[]> {
    if (texts.length === 0) return [];

    const originals = [...texts];
    const backend = await this.backendFactory();
    const preview = (originals[0] ?? "").slice(0, 30);

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const translated = await backend.translateBatch(originals, {
          from: sourceLang,
          to: targetLang,
        });
        if (translated.length !== originals.length) {
          this.logger.warn(
            `⚠️  Translation returned ${translated.length} items for ${originals.length} texts; ` +
              `keeping originals for '${preview}...'`,
          );
          return originals;
        }
        return translated;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `⚠️  Translation attempt ${attempt}/${this.maxAttempts} failed for '${preview}...': ${message}`,
        );
        if (attempt >= this.maxAttempts) {
          this.logger.error("❌ Translation failed 3 consecutive times. Exiting.");
          this.terminate(1);
        }
      }
    }

    return originals; // unreachable
  }

  async translateText(text: string, sourceLang = "zh", targetLang = "en"): Promise<string> {
    const translated = await this.translateBulk([text], sourceLang, targetLang);
    return translated[0] ?? text;
  }
}
