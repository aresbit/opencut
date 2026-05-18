export interface TextRun {
  text: string;
  highlighted: boolean;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitSourceTextRuns(text: string, keywords: readonly string[]): TextRun[] {
  if (!text) return [];

  const sorted = [...keywords].filter(Boolean).sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return [{ text, highlighted: false }];
  const pattern = sorted.map(escapeRegex).join("|");
  if (!pattern) return [{ text, highlighted: false }];

  const runs: TextRun[] = [];
  const regex = new RegExp(pattern, "gi");
  let lastEnd = 0;
  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    if (start > lastEnd) {
      const fragment = text.slice(lastEnd, start);
      if (fragment) runs.push({ text: fragment, highlighted: false });
    }
    const matched = match[0];
    if (matched) runs.push({ text: matched, highlighted: true });
    lastEnd = start + matched.length;
  }
  if (lastEnd < text.length) {
    const trailing = text.slice(lastEnd);
    if (trailing) runs.push({ text: trailing, highlighted: false });
  }
  return runs.length > 0 ? runs : [{ text, highlighted: false }];
}
