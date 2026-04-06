import logging
import os
from contextlib import asynccontextmanager
from threading import Event, Thread

from kafka import KafkaConsumer, KafkaProducer

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

if load_dotenv:
    load_dotenv()

from app.api.routes import health
from app.config import settings
from app.models.schemas import AnalyzeCodeRequest, WeaknessProfileResponse
from app.services.code_analyzer import CodeAnalyzer


logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)
if not load_dotenv:
    logger.info("python-dotenv unavailable; relying on os.environ only")

os.environ.setdefault("ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY", ""))
analyzer = CodeAnalyzer()
shutdown_event = Event()
consumer_thread = None
producer = None


def _serialize_message(payload: dict) -> bytes:
    import json

    return json.dumps(payload).encode("utf-8")


def emit_progress(
    repository_id: str,
    developer_id: str,
    integration_id: str | None,
    progress: int,
    stage: str,
):
    if not producer:
        return

    producer.send(
        "analysis.progress",
        key=repository_id.encode("utf-8"),
        value=_serialize_message(
            {
                "repositoryId": repository_id,
                "developerId": developer_id,
                "integrationId": integration_id,
                "progress": progress,
                "stage": stage,
            }
        ),
    )


async def process_analysis_job(message: dict) -> None:
    repository_id = message["repositoryId"]
    integration_id = message.get("integrationId")
    developer_id = message["developer_id"]

    emit_progress(
        repository_id,
        developer_id,
        integration_id,
        78,
        "Running code weakness analysis",
    )
    profile = await analyzer.analyze(
        files_with_content=message.get("files", {}),
        diff_content=message.get("diff", ""),
        commit_message=message.get("commit_message", ""),
        developer_id=developer_id,
        existing_profile=message.get("existing_profile"),
    )
    emit_progress(
        repository_id,
        developer_id,
        integration_id,
        92,
        "Publishing analysis insights",
    )

    metadata = {
        **(message.get("metadata") or {}),
        "filesAnalyzed": len(message.get("files", {})),
        "diffLength": len(message.get("diff", "")),
        "analysisSource": "nlp-service",
    }

    producer.send(
        "analysis.completed",
        key=repository_id.encode("utf-8"),
        value=_serialize_message(
            {
                "repositoryId": repository_id,
                "integrationId": integration_id,
                "developerId": developer_id,
                "repoName": message.get("repoName"),
                "repoUrl": message.get("repoUrl"),
                "githubUsername": message.get("githubUsername"),
                "analyzedAt": message.get("analyzedAt"),
                "summary": profile,
                "metadata": metadata,
            }
        ),
    )


def consume_kafka_jobs():
    import asyncio
    import json

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
                    asyncio.run(process_analysis_job(message.value))
                except Exception as exc:
                    raw_value = message.value or {}
                    repository_id = raw_value.get("repositoryId", "unknown")
                    if producer:
                        producer.send(
                            "analysis.failed",
                            key=str(repository_id).encode("utf-8"),
                            value=_serialize_message(
                                {
                                    "repositoryId": repository_id,
                                    "developerId": raw_value.get("developer_id"),
                                    "integrationId": raw_value.get("integrationId"),
                                    "reason": str(exc),
                                    "progress": 100,
                                    "stage": "Analysis failed",
                                }
                            ),
                        )

    consumer.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global consumer_thread, producer

    logger.info("Starting Code Analysis Service...")
    producer = KafkaProducer(
        bootstrap_servers=settings.KAFKA_BROKERS.split(","),
    )
    consumer_thread = Thread(target=consume_kafka_jobs, daemon=True)
    consumer_thread.start()

    yield

    shutdown_event.set()
    if consumer_thread:
        consumer_thread.join(timeout=5)
    if producer:
        producer.flush(timeout=5)
        producer.close()
    logger.info("Shutting down Code Analysis Service...")

app = FastAPI(
    title="SEO3 Code Analysis Service",
    description="Code-diff analysis service for developer weakness profiling",
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


@app.get("/")
async def root():
    return {
        "service": "Code Analysis Service",
        "version": "1.0.0",
        "status": "running",
    }


@app.post("/analyze/code", response_model=WeaknessProfileResponse)
async def analyze_code(request: AnalyzeCodeRequest):
    return await analyzer.analyze(
        files_with_content=request.files,
        diff_content=request.diff,
        commit_message=request.commit_message,
        developer_id=request.developer_id,
        existing_profile=request.existing_profile,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
