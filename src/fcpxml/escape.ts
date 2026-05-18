export function xmlEscape(value: string, quote = true): string {
  let out = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  if (quote) {
    out = out.replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  }
  return out;
}

export function formatG(n: number): string {
  if (!Number.isFinite(n)) return n.toString();
  if (Number.isInteger(n)) return n.toString();
  let s = n.toPrecision(6);
  if (s.includes(".") && !s.includes("e") && !s.includes("E")) {
    s = s.replace(/0+$/, "").replace(/\.$/, "");
  }
  return s;
}
