# syntax=docker/dockerfile:1
#
# Build context is the REPOSITORY ROOT, so every service builds the same way:
#   docker build -f services/nlp-service/Dockerfile -t devlab/nlp-service .

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# ---------- dependencies ----------
FROM base AS deps

# Build toolchain is only needed to compile wheels, so keep it out of runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY services/nlp-service/requirements.txt ./
RUN pip install --prefix=/install -r requirements.txt

# ---------- runtime ----------
FROM base AS runner

COPY --from=deps /install /usr/local

RUN useradd --create-home --uid 1001 appuser

COPY --chown=appuser:appuser services/nlp-service/main.py ./
COPY --chown=appuser:appuser services/nlp-service/app ./app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
