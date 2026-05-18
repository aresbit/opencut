export const DEFAULT_MODEL = "gpt-4o-mini";
export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const HTTP_TIMEOUT_MS = 60_000;

export interface AnalysisClient {
  model: string;
  chat(prompt: string): Promise<string>;
}

export interface CreateClientOptions {
  apiKey: string | null | undefined;
  baseUrl?: string | null;
  model?: string | null;
  timeoutMs?: number;
}

export async function createClient(opts: CreateClientOptions): Promise<AnalysisClient | null> {
  if (!opts.apiKey) return null;

  let OpenAICtor: typeof import("openai").OpenAI;
  try {
    const mod = await import("openai");
    OpenAICtor = mod.OpenAI;
  } catch {
    return null;
  }

  const client = new OpenAICtor({
    apiKey: opts.apiKey,
    baseURL: opts.baseUrl ?? DEFAULT_BASE_URL,
    timeout: opts.timeoutMs ?? HTTP_TIMEOUT_MS,
  });
  const model = opts.model ?? DEFAULT_MODEL;

  return {
    model,
    async chat(prompt) {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
      });
      return response.choices[0]?.message?.content ?? "";
    },
  };
}

export function extractJsonPayload(text: string): string {
  if (text.includes("```json")) {
    const after = text.split("```json")[1] ?? "";
    return (after.split("```")[0] ?? "").trim();
  }
  if (text.includes("```")) {
    const middle = text.split("```")[1] ?? "";
    return (middle.split("```")[0] ?? "").trim();
  }
  return text.trim();
}
