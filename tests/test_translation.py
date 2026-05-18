import builtins
import importlib
import sys
import types

import pytest


def _import_translation_with_missing_googletrans(monkeypatch):
    original_translation = sys.modules.pop("pycut.translation", None)
    had_googletrans = "googletrans" in sys.modules
    original_googletrans = sys.modules.pop("googletrans", None)
    original_import = builtins.__import__

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "googletrans":
            raise ImportError("blocked googletrans")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    try:
        return importlib.import_module("pycut.translation")
    finally:
        monkeypatch.setattr(builtins, "__import__", original_import)
        sys.modules.pop("pycut.translation", None)
        if original_translation is not None:
            sys.modules["pycut.translation"] = original_translation
        if had_googletrans:
            sys.modules["googletrans"] = original_googletrans


def test_google_translator_reports_import_error_details(monkeypatch):
    translation = _import_translation_with_missing_googletrans(monkeypatch)

    with pytest.raises(RuntimeError, match="Translation requires py-googletrans") as excinfo:
        translation.GoogleTranslator().translate_bulk(["hello"], source_lang="en", target_lang="fr")

    assert "httpx<0.28" in str(excinfo.value)
    assert "Original import error: ImportError: blocked googletrans" in str(excinfo.value)
    assert isinstance(excinfo.value.__cause__, ImportError)
    assert str(excinfo.value.__cause__) == "blocked googletrans"


def test_translate_bulk_retries_on_failure_and_succeeds(monkeypatch):
    """translate_bulk retries up to 3 times; succeeds on 3rd attempt."""
    import pycut.translation as translation

    call_count = 0

    class FakeTranslator:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def translate(self, texts, src, dest):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("transient error")
            return [types.SimpleNamespace(text=f"{t}-ok") for t in texts]

    monkeypatch.setattr(translation, "Translator", FakeTranslator, raising=False)
    result = translation.GoogleTranslator().translate_bulk(["hi"], source_lang="en", target_lang="fr")
    assert result == ["hi-ok"]
    assert call_count == 3


def test_translate_bulk_exits_after_three_consecutive_failures(monkeypatch):
    """translate_bulk calls sys.exit(1) after 3 consecutive failures."""
    import pycut.translation as translation

    class FakeTranslator:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def translate(self, texts, src, dest):
            raise RuntimeError("always fails")

    monkeypatch.setattr(translation, "Translator", FakeTranslator, raising=False)
    with pytest.raises(SystemExit) as exc_info:
        translation.GoogleTranslator().translate_bulk(["hi"], source_lang="en", target_lang="fr")
    assert exc_info.value.code == 1


def test_translate_bulk_succeeds_on_third_attempt_does_not_exit(monkeypatch):
    """Two failures then success does NOT trigger exit; returns translated texts."""
    import pycut.translation as translation

    call_count = 0

    class FakeTranslator:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def translate(self, texts, src, dest):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("transient")
            return [types.SimpleNamespace(text=f"{t}-ok") for t in texts]

    monkeypatch.setattr(translation, "Translator", FakeTranslator, raising=False)
    result = translation.GoogleTranslator().translate_bulk(["hello"], source_lang="en", target_lang="fr")
    assert result == ["hello-ok"]
    assert call_count == 3
