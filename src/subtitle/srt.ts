import { formatSrtTime } from "./time.ts";

export interface SrtEntry {
  start: number;
  end: number;
  text: string;
}

export function segmentsToSrt(
  entries: readonly SrtEntry[],
  marginLeft = 0,
  marginRight = 0,
): string {
  const lines: string[] = [];
  let prevEnd = 0;

  entries.forEach((entry, idx) => {
    let st = entry.start + marginLeft;
    let ed = entry.end + marginRight;
    if (st < prevEnd) st = prevEnd;
    if (ed < st) ed = st;
    prevEnd = ed;

    lines.push(String(idx + 1));
    lines.push(`${formatSrtTime(st)} --> ${formatSrtTime(ed)}`);
    lines.push(entry.text);
    lines.push("");
  });

  return `${lines.join("\n").trim()}\n`;
}
