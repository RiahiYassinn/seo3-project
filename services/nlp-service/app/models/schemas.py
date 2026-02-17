from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime


class CommitAnalysisRequest(BaseModel):
    commit_sha: str
    message: str
    author: str
    repository: str
    files_changed: List[str]
    additions: int
    deletions: int


class TechnologyDetection(BaseModel):
    name: str
    confidence: float
    category: str


class SentimentAnalysis(BaseModel):
    score: float
    label: str  # positive, negative, neutral


class CommitAnalysisResponse(BaseModel):
    commit_sha: str
    technologies: List[TechnologyDetection]
    sentiment: SentimentAnalysis
    complexity_score: float
    key_phrases: List[str]
    categories: List[str]
    processed_at: datetime = Field(default_factory=datetime.utcnow)


class CodeParseRequest(BaseModel):
    code: str
    language: str
    file_path: Optional[str] = None


class CodeParseResponse(BaseModel):
    language: str
    imports: List[str]
    functions: List[str]
    classes: List[str]
    complexity: int
    lines_of_code: int
