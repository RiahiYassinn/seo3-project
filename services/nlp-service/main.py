import json
import logging
import re
from contextlib import asynccontextmanager
from threading import Event, Thread

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from kafka import KafkaConsumer, KafkaProducer

from app.api.routes import analysis, health
from app.config import settings
from app.models.schemas import RepositoryAnalysisRequest, RepositoryAnalysisResult
from app.services.nlp_service import NLPService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)
nlp_service = NLPService()
shutdown_event = Event()
consumer_thread = None
producer = None


def _json_default(value):
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value)!r} is not JSON serializable")


def emit_progress(repository_id: str, developer_id: str, integration_id: str, progress: int, stage: str):
    producer.send(
        "analysis.progress",
        key=repository_id.encode("utf-8"),
        value=json.dumps(
            {
                "repositoryId": repository_id,
                "developerId": developer_id,
                "integrationId": integration_id,
                "progress": progress,
                "stage": stage,
            }
        ).encode("utf-8"),
    )


def score_repository_analysis(
    request: RepositoryAnalysisRequest,
) -> RepositoryAnalysisResult:
    files_changed = [
        file_path for commit in request.commits for file_path in commit.filesChanged
    ]
    total_additions = sum(commit.additions for commit in request.commits)
    total_deletions = sum(commit.deletions for commit in request.commits)
    total_changed_files = sum(commit.changedFiles for commit in request.commits)
    commit_count = len(request.commits)

    documentation_commits = 0
    testing_commits = 0
    refactor_commits = 0
    conventional_commits = 0
    patch_heavy_commits = 0
    detected_skill_map = {}

    for commit in request.commits:
        categories = nlp_service.categorize_commit(commit.message, commit.filesChanged)
        if "documentation" in categories:
            documentation_commits += 1
        if "testing" in categories:
            testing_commits += 1
        if "refactor" in categories:
            refactor_commits += 1
        if re.match(
            r"^(feat|fix|refactor|docs|test|chore)(\(.+\))?:",
            commit.message.lower(),
        ):
            conventional_commits += 1
        if any(file.patch and len(file.patch.splitlines()) > 80 for file in commit.files):
            patch_heavy_commits += 1

        technologies = nlp_service.detect_technologies(commit.message, commit.filesChanged)
        file_languages = nlp_service.detect_languages_from_files(commit.filesChanged)

        for technology in technologies:
            entry = detected_skill_map.setdefault(
                technology.name,
                {
                    "skillName": technology.name,
                    "category": technology.category,
                    "proficiency": 0.0,
                    "commitCount": 0,
                    "confidence": technology.confidence,
                    "statistics": {"evidenceCount": 0},
                },
            )
            entry["commitCount"] += 1
            entry["proficiency"] += technology.confidence * 10
            entry["statistics"]["evidenceCount"] += 1

        for language, count in file_languages.items():
            entry = detected_skill_map.setdefault(
                language,
                {
                    "skillName": language,
                    "category": language,
                    "proficiency": 0.0,
                    "commitCount": 0,
                    "confidence": 0.7,
                    "statistics": {"fileSignals": 0},
                },
            )
            entry["commitCount"] += count
            entry["proficiency"] += min(count * 1.5, 10)
            entry["statistics"]["fileSignals"] = (
                entry["statistics"].get("fileSignals", 0) + count
            )

    documentation_ratio = documentation_commits / commit_count if commit_count else 0
    testing_ratio = testing_commits / commit_count if commit_count else 0
    refactor_ratio = refactor_commits / commit_count if commit_count else 0
    conventional_ratio = conventional_commits / commit_count if commit_count else 0
    patch_density_penalty = patch_heavy_commits / commit_count if commit_count else 0
    average_changes_per_commit = (
        (total_additions + total_deletions) / commit_count if commit_count else 0
    )

    clean_code_score = max(
        0.0,
        min(
            10.0,
            5.2
            + (refactor_ratio * 2.2)
            + (testing_ratio * 1.4)
            + (documentation_ratio * 1.0)
            - (patch_density_penalty * 1.2),
        ),
    )
    good_practices_score = max(
        0.0,
        min(
            10.0,
            4.8
            + (conventional_ratio * 2.4)
            + (testing_ratio * 1.8)
            + (documentation_ratio * 1.0),
        ),
    )
    maintainability_score = max(
        0.0,
        min(
            10.0,
            6.5 - min(average_changes_per_commit / 250.0, 2.5) + (refactor_ratio * 1.8),
        ),
    )
    collaboration_score = max(
        0.0,
        min(
            10.0,
            5.5
            + (0.8 if request.repositoryStats.contributorCount > 1 else 0.0)
            + (documentation_ratio * 1.2)
            + (testing_ratio * 0.8),
        ),
    )
    overall_score = round(
        (clean_code_score * 0.35)
        + (good_practices_score * 0.25)
        + (maintainability_score * 0.25)
        + (collaboration_score * 0.15),
        2,
    )
    skill_level = nlp_service.infer_skill_level(overall_score)

    strengths = []
    improvements = []
    if testing_ratio >= 0.2:
        strengths.append("Shows regular testing-related work")
    if refactor_ratio >= 0.15:
        strengths.append("Refactors code instead of only shipping features")
    if documentation_ratio >= 0.1:
        strengths.append("Documents changes and project knowledge")
    if conventional_ratio >= 0.4:
        strengths.append("Uses structured commit messages consistently")
    if not strengths:
        strengths.append("Has enough contribution history for a baseline assessment")

    if testing_ratio < 0.15:
        improvements.append("Increase test-oriented commits to strengthen quality signals")
    if documentation_ratio < 0.08:
        improvements.append("Add more documentation updates to improve maintainability evidence")
    if patch_density_penalty > 0.35:
        improvements.append("Break very large commits into smaller reviewable changes")
    if conventional_ratio < 0.3:
        improvements.append("Adopt clearer commit conventions to improve traceability")

    summary_skills = {
        "clean_code": clean_code_score,
        "good_practices": good_practices_score,
        "maintainability": maintainability_score,
        "collaboration": collaboration_score,
    }
    for skill_name, score in summary_skills.items():
        detected_skill_map[skill_name] = {
            "skillName": skill_name,
            "category": "engineering_quality",
            "proficiency": round(score, 2),
            "commitCount": commit_count,
            "confidence": 0.75,
            "statistics": {
                "repositoryId": request.repositoryId,
                "repoName": request.repoName,
                "skillLevel": skill_level,
            },
        }

    detected_skills = []
    for skill in detected_skill_map.values():
        detected_skills.append(
            {
                **skill,
                "proficiency": round(min(skill["proficiency"], 10.0), 2),
            }
        )

    detected_skills.sort(
        key=lambda skill: (-skill["proficiency"], -skill["commitCount"], skill["skillName"])
    )

    return RepositoryAnalysisResult(
        repositoryId=request.repositoryId,
        integrationId=request.integrationId,
        developerId=request.developerId,
        repoName=request.repoName,
        githubUsername=request.githubUsername,
        summary={
            "overallScore": overall_score,
            "skillLevel": skill_level,
            "cleanCodeScore": round(clean_code_score, 2),
            "goodPracticesScore": round(good_practices_score, 2),
            "maintainabilityScore": round(maintainability_score, 2),
            "collaborationScore": round(collaboration_score, 2),
            "strengths": strengths,
            "improvements": improvements,
            "commitCount": commit_count,
            "filesTouched": len(set(files_changed)),
        },
        detectedSkills=detected_skills,
        metadata={
            "contributorCount": request.repositoryStats.contributorCount,
            "developerContributionShare": request.repositoryStats.developerContributionShare,
            "developerContributionCount": request.repositoryStats.developerContributionCount,
            "analyzedCommitCount": request.repositoryStats.analyzedCommitCount,
            "totalAdditions": total_additions,
            "totalDeletions": total_deletions,
            "totalChangedFiles": total_changed_files,
        },
    )


def consume_kafka_jobs():
    consumer = KafkaConsumer(
        "commit.analysis",
        bootstrap_servers=settings.KAFKA_BROKERS.split(","),
        group_id=settings.KAFKA_CONSUMER_GROUP,
        value_deserializer=lambda value: json.loads(value.decode("utf-8")),
        auto_offset_reset="earliest",
        enable_auto_commit=True,
    )

    while not shutdown_event.is_set():
        batches = consumer.poll(timeout_ms=1000)
        for _, messages in batches.items():
            for message in messages:
                try:
                    request = RepositoryAnalysisRequest.model_validate(message.value)
                    emit_progress(
                        request.repositoryId,
                        request.developerId,
                        request.integrationId,
                        78,
                        "Running NLP analysis",
                    )
                    result = score_repository_analysis(request)
                    emit_progress(
                        request.repositoryId,
                        request.developerId,
                        request.integrationId,
                        92,
                        "Publishing analysis insights",
                    )
                    producer.send(
                        "analysis.completed",
                        key=request.repositoryId.encode("utf-8"),
                        value=json.dumps(
                            result.model_dump(),
                            default=_json_default,
                        ).encode("utf-8"),
                    )
                except Exception as exc:
                    raw_value = message.value or {}
                    repository_id = raw_value.get("repositoryId", "unknown")
                    producer.send(
                        "analysis.failed",
                        key=str(repository_id).encode("utf-8"),
                        value=json.dumps(
                            {
                                "repositoryId": repository_id,
                                "reason": str(exc),
                                "progress": 100,
                                "stage": "Analysis failed",
                            }
                        ).encode("utf-8"),
                    )

    consumer.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting NLP Service...")
    global consumer_thread, producer

    producer = KafkaProducer(bootstrap_servers=settings.KAFKA_BROKERS.split(","))
    consumer_thread = Thread(target=consume_kafka_jobs, daemon=True)
    consumer_thread.start()

    yield

    shutdown_event.set()
    if consumer_thread:
        consumer_thread.join(timeout=5)
    if producer:
        producer.flush(timeout=5)
        producer.close()

    logger.info("Shutting down NLP Service...")


app = FastAPI(
    title="SEO3 NLP Service",
    description="Natural Language Processing service for commit analysis",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(analysis.router, prefix="/analysis", tags=["analysis"])


@app.get("/")
async def root():
    return {
        "service": "NLP Service",
        "version": "1.0.0",
        "status": "running",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
    )
