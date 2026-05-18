from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class Highlight:
    """Video highlight segment."""

    start: float
    end: float
    title: str
    subtitle: str
    content: str
    keywords: List[str] = field(default_factory=list)
    segment_keywords: List[Dict] = field(default_factory=list)
