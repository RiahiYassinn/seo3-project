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


class RepositoryCommitFile(BaseModel):
    filename: str
    status: Optional[str] = None
    additions: int = 0
    deletions: int = 0
    changes: int = 0
    patch: Optional[str] = None


class RepositoryCommit(BaseModel):
    sha: str
    message: str
    committedAt: datetime
    additions: int
    deletions: int
    changedFiles: int
    filesChanged: List[str]
    files: List[RepositoryCommitFile] = []


class RepositoryStats(BaseModel):
    contributorCount: int = 0
    developerContributionCount: int = 0
    developerContributionShare: Optional[float] = None
    totalContributorCommits: int = 0
    analyzedCommitCount: int = 0


class RepositoryAnalysisRequest(BaseModel):
    repositoryId: str
    integrationId: str
    developerId: str
    repoName: str
    repoUrl: str
    githubUsername: str
    analyzedAt: datetime
    repositoryStats: RepositoryStats
    commits: List[RepositoryCommit]


class DetectedSkill(BaseModel):
    skillName: str
    category: str
    proficiency: float
    commitCount: int
    confidence: float
    statistics: Dict[str, Any] = {}


class RepositoryAnalysisSummary(BaseModel):
    overallScore: float
    skillLevel: str
    cleanCodeScore: float
    goodPracticesScore: float
    maintainabilityScore: float
    collaborationScore: float
    strengths: List[str]
    improvements: List[str]
    commitCount: int
    filesTouched: int


class RepositoryAnalysisResult(BaseModel):
    repositoryId: str
    integrationId: str
    developerId: str
    repoName: str
    githubUsername: str
    analyzedAt: datetime = Field(default_factory=datetime.utcnow)
    summary: RepositoryAnalysisSummary
    detectedSkills: List[DetectedSkill]
    metadata: Dict[str, Any] = {}
