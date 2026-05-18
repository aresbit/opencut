const ASCII_WORD_RE = /^[A-Za-z0-9]+$/;
const ASCII_CHAR_RE = /[a-zA-Z0-9]/;
const HEX_COLOR_RE = /^#?[0-9A-Fa-f]{6}$/;

export const END_PUNCT = new Set("。！？!?.;；");
export const SOFT_PUNCT = new Set("，,、:：");
export const PUNCT_ALL: ReadonlySet<string> = new Set([...END_PUNCT, ...SOFT_PUNCT]);

export const FILLER_WORDS: ReadonlySet<string> = new Set([
  "um",
  "uh",
  "erm",
  "ah",
  "eh",
  "额",
  "啊",
  "嗯",
  "呃",
  "唔",
]);

const FILLER_TRIM_CHARS = new Set(".,!?;:，。！？；：、");

export function isAsciiWord(text: string): boolean {
  return ASCII_WORD_RE.test(text);
}

export function containsAscii(text: string): boolean {
  return ASCII_CHAR_RE.test(text);
}

export function needsSpace(prevText: string, curText: string): boolean {
  if (!prevText) return false;
  if (containsAscii(curText)) return true;
  return false;
}

function trimChars(input: string, chars: ReadonlySet<string>): string {
  let start = 0;
  let end = input.length;
  while (start < end && chars.has(input[start] as string)) start++;
  while (end > start && chars.has(input[end - 1] as string)) end--;
  return input.slice(start, end);
}

export function normalizeFillerToken(token: string): string {
  return trimChars(token.trim().toLowerCase(), FILLER_TRIM_CHARS);
}

export interface FillerCandidate {
  text: string;
}

export function filterFillerWords<T extends FillerCandidate>(items: Iterable<T>, enabled = true): T[] {
  if (!enabled) return [...items];
  const out: T[] = [];
  for (const item of items) {
    const token = String(item.text ?? "").trim();
    if (!token) continue;
    if (FILLER_WORDS.has(normalizeFillerToken(token))) continue;
    out.push(item);
  }
  return out;
}

export function filterText(text: string, filterFillers = true): string {
  if (!filterFillers) return text;
  let out = text;
  for (const filler of FILLER_WORDS) {
    out = out.replaceAll(filler, "");
  }
  return out;
}

export function normalizeHexColor(value: string): string {
  if (typeof value !== "string" || !HEX_COLOR_RE.test(value.trim())) {
    throw new Error(`Invalid color '${value}'. Expected #RRGGBB.`);
  }
  const normalized = value.trim().toUpperCase();
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}

export function hexColorToAss(value: string): string {
  const normalized = normalizeHexColor(value);
  const rr = normalized.slice(1, 3);
  const gg = normalized.slice(3, 5);
  const bb = normalized.slice(5, 7);
  return `&H00${bb}${gg}${rr}`;
}

function formatChannel(channel: number): string {
  return channel.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function hexColorToFcpxml(value: string): string {
  const normalized = normalizeHexColor(value);
  const channels = [1, 3, 5].map((idx) => Number.parseInt(normalized.slice(idx, idx + 2), 16) / 255);
  return `${channels.map(formatChannel).join(" ")} 1`;
}
