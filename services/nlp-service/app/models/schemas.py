from typing import Any, Literal

from pydantic import BaseModel, Field


class AnalyzeCodeRequest(BaseModel):
    files: dict[str, str]
    diff: str
    commit_message: str
    developer_id: str
    existing_profile: dict[str, Any] | None = None


class FindingResponse(BaseModel):
    file_path: str
    line: int | None = None
    category: str
    skill: str
    title: str
    message: str
    severity: Literal["low", "medium", "high", "critical"]
    confidence: float
    rule_id: str
    source: str
    evidence: list[str] = Field(default_factory=list)
    related_symbols: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class SkillSummaryResponse(BaseModel):
    skill: str
    issue_count: int
    highest_severity: Literal["low", "medium", "high", "critical"]
    average_confidence: float
    example_titles: list[str] = Field(default_factory=list)


class LearningResourceResponse(BaseModel):
    skill: str
    title: str
    type: str
    url: str


class AnalysisSummaryResponse(BaseModel):
    finding_count: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int


class WeaknessProfileResponse(BaseModel):
    version: str
    dominant_language: str
    commit_topics: list[str] = Field(default_factory=list)
    quality_score: float
    summary: AnalysisSummaryResponse
    weakness_scores: dict[str, float] = Field(default_factory=dict)
    skills: list[SkillSummaryResponse] = Field(default_factory=list)
    findings: list[FindingResponse] = Field(default_factory=list)
    learning_resources: list[LearningResourceResponse] = Field(default_factory=list)
    analysis_metadata: dict[str, Any] = Field(default_factory=dict)
