import type { Segment } from "../models.ts";

export interface IdentifiedSegment {
  id: number;
  segment: Segment;
}

function toIdentified(
  segments: readonly Segment[] | readonly IdentifiedSegment[],
): IdentifiedSegment[] {
  if (segments.length === 0) return [];
  const first = segments[0] as Segment | IdentifiedSegment;
  if ("segment" in first && "id" in first) {
    return [...(segments as readonly IdentifiedSegment[])];
  }
  return (segments as readonly Segment[]).map((segment, id) => ({ id, segment }));
}

export function buildTranscription(
  segments: readonly Segment[] | readonly IdentifiedSegment[],
): string {
  return toIdentified(segments)
    .map(({ id, segment }) => `[${segment.start.toFixed(2)}s-${segment.end.toFixed(2)}s] ID:${id} ${segment.text}`)
    .join("\n");
}

const HIGHLIGHTS_JSON_SHAPE = `{
  "highlights": [
    {
      "start": 10.5,
      "end": 45.2,
      "title": "简短吸引人的正标题",
      "subtitle": "可选的副标题",
      "content": "内容摘要",
      "keywords": ["关键词1", "关键词2"],
      "segment_keywords": [
        { "segment_id": 0, "keywords": ["高亮词A", "高亮词B"] },
        { "segment_id": 2, "keywords": ["高亮词C"] }
      ]
    }
  ]
}`;

const SEGMENT_KEYWORDS_JSON_SHAPE = `{
  "segment_keywords": [
    { "segment_id": 0, "keywords": ["高亮词A", "高亮词B"] },
    { "segment_id": 2, "keywords": ["高亮词C"] }
  ]
}`;

const CORRECTIONS_JSON_SHAPE = `{
  "corrections": [
    {"segment_id": 0, "corrected": "修正后的文本"},
    {"segment_id": 3, "corrected": "另一段修正后的文本"}
  ]
}`;

export function buildHighlightsPrompt(
  segments: readonly Segment[] | readonly IdentifiedSegment[],
  targetLang: string,
): string {
  const transcription = buildTranscription(segments);
  return [
    `请分析以下视频字幕内容，从中选出最精彩、最有价值、最吸引人的片段（通常1个片段，不少于 30 秒，不超过 2 分钟）。目标语言为${targetLang}。`,
    "",
    "你的任务是：",
    "1. 识别视频中最精彩、最有价值、最吸引人的片段",
    "2. 每个片段应该围绕一个完整的主题或观点",
    "3. 应该有争议性、发人深省或让大家有共鸣",
    "4. 优先选择包含关键信息、精彩观点或情感高点的片段",
    "5. 创建一个吸引人点击的标题（正标题不超过6字，副标题不超过10字），并为标题提供3-8个关键词",
    "6. 为片段中的每个字幕段（以字幕ID为准）识别0-2个最重要的特定关键词。这些关键词应该适合在字幕原文中高亮显示。",
    "",
    "字幕内容：",
    "",
    transcription,
    "",
    "请按照下面的JSON格式返回你的回答：",
    HIGHLIGHTS_JSON_SHAPE,
    "",
    "重要约束：",
    "- 必须确保返回的是有效JSON格式",
    "- start和end时间必须准确对应转录中的时间戳",
    "- segment_keywords中的segment_id必须与原字幕ID（0开始的索引）匹配",
    "- 每个片段的涵盖的字幕ID应该是连续的，确保内容的连贯性",
    "- 片段不应重叠",
    "- 如果视频较短（<3分钟），可以只提取1-2个片段",
    "- 每个字幕段最多识别2个关键词，关键词应该是原文中的词语（不是概括）",
    "",
    "只返回JSON，不要包含其他文字。",
  ].join("\n");
}

export function buildSegmentKeywordsPrompt(
  segments: readonly Segment[],
  targetLang: string,
): string {
  const transcription = buildTranscription(segments);
  return [
    `请分析以下视频字幕内容，为每个字幕段识别最重要的关键词，用于高亮显示。目标语言为${targetLang}。`,
    "",
    "你的任务是：",
    "1. 为每个字幕段（以ID为准）识别0-2个最重要的特定关键词",
    "2. 关键词应该是字幕原文中的词语（不是概括），适合在原文中高亮显示",
    "3. 不需要提取片段时间范围，只需识别关键词",
    "",
    "字幕内容：",
    "",
    transcription,
    "",
    "请按照下面的JSON格式返回你的回答：",
    SEGMENT_KEYWORDS_JSON_SHAPE,
    "",
    "重要约束：",
    "- 必须确保返回的是有效JSON格式",
    "- segment_id必须与原字幕ID（0开始的索引）匹配",
    "- 每个字幕段最多识别2个关键词",
    "- 如果某个字幕段没有值得高亮的关键词，可以不包含在结果中",
    "- 只返回JSON，不要包含其他文字",
  ].join("\n");
}

export function buildCorrectionsPrompt(
  segments: readonly Segment[],
  sourceLang: string,
): string {
  const transcription = buildTranscription(segments);
  return [
    "请检查以下 ASR（自动语音识别）生成的字幕转录文本，并修正其中的错误，例如：",
    "- 同音字/词错误（听起来相同但写错的字词）",
    "- 漏听或误识别的词语",
    "- 明显的语法错误（由 ASR 引起，非口语习惯）",
    "- 标点符号缺失或错误",
    "",
    `原始语言：${sourceLang}`,
    "",
    "只修正明确的 ASR 错误，不要改写语义或风格。",
    "只返回需要修正的字幕段，不需要修正的段不要包含在结果中。",
    "",
    "字幕内容：",
    "",
    transcription,
    "",
    "请按如下 JSON 格式返回修正结果：",
    CORRECTIONS_JSON_SHAPE,
    "",
    "重要约束：",
    "- 必须确保返回的是有效 JSON 格式",
    "- segment_id 必须与原字幕 ID（0 开始的索引）匹配",
    '- 如果没有需要修正的内容，返回 {"corrections": []}',
    "- 只返回 JSON，不要包含其他文字",
  ].join("\n");
}
