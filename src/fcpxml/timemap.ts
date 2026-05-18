export function buildFcpxmlTimemap(
  startF: number,
  timelineDurF: number,
  sourceDurF: number,
  fpsInt: number,
): string {
  const t0 = startF;
  const t1 = startF + timelineDurF;
  const v1 = startF + sourceDurF;
  return [
    "              <timeMap>",
    `                <timept time="${t0}/${fpsInt}s" value="${t0}/${fpsInt}s" interp="linear"/>`,
    `                <timept time="${t1}/${fpsInt}s" value="${v1}/${fpsInt}s" interp="linear"/>`,
    "              </timeMap>",
  ].join("\n");
}
