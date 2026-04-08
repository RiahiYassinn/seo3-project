import asyncio
import logging
from collections.abc import Awaitable, Callable

from app.services.llm_reviewer import LLMReviewer
from app.services.static_analyzer import StaticAnalyzer
from app.services.weakness_aggregator import WeaknessAggregator


logger = logging.getLogger(__name__)


class CodeAnalyzer:
    def __init__(self):
        self.static_analyzer = StaticAnalyzer()
        self.llm_reviewer = LLMReviewer()
        self.aggregator = WeaknessAggregator()

    async def analyze(
        self,
        files_with_content: dict[str, str],
        diff_content: str,
        commit_message: str,
        developer_id: str,
        existing_profile: dict | None = None,
        progress_callback: Callable[[int, str], Awaitable[None] | None] | None = None,
    ) -> dict:
        """
        Runs both analysis layers in parallel using asyncio.gather(),
        then aggregates results.

        Returns the full weakness profile from WeaknessAggregator.
        Also logs: developer_id, number of files, issues found, quality score.
        """
        language = self.llm_reviewer._detect_language(list(files_with_content))

        async def emit_progress(progress: int, stage: str) -> None:
            if not progress_callback:
                return
            result = progress_callback(progress, stage)
            if asyncio.iscoroutine(result):
                await result

        async def run_static():
            await emit_progress(72, "Running static analysis")
            result = await self.static_analyzer.analyze(files_with_content)
            await emit_progress(82, "Static analysis completed")
            return result

        async def run_llm():
            await emit_progress(74, "Running semantic diff review")
            async def llm_progress(local_progress: int, stage: str) -> None:
                mapped_progress = 74 + min(13, int((max(0, local_progress) / 100) * 13))
                await emit_progress(mapped_progress, stage)

            result = await self.llm_reviewer.review(
                diff_content,
                language,
                commit_message,
                progress_callback=llm_progress,
            )
            await emit_progress(88, "Semantic diff review completed")
            return result

        static_issues, llm_review = await asyncio.gather(run_static(), run_llm())
        await emit_progress(94, "Aggregating weakness profile")
        profile = self.aggregator.aggregate(static_issues, llm_review, existing_profile)
        profile["analysis_metadata"] = {
            "files_analyzed": len(files_with_content),
            "static_issue_count": len(static_issues),
            "llm_weakness_count": len(llm_review.get("weaknesses", [])),
            "llm_provider_metadata": llm_review.get("provider_metadata", {}),
        }
        logger.info(
            "developer_id=%s files=%s issues=%s quality_score=%s",
            developer_id,
            len(files_with_content),
            len(static_issues) + len(llm_review.get("weaknesses", [])),
            profile.get("quality_score"),
        )
        return profile
