import {
  DEFAULT_HIGHLIGHT_SUBTITLE_COLOR,
  DEFAULT_ORIGINAL_SUBTITLE_COLOR,
  DEFAULT_TRANSLATION_SUBTITLE_COLOR,
} from "../config.ts";
import { hexColorToFcpxml } from "../text.ts";
import { formatG, xmlEscape } from "./escape.ts";
import { splitSourceTextRuns } from "./runs.ts";

export interface BuildTitleOptions {
  text: string;
  translation: string;
  offsetFrames: number;
  durationFrames: number;
  fpsInt: number;
  styleId: number;
  orientation: "landscape" | "portrait";
  segmentKeywords?: readonly string[];
  originalSubtitleColor?: string;
  translationSubtitleColor?: string;
  highlightSubtitleColor?: string;
}

export function buildFcpxmlTitle(opts: BuildTitleOptions): string {
  const {
    text,
    translation,
    offsetFrames,
    durationFrames,
    fpsInt,
    styleId,
    orientation,
    segmentKeywords = [],
    originalSubtitleColor = DEFAULT_ORIGINAL_SUBTITLE_COLOR,
    translationSubtitleColor = DEFAULT_TRANSLATION_SUBTITLE_COLOR,
    highlightSubtitleColor = DEFAULT_HIGHLIGHT_SUBTITLE_COLOR,
  } = opts;

  const fontSize = orientation === "landscape" ? 60 : 48;
  const transFontSize = orientation === "landscape" ? 38 : 25;
  const verticalPos = orientation === "landscape" ? -33 : -13;
  const originalColor = hexColorToFcpxml(originalSubtitleColor);
  const translationColor = hexColorToFcpxml(translationSubtitleColor);
  const highlightColor = hexColorToFcpxml(highlightSubtitleColor);
  const nameAttr = (text ? text.slice(0, 50) : `s${styleId}`) || `s${styleId}`;
  const sourceRuns = splitSourceTextRuns(text, segmentKeywords);
  const hasHighlightedSource = sourceRuns.some((r) => r.highlighted);

  const lines: string[] = [
    `              <title ref="r3" name="${xmlEscape(nameAttr)}" lane="1"` +
      ` offset="${offsetFrames}/${fpsInt}s"` +
      ` duration="${durationFrames}/${fpsInt}s">`,
    "                <text>",
  ];

  for (const run of sourceRuns) {
    const ref = run.highlighted ? `ts${styleId}_h` : `ts${styleId}`;
    lines.push(
      `                  <text-style ref="${ref}">${xmlEscape(run.text, false)}</text-style>`,
    );
  }
  if (translation) {
    lines.push("                  <text-style>&#xA;</text-style>");
    lines.push(
      `                  <text-style ref="ts${styleId}_t">${xmlEscape(translation, false)}</text-style>`,
    );
  }
  lines.push("                </text>");

  lines.push(`                <text-style-def id="ts${styleId}">`);
  lines.push(
    `                  <text-style font="Arial Unicode MS" fontSize="${formatG(fontSize)}"` +
      ` fontFace="Regular" fontColor="${originalColor}" bold="1" italic="0"` +
      ' strokeColor="0 0 0 1" strokeWidth="-1"' +
      ' shadowColor="0 0 0 0.5" shadowOffset="2 315" alignment="center"/>',
  );
  lines.push("                </text-style-def>");

  if (hasHighlightedSource) {
    lines.push(`                <text-style-def id="ts${styleId}_h">`);
    lines.push(
      `                  <text-style font="Arial Unicode MS" fontSize="${formatG(fontSize * 1.1)}"` +
        ` fontFace="Regular" fontColor="${highlightColor}" bold="1" italic="0"` +
        ' strokeColor="0 0 0 1" strokeWidth="-1"' +
        ' shadowColor="0 0 0 0.5" shadowOffset="2 315" alignment="center"/>',
    );
    lines.push("                </text-style-def>");
  }

  if (translation) {
    lines.push(`                <text-style-def id="ts${styleId}_t">`);
    lines.push(
      `                  <text-style font="Arial Unicode MS" fontSize="${transFontSize}"` +
        ` fontFace="Regular" fontColor="${translationColor}" bold="0" italic="0"` +
        ' strokeColor="0 0 0 1" strokeWidth="-1"' +
        ' shadowColor="0 0 0 0.5" shadowOffset="2 315" alignment="center"/>',
    );
    lines.push("                </text-style-def>");
  }

  lines.push(`                <adjust-transform position="0 ${verticalPos}"/>`);
  lines.push("              </title>");
  return lines.join("\n");
}
