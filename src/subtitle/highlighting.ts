import { DEFAULT_HIGHLIGHT_SUBTITLE_COLOR } from "../config.ts";
import { hexColorToAss } from "../text.ts";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyKeywordHighlighting(
  text: string,
  keywords: readonly string[],
  highlightColor: string = DEFAULT_HIGHLIGHT_SUBTITLE_COLOR,
): string {
  if (keywords.length === 0) return text;

  const start = `{\\c${hexColorToAss(highlightColor)}&\\fscx110\\fscy110}`;
  const end = "{\\r}";

  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(escapeRegex).filter(Boolean);
  if (escaped.length === 0) return text;

  const pattern = new RegExp(escaped.join("|"), "gi");
  return text.replace(pattern, (match) => `${start}${match}${end}`);
}
