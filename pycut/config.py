from __future__ import annotations

import platform

SUPPORTED_SYSTEM = "darwin"
SUPPORTED_MACHINES = frozenset({"arm64", "aarch64"})
RUNTIME_BACKEND = "mlx"

# DEFAULT_ASR_MODEL for CN: "mlx-community/Qwen3-ASR-1.7B-bf16"
DEFAULT_EN_ASR_MODEL = "mlx-community/parakeet-tdt-0.6b-v3"
DEFAULT_CHINESE_ASR_MODEL = "mlx-community/Qwen3-ASR-1.7B-bf16"
DEFAULT_FALLBACK_ASR_MODEL = "mlx-community/whisper-large-v3-turbo"
DEFAULT_ALIGNER_MODEL = "mlx-community/Qwen3-ForcedAligner-0.6B-8bit"
DEFAULT_TRANSLATION_BACKEND = "py-googletrans"
DEFAULT_ORIGINAL_SUBTITLE_COLOR = "#FFFFFF"
DEFAULT_TRANSLATION_SUBTITLE_COLOR = "#FFA500"
DEFAULT_HIGHLIGHT_SUBTITLE_COLOR = "#FFFF00"


def is_supported_runtime(system: str | None = None, machine: str | None = None) -> bool:
    resolved_system = (system or platform.system()).lower()
    resolved_machine = (machine or platform.machine()).lower()
    return resolved_system == SUPPORTED_SYSTEM and resolved_machine in SUPPORTED_MACHINES


def ensure_supported_runtime(system: str | None = None, machine: str | None = None) -> None:
    if is_supported_runtime(system=system, machine=machine):
        return

    resolved_system = system or platform.system()
    resolved_machine = machine or platform.machine()
    raise RuntimeError(
        "pycut currently supports only macOS Apple Silicon "
        f"(got {resolved_system}/{resolved_machine})."
    )
