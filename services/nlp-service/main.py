import logging
import os
from contextlib import asynccontextmanager
from threading import Event, Thread
from time import time

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
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("kafka").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)
if not load_dotenv:
    logger.info("python-dotenv unavailable; relying on os.environ only")

analyzer = CodeAnalyzer()
shutdown_event = Event()
consumer_thread = None
producer = None
pending_snapshot_chunks: dict[str, dict] = {}


def _serialize_message(payload: dict) -> bytes:
    import json

    return json.dumps(payload).encode("utf-8")


def emit_progress(
    repository_id: str,
    developer_id: str,
    integration_id: str | None,
    github_username: str | None,
    progress: int,
    stage: str,
):
    if not producer:
        return

    logger.info(
        "analysis progress repo=%s developer=%s progress=%s stage=%s",
        repository_id,
        developer_id,
        progress,
        stage,
    )
    producer.send(
        "analysis.progress",
        key=repository_id.encode("utf-8"),
        value=_serialize_message(
            {
                "repositoryId": repository_id,
                "developerId": developer_id,
                "integrationId": integration_id,
                "githubUsername": github_username,
                "progress": progress,
                "stage": stage,
            }
        ),
    )


async def process_analysis_job(message: dict) -> None:
    import asyncio

    repository_id = message["repositoryId"]
    integration_id = message.get("integrationId")
    developer_id = message["developer_id"]
    github_username = message.get("githubUsername")
    current_progress = 68
    current_stage = "Preparing analysis runtime"
    logger.info(
        "starting analysis repo=%s developer=%s files=%s diff_chars=%s",
        repository_id,
        developer_id,
        len(message.get("files", {})),
        len(message.get("diff", "")),
    )
    emit_progress(
        repository_id,
        developer_id,
        integration_id,
        github_username,
        current_progress,
        current_stage,
    )

    async def progress_callback(progress: int, stage: str) -> None:
        nonlocal current_progress, current_stage
        if progress >= current_progress:
            current_progress = progress
            current_stage = stage
            emit_progress(
                repository_id,
                developer_id,
                integration_id,
                github_username,
                progress,
                stage,
            )

    emit_progress(
        repository_id,
        developer_id,
        integration_id,
        github_username,
        70,
        "Running code weakness analysis",
    )
    heartbeat_running = True

    async def heartbeat() -> None:
        while heartbeat_running:
            await asyncio.sleep(12)
            emit_progress(
                repository_id,
                developer_id,
                integration_id,
                github_username,
                current_progress,
                f"{current_stage} (still running)",
            )

    heartbeat_task = asyncio.create_task(heartbeat())
    try:
        profile = await analyzer.analyze(
            files_with_content=message.get("files", {}),
            diff_content=message.get("diff", ""),
            commit_message=message.get("commit_message", ""),
            developer_id=developer_id,
            existing_profile=message.get("existing_profile"),
            progress_callback=progress_callback,
        )
    finally:
        heartbeat_running = False
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
    emit_progress(
        repository_id,
        developer_id,
        integration_id,
        github_username,
        96,
        "Publishing analysis insights",
    )

    metadata = {
        **(message.get("metadata") or {}),
        "filesAnalyzed": len(message.get("files", {})),
        "diffLength": len(message.get("diff", "")),
        "analysisSource": "nlp-service",
        "analysisMetadata": profile.get("analysis_metadata", {}),
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
                "requestedByUserId": message.get("requestedByUserId"),
                "analyzedAt": message.get("analyzedAt"),
                "summary": profile,
                "metadata": metadata,
            }
        ),
    )
    logger.info(
        "completed analysis repo=%s developer=%s quality_score=%s",
        repository_id,
        developer_id,
        profile.get("quality_score"),
    )


def _cleanup_stale_snapshots() -> None:
    expiration_seconds = 1800
    stale_repository_ids = [
        repository_id
        for repository_id, state in pending_snapshot_chunks.items()
        if time() - state.get("updated_at", 0) > expiration_seconds
    ]
    for repository_id in stale_repository_ids:
        pending_snapshot_chunks.pop(repository_id, None)
        logger.warning("Discarded stale snapshot buffer for repo=%s", repository_id)


def _reassemble_snapshot_chunk(message: dict) -> dict | None:
    transport = message.get("transport")
    if not transport:
        return message

    repository_id = message["repositoryId"]
    state = pending_snapshot_chunks.setdefault(
        repository_id,
        {
            "integration_id": message.get("integrationId"),
            "developer_id": message.get("developerId"),
            "chunk_count": int(transport.get("chunkCount", 1)),
            "chunks": {},
            "updated_at": time(),
        },
    )
    state["updated_at"] = time()
    state["chunk_count"] = max(state["chunk_count"], int(transport.get("chunkCount", 1)))
    state["chunks"][int(transport["chunkIndex"])] = transport["payload"]

    received_count = len(state["chunks"])
    emit_progress(
        repository_id,
        state.get("developer_id"),
        state.get("integration_id"),
        message.get("githubUsername"),
        66,
        f"Receiving repository snapshot in NLP ({received_count}/{state['chunk_count']})",
    )

    if received_count < state["chunk_count"]:
        return None

    ordered_chunks = [
        state["chunks"][index]
        for index in range(1, state["chunk_count"] + 1)
        if index in state["chunks"]
    ]
    if len(ordered_chunks) != state["chunk_count"]:
        return None

    import base64
    import json

    decoded = b"".join(base64.b64decode(chunk) for chunk in ordered_chunks)
    pending_snapshot_chunks.pop(repository_id, None)
    return json.loads(decoded.decode("utf-8"))


def consume_kafka_jobs():
    import asyncio
    import json

    consumer = KafkaConsumer(
        "commit.analysis",
        bootstrap_servers=settings.KAFKA_BROKERS.split(","),
        group_id=settings.KAFKA_CONSUMER_GROUP,
        value_deserializer=lambda value: json.loads(value.decode("utf-8")),
        auto_offset_reset="latest",
        enable_auto_commit=True,
    )

    while not shutdown_event.is_set():
        _cleanup_stale_snapshots()
        batches = consumer.poll(timeout_ms=1000)
        for _, messages in batches.items():
            for message in messages:
                try:
                    reassembled_message = _reassemble_snapshot_chunk(message.value)
                    if reassembled_message is None:
                        continue
                    logger.info(
                        "received commit.analysis repo=%s partition=%s offset=%s",
                        reassembled_message.get("repositoryId"),
                        message.partition,
                        message.offset,
                    )
                    asyncio.run(process_analysis_job(reassembled_message))
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
