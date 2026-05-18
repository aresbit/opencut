function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

export function formatAssTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const cs = Math.floor((total - Math.floor(total)) * 100);
  return `${h}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

export function formatSrtTime(seconds: number): string {
  let ms = Math.round(seconds * 1000);
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3_600_000);
  ms %= 3_600_000;
  const m = Math.floor(ms / 60_000);
  ms %= 60_000;
  const s = Math.floor(ms / 1000);
  ms %= 1000;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(ms)}`;
}
