from typing import Any

from pydantic import BaseModel, Field


class AnalyzeCodeRequest(BaseModel):
    files: dict[str, str]
    diff: str
    commit_message: str
    developer_id: str
    existing_profile: dict[str, Any] | None = None


class Recommendation(BaseModel):
    weakness: str
    action: str
    learning_query: str


class TopWeakness(BaseModel):
    category: str
    score: float
    evidence: list[str]
    priority: str


class WeaknessProfileResponse(BaseModel):
    weakness_scores: dict[str, float] = Field(default_factory=dict)
    top_weaknesses: list[TopWeakness] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    quality_score: float | None = None
    skill_level: str = "unknown"
    recommendations: list[Recommendation] = Field(default_factory=list)
