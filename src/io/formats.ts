export const SUPPORTED_OUTPUT_FORMATS = ["ass", "srt", "fcpxml", "video", "txt", "json"] as const;
export type OutputFormat = (typeof SUPPORTED_OUTPUT_FORMATS)[number];

export const DEFAULT_OUTPUT_FORMATS: readonly OutputFormat[] = ["srt"];

const SUPPORTED_SET = new Set<string>(SUPPORTED_OUTPUT_FORMATS);

function isOutputFormat(value: string): value is OutputFormat {
  return SUPPORTED_SET.has(value);
}

export function parseOutputFormats(raw: string | null | undefined): OutputFormat[] {
  if (raw == null) return [...DEFAULT_OUTPUT_FORMATS];

  const parts = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error("output format list is empty");
  }

  const seen = new Set<OutputFormat>();
  const out: OutputFormat[] = [];
  for (const value of parts) {
    if (!isOutputFormat(value)) {
      throw new Error(
        `unsupported format '${value}', supported formats: ${SUPPORTED_OUTPUT_FORMATS.join(", ")}`,
      );
    }
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

export function normalizeOutputFormats(
  value: string | readonly string[] | null | undefined,
): OutputFormat[] {
  if (value == null) return [...DEFAULT_OUTPUT_FORMATS];
  if (typeof value === "string") return parseOutputFormats(value);
  return parseOutputFormats(value.map(String).join(","));
}
