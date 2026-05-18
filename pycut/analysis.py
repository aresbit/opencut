#!/usr/bin/env python3
# coding=utf-8
"""
OpenAI-compatible video content analysis helpers.

Extracted so that VideoClipper can delegate client setup and highlight
extraction/parsing without carrying the logic inline.

Supports any OpenAI-compatible API by configuring base_url (e.g. Gemini,
DeepSeek, local vLLM, Ollama, etc.).
"""

import json
from typing import List, Dict, Optional, Any

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None


DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_BASE_URL = "https://api.openai.com/v1"
HTTP_TIMEOUT_SECONDS = 60


def create_client(
    api_key: Optional[str],
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> Optional[Any]:
    """Return a configured OpenAI-compatible client, or None when unavailable."""
    if not api_key:
        return None
    if OpenAI is None:
        return None
    client = OpenAI(
        api_key=api_key,
        base_url=base_url or DEFAULT_BASE_URL,
        timeout=HTTP_TIMEOUT_SECONDS,
    )
    # Attach model name so callers don't need to pass it separately.
    client._pycut_model = model or DEFAULT_MODEL  # noqa: SLF001
    return client


def extract_json_payload(text: str) -> str:
    """Strip markdown fenced-code blocks and return the raw JSON string."""
    if "```json" in text:
        return text.split("```json")[1].split("```")[0].strip()
    if "```" in text:
        return text.split("```")[1].split("```")[0].strip()
    return text.strip()


def _sanitize_keyword_list(value: Any) -> List[str]:
    """Normalize keyword arrays while ignoring malformed values."""
    if not isinstance(value, list):
        return []

    sanitized: List[str] = []
    for item in value:
        if item is None:
            continue
        if isinstance(item, str):
            sanitized.append(item)
            continue
        if isinstance(item, (int, float)) and not isinstance(item, bool):
            sanitized.append(str(item))
    return sanitized


def _sanitize_segment_keywords(value: Any) -> List[Dict[str, Any]]:
    """Normalize per-segment keyword metadata into a safe list of dicts."""
    if not isinstance(value, list):
        return []

    sanitized: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue

        segment_id = item.get("segment_id")
        if not isinstance(segment_id, int) or isinstance(segment_id, bool):
            continue

        sanitized.append(
            {
                "segment_id": segment_id,
                "keywords": _sanitize_keyword_list(item.get("keywords", [])),
            }
        )
    return sanitized


def _sanitize_text_field(value: Any) -> str:
    """Normalize text fields while avoiding literal null stringification."""
    if value is None:
        return ""
    return str(value)


def _sanitize_highlights_payload(value: Any) -> List[Dict[str, Any]]:
    """Return only well-formed highlight objects with safe defaults."""
    if not isinstance(value, list):
        return []

    sanitized: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        if "start" not in item or "end" not in item:
            continue

        try:
            start = float(item["start"])
            end = float(item["end"])
        except (TypeError, ValueError):
            continue

        sanitized.append(
            {
                "start": start,
                "end": end,
                "title": _sanitize_text_field(item.get("title", "")),
                "subtitle": _sanitize_text_field(item.get("subtitle", "")),
                "content": _sanitize_text_field(item.get("content", "")),
                "keywords": _sanitize_keyword_list(item.get("keywords", [])),
                "segment_keywords": _sanitize_segment_keywords(item.get("segment_keywords", [])),
            }
        )

    return sanitized


def _chat(client: Any, prompt: str) -> str:
    """Send a prompt to the OpenAI-compatible API and return the response text."""
    model = getattr(client, "_pycut_model", DEFAULT_MODEL)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


def extract_highlights(
    client: Any,
    segments,
    source_lang: str,
    target_lang: str,
) -> List[Dict]:
    """
    Call the LLM to extract highlight segments and return them as plain dicts.

    Each dict has keys: start, end, title, subtitle, content, keywords,
    segment_keywords.  Returns an empty list on failure.
    """
    transcription_lines = []
    for i, seg in enumerate(segments):
        transcription_lines.append(
            f"[{seg.start:.2f}s-{seg.end:.2f}s] ID:{i} {seg.text}"
        )
    transcription = "\n".join(transcription_lines)

    prompt_parts = [
        f"请分析以下视频字幕内容，从中选出最精彩、最有价值、最吸引人的片段（通常1个片段，不少于 30 秒，不超过 2 分钟）。目标语言为{target_lang}。",
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
        """{
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
}""",
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
    ]

    prompt = "\n".join(prompt_parts)

    try:
        response_text = extract_json_payload(_chat(client, prompt).strip())
        data = json.loads(response_text)
        return _sanitize_highlights_payload(data.get("highlights", []))
    except Exception as e:
        print(f"❌ Highlights extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return []


def extract_keywords_for_segments(
    client: Any,
    segments,
    source_lang: str,
    target_lang: str,
) -> List[Dict]:
    """
    Call the LLM to identify per-segment keywords for highlighting only.

    Lighter than extract_highlights: no clip time-range extraction,
    only segment_keywords per subtitle segment.

    Returns a list of dicts with keys: segment_id (int), keywords (List[str]).
    Returns an empty list on failure.
    """
    transcription_lines = []
    for i, seg in enumerate(segments):
        transcription_lines.append(
            f"[{seg.start:.2f}s-{seg.end:.2f}s] ID:{i} {seg.text}"
        )
    transcription = "\n".join(transcription_lines)

    prompt_parts = [
        f"请分析以下视频字幕内容，为每个字幕段识别最重要的关键词，用于高亮显示。目标语言为{target_lang}。",
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
        """{
  "segment_keywords": [
    { "segment_id": 0, "keywords": ["高亮词A", "高亮词B"] },
    { "segment_id": 2, "keywords": ["高亮词C"] }
  ]
}""",
        "",
        "重要约束：",
        "- 必须确保返回的是有效JSON格式",
        "- segment_id必须与原字幕ID（0开始的索引）匹配",
        "- 每个字幕段最多识别2个关键词",
        "- 如果某个字幕段没有值得高亮的关键词，可以不包含在结果中",
        "- 只返回JSON，不要包含其他文字",
    ]

    prompt = "\n".join(prompt_parts)

    try:
        response_text = extract_json_payload(_chat(client, prompt).strip())
        data = json.loads(response_text)
        print(f"Keyword extraction response: {data}")
        return _sanitize_segment_keywords(data.get("segment_keywords", []))
    except Exception as e:
        print(f"❌ Keyword extraction failed: {e}")
        return []


def _sanitize_corrections_payload(value: Any) -> List[Dict[str, Any]]:
    """Return only well-formed correction objects with safe defaults."""
    if not isinstance(value, list):
        return []
    sanitized: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        segment_id = item.get("segment_id")
        if not isinstance(segment_id, int) or isinstance(segment_id, bool):
            continue
        corrected = item.get("corrected")
        if corrected is None:
            continue
        sanitized.append({"segment_id": segment_id, "corrected": str(corrected)})
    return sanitized


def correct_words(
    client: Any,
    segments,
    source_lang: str,
) -> List[Dict]:
    """
    Call the LLM to fix ASR transcription errors in segments.

    Returns a list of dicts with keys: segment_id (int), corrected (str).
    Only segments that need changes are included.
    Returns an empty list on failure or when no corrections are needed.
    """
    transcription_lines = []
    for i, seg in enumerate(segments):
        transcription_lines.append(
            f"[{seg.start:.2f}s-{seg.end:.2f}s] ID:{i} {seg.text}"
        )
    transcription = "\n".join(transcription_lines)

    prompt_parts = [
        f"请检查以下 ASR（自动语音识别）生成的字幕转录文本，并修正其中的错误，例如：",
        "- 同音字/词错误（听起来相同但写错的字词）",
        "- 漏听或误识别的词语",
        "- 明显的语法错误（由 ASR 引起，非口语习惯）",
        "- 标点符号缺失或错误",
        "",
        f"原始语言：{source_lang}",
        "",
        "只修正明确的 ASR 错误，不要改写语义或风格。",
        "只返回需要修正的字幕段，不需要修正的段不要包含在结果中。",
        "",
        "字幕内容：",
        "",
        transcription,
        "",
        "请按如下 JSON 格式返回修正结果：",
        """{
  "corrections": [
    {"segment_id": 0, "corrected": "修正后的文本"},
    {"segment_id": 3, "corrected": "另一段修正后的文本"}
  ]
}""",
        "",
        "重要约束：",
        "- 必须确保返回的是有效 JSON 格式",
        "- segment_id 必须与原字幕 ID（0 开始的索引）匹配",
        "- 如果没有需要修正的内容，返回 {\"corrections\": []}",
        "- 只返回 JSON，不要包含其他文字",
    ]

    prompt = "\n".join(prompt_parts)

    try:
        response_text = extract_json_payload(_chat(client, prompt).strip())
        data = json.loads(response_text)
        return _sanitize_corrections_payload(data.get("corrections", []))
    except Exception as e:
        print(f"❌ Word correction failed: {e}")
        import traceback
        traceback.print_exc()
        return []
