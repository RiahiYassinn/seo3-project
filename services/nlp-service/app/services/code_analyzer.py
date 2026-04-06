import asyncio
import logging

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
    ) -> dict:
        """
        Runs both analysis layers in parallel using asyncio.gather(),
        then aggregates results.

        Returns the full weakness profile from WeaknessAggregator.
        Also logs: developer_id, number of files, issues found, quality score.
        """
        language = self.llm_reviewer._detect_language(list(files_with_content))
        static_issues, llm_review = await asyncio.gather(
            self.static_analyzer.analyze(files_with_content),
            self.llm_reviewer.review(diff_content, language, commit_message),
        )
        profile = self.aggregator.aggregate(static_issues, llm_review, existing_profile)
        logger.info(
            "developer_id=%s files=%s issues=%s quality_score=%s",
            developer_id,
            len(files_with_content),
            len(static_issues) + len(llm_review.get("weaknesses", [])),
            profile.get("quality_score"),
        )
        return profile
