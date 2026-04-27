from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from typing import Literal


Severity = Literal["low", "medium", "high", "critical"]


@dataclass(slots=True)
class DiffFileSummary:
    file_path: str
    language: str
    added_lines: set[int] = field(default_factory=set)
    removed_lines: set[int] = field(default_factory=set)
    hunk_count: int = 0


@dataclass(slots=True)
class StaticFinding:
    file_path: str
    line: int | None
    category: str
    skill: str
    severity: Severity
    rule_id: str
    source: str
    message: str
    evidence: str | None = None
    confidence: float = 0.75
    tags: list[str] = field(default_factory=list)


@dataclass(slots=True)
class SymbolFact:
    name: str
    kind: str
    line: int | None
    end_line: int | None
    intent: list[str] = field(default_factory=list)
    decorators: list[str] = field(default_factory=list)
    calls: list[str] = field(default_factory=list)
    comments: list[str] = field(default_factory=list)
    tokens: list[str] = field(default_factory=list)
    changed: bool = False


@dataclass(slots=True)
class SemanticFact:
    file_path: str
    language: str
    file_role: str
    frameworks: list[str] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)
    comments: list[str] = field(default_factory=list)
    tokens: list[str] = field(default_factory=list)
    intents: list[str] = field(default_factory=list)
    entities: list[str] = field(default_factory=list)
    changed_lines: list[int] = field(default_factory=list)
    changed: bool = False
    confidence: float = 0.5
    signals: dict[str, bool] = field(default_factory=dict)
    observations: dict[str, Any] = field(default_factory=dict)
    symbols: list[SymbolFact] = field(default_factory=list)


@dataclass(slots=True)
class SemanticReport:
    facts: list[SemanticFact]
    files_by_path: dict[str, DiffFileSummary]
    dominant_language: str
    commit_topics: list[str]


@dataclass(slots=True)
class RuleFinding:
    file_path: str
    line: int | None
    category: str
    skill: str
    title: str
    message: str
    severity: Severity
    rule_id: str
    confidence: float
    evidence: list[str] = field(default_factory=list)
    related_symbols: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    source: str = "rule-engine"
