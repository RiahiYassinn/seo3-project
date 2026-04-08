import json
import logging
import os
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None

try:
    from google import genai
except ImportError:  # pragma: no cover - handled gracefully at runtime
    genai = None

try:
    from groq import AsyncGroq
except ImportError:  # pragma: no cover - handled gracefully at runtime
    AsyncGroq = None


logger = logging.getLogger(__name__)
logging.getLogger("groq._base_client").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)


class LLMReviewer:
    MAX_DIFF_CHARS_PER_REQUEST = 4000

    async def review(
        self,
        diff_content: str,
        language: str,
        commit_message: str,
        progress_callback: Callable[[int, str], Awaitable[None] | None] | None = None,
    ) -> dict:
        """
        Sends the diff to the configured LLM providers and gets structured weakness analysis back.
        Gemini is used as the primary provider and Groq is used as the fallback by default.
        """
        safe_default = self._safe_default()
        if not diff_content.strip() or len(diff_content.strip()) < 40:
            return safe_default

        system_prompt = f"""You are a senior code reviewer specializing in {language} best practices.
Your job is to analyze code diffs and identify developer weaknesses, not just bugs, but patterns that reveal gaps in understanding.

Prefer the most specific weakness category that fits the evidence.
Use "language_idioms" only when a more specific category such as error_handling,
security, code_complexity, performance, documentation, naming_conventions,
testing, or dependency_management does not fit.

You must respond ONLY with valid JSON matching this exact schema:
{{
  "weaknesses": [
    {{
      "category": "<one of the WEAKNESS_CATEGORIES keys>",
      "severity": "<low|medium|high>",
      "description": "<specific observation about the code, 1-2 sentences>",
      "evidence": "<the exact code snippet that demonstrates this weakness>",
      "recommendation": "<specific actionable advice, not generic>",
      "learning_query": "<a search query to find a course or resource that addresses this>"
    }}
  ],
  "strengths": [
    "<one sentence describing something the developer did well>"
  ],
  "overall_quality_score": <0-10 float>,
  "skill_level_signals": {{
    "apparent_experience": "<junior|mid|senior>",
    "reasoning": "<one sentence explaining why>"
  }}
}}

If the diff is too small to assess, return weaknesses: [] and score: null.
Return JSON only. No markdown, no explanation outside the JSON."""

        providers = self._provider_order()
        chunks = self._split_diff(diff_content)
        reviews: list[dict[str, Any]] = []

        async def emit_progress(progress: int, stage: str) -> None:
            if not progress_callback:
                return
            result = progress_callback(progress, stage)
            if hasattr(result, "__await__"):
                await result

        for index, chunk in enumerate(chunks, start=1):
            await emit_progress(
                self._chunk_progress(index - 1, len(chunks)),
                f"Semantic review chunk {index}/{len(chunks)} queued",
            )
            review = await self._review_chunk_with_fallback(
                providers=providers,
                system_prompt=system_prompt,
                diff_chunk=chunk,
                chunk_index=index,
                chunk_total=len(chunks),
                language=language,
                commit_message=commit_message,
                safe_default=safe_default,
                progress_callback=emit_progress,
            )
            reviews.append(review)
            await emit_progress(
                self._chunk_progress(index, len(chunks)),
                f"Semantic review chunk {index}/{len(chunks)} completed",
            )

        return self._merge_reviews(reviews, safe_default)

    def _detect_language(self, files: list[str]) -> str:
        """
        Returns the dominant language from file extensions.
        Fallback to "general" if unknown.
        """
        counts: dict[str, int] = {}
        extension_map = {
            ".py": "python",
            ".ts": "typescript",
            ".tsx": "typescript",
            ".js": "javascript",
            ".jsx": "javascript",
            ".java": "java",
            ".go": "go",
            ".rs": "rust",
        }

        for file_name in files:
            language = extension_map.get(Path(file_name).suffix.lower())
            if language:
                counts[language] = counts.get(language, 0) + 1

        if not counts:
            return "general"
        return max(counts.items(), key=lambda item: item[1])[0]

    def _provider_order(self) -> list[str]:
        self._load_env()
        configured = [
            os.environ.get("LLM_PRIMARY_PROVIDER", "gemini"),
            os.environ.get("LLM_FALLBACK_PROVIDER", "groq"),
        ]
        providers: list[str] = []
        for provider in configured:
            normalized = (provider or "").strip().lower()
            if normalized in {"gemini", "groq"} and normalized not in providers:
                providers.append(normalized)
        return providers or ["gemini", "groq"]

    def _load_env(self) -> None:
        if not load_dotenv:
            return
        for env_path in self._candidate_env_paths():
            if env_path.exists():
                load_dotenv(env_path, override=False)

    def _candidate_env_paths(self) -> list[Path]:
        current_file = Path(__file__).resolve()
        return [
            Path.cwd() / ".env",
            current_file.parents[2] / ".env",
            current_file.parents[4] / ".env",
        ]

    def _build_gemini_client(self):
        if not genai:
            return None

        self._load_env()
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            return None

        try:
            return genai.Client(api_key=api_key)
        except Exception as exc:
            logger.warning("Failed to initialize Gemini client: %s", exc)
            return None

    def _build_groq_client(self):
        if not AsyncGroq:
            return None

        self._load_env()
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            return None

        try:
            return AsyncGroq(api_key=api_key)
        except Exception as exc:
            logger.warning("Failed to initialize Groq client: %s", exc)
            return None

    async def _close_client(self, client) -> None:
        if not client:
            return
        close_method = getattr(client, "close", None) or getattr(client, "aclose", None)
        if not close_method:
            return
        try:
            result = close_method()
            if hasattr(result, "__await__"):
                await result
        except Exception:
            logger.debug("Failed to close client cleanly", exc_info=True)

    def _split_diff(self, diff_content: str) -> list[str]:
        if len(diff_content) <= self.MAX_DIFF_CHARS_PER_REQUEST:
            return [diff_content]

        sections = diff_content.split("\ncommit ")
        chunks: list[str] = []
        current_chunk = ""

        for index, section in enumerate(sections):
            normalized_section = section if index == 0 else f"commit {section}"
            if not normalized_section.strip():
                continue

            if len(normalized_section) > self.MAX_DIFF_CHARS_PER_REQUEST:
                if current_chunk:
                    chunks.append(current_chunk)
                    current_chunk = ""
                chunks.extend(self._split_large_section(normalized_section))
                continue

            proposed_chunk = (
                normalized_section
                if not current_chunk
                else f"{current_chunk}\n\n{normalized_section}"
            )
            if len(proposed_chunk) <= self.MAX_DIFF_CHARS_PER_REQUEST:
                current_chunk = proposed_chunk
                continue

            chunks.append(current_chunk)
            current_chunk = normalized_section

        if current_chunk:
            chunks.append(current_chunk)

        return chunks or [diff_content[: self.MAX_DIFF_CHARS_PER_REQUEST]]

    def _split_large_section(self, section: str) -> list[str]:
        lines = section.splitlines()
        chunks: list[str] = []
        current_lines: list[str] = []

        for line in lines:
            proposed = "\n".join(current_lines + [line])
            if current_lines and len(proposed) > self.MAX_DIFF_CHARS_PER_REQUEST:
                chunks.append("\n".join(current_lines))
                current_lines = [line]
                continue
            current_lines.append(line)

        if current_lines:
            chunks.append("\n".join(current_lines))

        return chunks

    async def _review_chunk_with_fallback(
        self,
        providers: list[str],
        system_prompt: str,
        diff_chunk: str,
        chunk_index: int,
        chunk_total: int,
        language: str,
        commit_message: str,
        safe_default: dict[str, Any],
        progress_callback: Callable[[int, str], Awaitable[None] | None],
    ) -> dict[str, Any]:
        for provider in providers:
            await progress_callback(
                self._chunk_progress(chunk_index - 1, chunk_total),
                f"Reviewing chunk {chunk_index}/{chunk_total} with {provider.capitalize()}",
            )

            if provider == "gemini":
                review = await self._review_with_gemini(
                    system_prompt=system_prompt,
                    diff_chunk=diff_chunk,
                    chunk_index=chunk_index,
                    chunk_total=chunk_total,
                    language=language,
                    commit_message=commit_message,
                    safe_default=safe_default,
                )
            else:
                review = await self._review_with_groq(
                    system_prompt=system_prompt,
                    diff_chunk=diff_chunk,
                    chunk_index=chunk_index,
                    chunk_total=chunk_total,
                    language=language,
                    commit_message=commit_message,
                    safe_default=safe_default,
                )

            if not review.get("_provider_error"):
                review["provider"] = provider
                return review

            logger.warning(
                "%s review failed for chunk %s/%s: %s",
                provider.capitalize(),
                chunk_index,
                chunk_total,
                review["_provider_error"],
            )
            await progress_callback(
                self._chunk_progress(chunk_index - 1, chunk_total),
                f"{provider.capitalize()} failed for chunk {chunk_index}/{chunk_total}, trying fallback",
            )

        return safe_default

    async def _review_with_gemini(
        self,
        system_prompt: str,
        diff_chunk: str,
        chunk_index: int,
        chunk_total: int,
        language: str,
        commit_message: str,
        safe_default: dict[str, Any],
    ) -> dict[str, Any]:
        import asyncio

        client = self._build_gemini_client()
        if not client:
            result = dict(safe_default)
            result["_provider_error"] = "Gemini client is unavailable."
            return result

        prompt = (
            f"{system_prompt}\n\n"
            f"Commit message: {commit_message}\n"
            f"Language: {language}\n"
            f"Diff chunk: {chunk_index}/{chunk_total}\n"
            f"Full diff content for this chunk:\n{diff_chunk}"
        )

        def run_request():
            return client.models.generate_content(
                model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
                contents=prompt,
                config={
                    "temperature": 0.1,
                    "response_mime_type": "application/json",
                },
            )

        try:
            response = await asyncio.wait_for(asyncio.to_thread(run_request), timeout=60)
        except Exception as exc:
            result = dict(safe_default)
            result["_provider_error"] = str(exc)
            return result

        raw_content = ""
        try:
            raw_content = getattr(response, "text", "") or ""
            parsed = json.loads(raw_content)
        except Exception:
            result = dict(safe_default)
            result["_provider_error"] = (
                f"Failed to parse Gemini JSON response for chunk {chunk_index}/{chunk_total}: {raw_content}"
            )
            return result

        return {
            "weaknesses": parsed.get("weaknesses", []),
            "strengths": parsed.get("strengths", []),
            "overall_quality_score": parsed.get("overall_quality_score"),
            "skill_level_signals": parsed.get(
                "skill_level_signals",
                safe_default["skill_level_signals"],
            ),
        }

    async def _review_with_groq(
        self,
        system_prompt: str,
        diff_chunk: str,
        chunk_index: int,
        chunk_total: int,
        language: str,
        commit_message: str,
        safe_default: dict[str, Any],
    ) -> dict[str, Any]:
        import asyncio

        client = self._build_groq_client()
        if not client:
            result = dict(safe_default)
            result["_provider_error"] = "Groq client is unavailable."
            return result

        user_message = (
            f"Commit message: {commit_message}\n"
            f"Language: {language}\n"
            f"Diff chunk: {chunk_index}/{chunk_total}\n"
            f"Full diff content for this chunk:\n{diff_chunk}"
        )

        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
                    temperature=0.1,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    response_format={"type": "json_object"},
                ),
                timeout=45,
            )
        except Exception as exc:
            result = dict(safe_default)
            result["_provider_error"] = str(exc)
            return result
        finally:
            await self._close_client(client)

        raw_content = ""
        try:
            raw_content = response.choices[0].message.content or ""
            parsed = json.loads(raw_content)
        except Exception:
            result = dict(safe_default)
            result["_provider_error"] = (
                f"Failed to parse Groq JSON response for chunk {chunk_index}/{chunk_total}: {raw_content}"
            )
            return result

        return {
            "weaknesses": parsed.get("weaknesses", []),
            "strengths": parsed.get("strengths", []),
            "overall_quality_score": parsed.get("overall_quality_score"),
            "skill_level_signals": parsed.get(
                "skill_level_signals",
                safe_default["skill_level_signals"],
            ),
        }

    def _merge_reviews(
        self,
        reviews: list[dict[str, Any]],
        safe_default: dict[str, Any],
    ) -> dict[str, Any]:
        if not reviews:
            return safe_default

        merged_weaknesses: list[dict[str, Any]] = []
        seen_weaknesses: set[tuple[str, str, str]] = set()
        strengths: list[str] = []
        seen_strengths: set[str] = set()
        quality_scores: list[float] = []
        experience_votes = {"junior": 0, "mid": 0, "senior": 0}
        reasoning_notes: list[str] = []
        providers_used: list[str] = []

        for review in reviews:
            provider = str(review.get("provider", "")).strip()
            if provider and provider not in providers_used:
                providers_used.append(provider)

            for weakness in review.get("weaknesses", []):
                key = (
                    str(weakness.get("category", "")),
                    str(weakness.get("evidence", "")),
                    str(weakness.get("recommendation", "")),
                )
                if key in seen_weaknesses:
                    continue
                seen_weaknesses.add(key)
                merged_weaknesses.append(weakness)

            for strength in review.get("strengths", []):
                normalized_strength = str(strength).strip()
                if not normalized_strength or normalized_strength in seen_strengths:
                    continue
                seen_strengths.add(normalized_strength)
                strengths.append(normalized_strength)

            score = review.get("overall_quality_score")
            if isinstance(score, (int, float)):
                quality_scores.append(float(score))

            signals = review.get("skill_level_signals") or {}
            apparent_experience = signals.get("apparent_experience")
            if apparent_experience in experience_votes:
                experience_votes[apparent_experience] += 1

            reasoning = str(signals.get("reasoning", "")).strip()
            if reasoning:
                reasoning_notes.append(reasoning)

        apparent_experience = "unknown"
        if any(experience_votes.values()):
            apparent_experience = max(
                experience_votes.items(),
                key=lambda item: (item[1], -["junior", "mid", "senior"].index(item[0])),
            )[0]

        unique_reasoning: list[str] = []
        for note in reasoning_notes:
            if note not in unique_reasoning:
                unique_reasoning.append(note)

        return {
            "weaknesses": merged_weaknesses,
            "strengths": strengths,
            "overall_quality_score": (
                round(sum(quality_scores) / len(quality_scores), 2)
                if quality_scores
                else None
            ),
            "skill_level_signals": {
                "apparent_experience": apparent_experience,
                "reasoning": (
                    " ".join(unique_reasoning[:2])
                    if unique_reasoning
                    else safe_default["skill_level_signals"]["reasoning"]
                ),
            },
            "provider_metadata": {
                "providers_used": providers_used,
                "chunks_reviewed": len(reviews),
            },
        }

    def _safe_default(self) -> dict[str, Any]:
        return {
            "weaknesses": [],
            "strengths": [],
            "overall_quality_score": None,
            "skill_level_signals": {
                "apparent_experience": "unknown",
                "reasoning": "LLM review unavailable.",
            },
            "provider_metadata": {
                "providers_used": [],
                "chunks_reviewed": 0,
            },
        }

    def _chunk_progress(self, completed_chunks: int, total_chunks: int) -> int:
        if total_chunks <= 0:
            return 100
        return min(100, max(5, int((completed_chunks / total_chunks) * 100)))
