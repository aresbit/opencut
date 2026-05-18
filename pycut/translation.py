import asyncio
import sys
from typing import List, Optional

try:
    from googletrans import Translator  # type: ignore[import-not-found]
    _TRANSLATOR_IMPORT_ERROR: Optional[ImportError] = None
except ImportError as exc:  # pragma: no cover - exercised via explicit runtime handling
    Translator = None
    _TRANSLATOR_IMPORT_ERROR = exc

MAX_CONSECUTIVE_FAILURES = 3


class GoogleTranslator:
    """Thin synchronous wrapper around the async py-googletrans client."""

    def __init__(self, translator_cls=None):
        self._translator_cls = translator_cls

    def _get_translator_cls(self):
        translator_cls = self._translator_cls or Translator
        if translator_cls is None:
            raise RuntimeError(
                "Translation requires py-googletrans and compatible httpx "
                "(try: pip install -U py-googletrans 'httpx<0.28'). "
                "Original import error: "
                f"{type(_TRANSLATOR_IMPORT_ERROR).__name__}: {_TRANSLATOR_IMPORT_ERROR}"
            ) from _TRANSLATOR_IMPORT_ERROR
        return translator_cls

    async def _translate_async(
        self,
        translator_cls,
        texts: List[str],
        source_lang: str,
        target_lang: str,
    ) -> List[str]:
        async with translator_cls() as translator:
            translations = await translator.translate(texts, src=source_lang, dest=target_lang)
            if isinstance(translations, list):
                return [str(item.text).strip() for item in translations]
            return [str(translations.text).strip()]

    def translate_bulk(
        self,
        texts: List[str],
        source_lang: str = "zh",
        target_lang: str = "en",
    ) -> List[str]:
        if not texts:
            return []

        translator_cls = self._get_translator_cls()
        originals = list(texts)

        for attempt in range(1, MAX_CONSECUTIVE_FAILURES + 1):
            try:
                translated = asyncio.run(
                    self._translate_async(
                        translator_cls,
                        originals,
                        source_lang=source_lang,
                        target_lang=target_lang,
                    )
                )
            except Exception as exc:
                preview = originals[0][:30] if originals else ""
                print(
                    f"⚠️  Translation attempt {attempt}/{MAX_CONSECUTIVE_FAILURES} failed "
                    f"for '{preview}...': {exc}"
                )
                if attempt >= MAX_CONSECUTIVE_FAILURES:
                    print("❌ Translation failed 3 consecutive times. Exiting.")
                    sys.exit(1)
                continue

            if len(translated) != len(originals):
                preview = originals[0][:30] if originals else ""
                print(
                    f"⚠️  Translation returned {len(translated)} items for {len(originals)} texts; "
                    f"keeping originals for '{preview}...'"
                )
                return originals

            return translated

        return originals  # unreachable

    def translate_text(self, text: str, source_lang: str = "zh", target_lang: str = "en") -> str:
        translated = self.translate_bulk([text], source_lang=source_lang, target_lang=target_lang)
        return translated[0] if translated else text
