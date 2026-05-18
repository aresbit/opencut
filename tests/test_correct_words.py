import json
import types
import pytest
from pycut.utils import Segment
from pycut import analysis


def _make_client(response_text: str):
    """Return a minimal fake OpenAI-compatible client that always returns response_text."""

    class FakeCompletions:
        def create(self, *, model, messages):
            return types.SimpleNamespace(
                choices=[types.SimpleNamespace(
                    message=types.SimpleNamespace(content=response_text)
                )]
            )

    return types.SimpleNamespace(
        chat=types.SimpleNamespace(completions=FakeCompletions()),
        _pycut_model="test-model",
    )


def _seg(i, text):
    return Segment(start=float(i), end=float(i + 1), text=text, words=[])


# ---------- _sanitize_corrections_payload ----------

def test_sanitize_corrections_empty_list():
    assert analysis._sanitize_corrections_payload([]) == []


def test_sanitize_corrections_valid():
    raw = [{"segment_id": 0, "corrected": "hello world"}]
    result = analysis._sanitize_corrections_payload(raw)
    assert result == [{"segment_id": 0, "corrected": "hello world"}]


def test_sanitize_corrections_skips_non_int_id():
    raw = [{"segment_id": "zero", "corrected": "hi"}]
    assert analysis._sanitize_corrections_payload(raw) == []


def test_sanitize_corrections_skips_missing_corrected():
    raw = [{"segment_id": 0}]
    assert analysis._sanitize_corrections_payload(raw) == []


def test_sanitize_corrections_skips_non_dict():
    raw = ["not a dict", None, 42]
    assert analysis._sanitize_corrections_payload(raw) == []


def test_sanitize_corrections_coerces_corrected_to_str():
    raw = [{"segment_id": 1, "corrected": 123}]
    result = analysis._sanitize_corrections_payload(raw)
    assert result == [{"segment_id": 1, "corrected": "123"}]


# ---------- correct_words ----------

def test_correct_words_returns_corrections():
    segs = [_seg(0, "there saying hello"), _seg(1, "its a great idea")]
    payload = json.dumps({
        "corrections": [
            {"segment_id": 0, "corrected": "they're saying hello"},
            {"segment_id": 1, "corrected": "it's a great idea"},
        ]
    })
    client = _make_client(payload)
    result = analysis.correct_words(client, segs, "en")
    assert len(result) == 2
    assert result[0] == {"segment_id": 0, "corrected": "they're saying hello"}
    assert result[1] == {"segment_id": 1, "corrected": "it's a great idea"}


def test_correct_words_returns_empty_on_no_corrections():
    segs = [_seg(0, "hello world")]
    payload = json.dumps({"corrections": []})
    client = _make_client(payload)
    result = analysis.correct_words(client, segs, "en")
    assert result == []


def test_correct_words_handles_markdown_fence():
    segs = [_seg(0, "its fine")]
    payload = "```json\n" + json.dumps({"corrections": [{"segment_id": 0, "corrected": "it's fine"}]}) + "\n```"
    client = _make_client(payload)
    result = analysis.correct_words(client, segs, "en")
    assert result == [{"segment_id": 0, "corrected": "it's fine"}]


def test_correct_words_returns_empty_on_api_failure():
    class FakeCompletions:
        def create(self, *, model, messages):
            raise RuntimeError("network error")

    client = types.SimpleNamespace(
        chat=types.SimpleNamespace(completions=FakeCompletions()),
        _pycut_model="test-model",
    )
    segs = [_seg(0, "hello")]
    result = analysis.correct_words(client, segs, "en")
    assert result == []
