import json
import logging
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None

try:
    from groq import AsyncGroq
except ImportError:  # pragma: no cover - handled gracefully at runtime
    AsyncGroq = None


logger = logging.getLogger(__name__)


class LLMReviewer:
    async def review(
        self,
        diff_content: str,
        language: str,
        commit_message: str,
    ) -> dict:
        """
        Sends the diff to groq and gets structured weakness analysis back.
        """
        safe_default = {
            "weaknesses": [],
            "strengths": [],
            "overall_quality_score": None,
            "skill_level_signals": {
                "apparent_experience": "unknown",
                "reasoning": "LLM review unavailable.",
            },
        }
        if not diff_content.strip() or len(diff_content.strip()) < 40:
            return safe_default

        client = self._build_client()
        if not client:
            logger.warning("groq client is unavailable; skipping LLM review")
            return safe_default

        normalized_diff = diff_content
        if len(normalized_diff) > 4000:
            normalized_diff = normalized_diff[:4000] + "\n[truncated for length]"

        system_prompt = f"""You are a senior code reviewer specializing in {language} best practices.
Your job is to analyze code diffs and identify developer weaknesses —
not just bugs, but patterns that reveal gaps in understanding.

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

        user_message = (
            f"Commit message: {commit_message}\n"
            f"Language: {language}\n"
            f"Full diff:\n{normalized_diff}"
        )

        try:
            response = await client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                temperature=0.1,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            logger.warning("LLM review failed: %s", exc)
            return safe_default
        finally:
            await self._close_client(client)

        raw_content = ""
        try:
            raw_content = response.choices[0].message.content or ""
            parsed = json.loads(raw_content)
        except Exception:
            logger.warning("Failed to parse LLM JSON response: %s", raw_content)
            return safe_default

        return {
            "weaknesses": parsed.get("weaknesses", []),
            "strengths": parsed.get("strengths", []),
            "overall_quality_score": parsed.get("overall_quality_score"),
            "skill_level_signals": parsed.get(
                "skill_level_signals",
                safe_default["skill_level_signals"],
            ),
        }

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

    def _build_client(self):
        if not AsyncGroq:
            return None

        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key and load_dotenv:
            for env_path in self._candidate_env_paths():
                if env_path.exists():
                    load_dotenv(env_path, override=False)
                    api_key = os.environ.get("GROQ_API_KEY")
                    if api_key:
                        break

        if not api_key:
            return None

        try:
            return AsyncGroq(api_key=api_key)
        except Exception as exc:
            logger.warning("Failed to initialize Groq client: %s", exc)
            return None

    def _candidate_env_paths(self) -> list[Path]:
        current_file = Path(__file__).resolve()
        return [
            Path.cwd() / ".env",
            current_file.parents[2] / ".env",
            current_file.parents[4] / ".env",
        ]

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
            logger.debug("Failed to close Groq client cleanly", exc_info=True)
