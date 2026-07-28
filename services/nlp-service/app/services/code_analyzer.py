import asyncio
import logging
from collections.abc import Awaitable, Callable

from app.services.diff_parser import DiffParser
from app.services.report_builder import ReportBuilder
from app.services.rule_engine import RuleEngine
from app.services.semantic_analyzer import SemanticAnalyzer
from app.services.static_analyzer import StaticAnalyzer


logger = logging.getLogger(__name__)


class CodeAnalyzer:
    def __init__(self) -> None:
        self.diff_parser = DiffParser()
        self.static_analyzer = StaticAnalyzer()
        self.semantic_analyzer = SemanticAnalyzer()
        self.rule_engine = RuleEngine()
        self.report_builder = ReportBuilder()

    async def analyze(
        self,
        files_with_content: dict[str, str],
        diff_content: str,
        commit_message: str,
        developer_id: str,
        existing_profile: dict | None = None,
        progress_callback: Callable[[int, str], Awaitable[None] | None] | None = None,
    ) -> dict:
        async def emit_progress(progress: int, stage: str) -> None:
            if not progress_callback:
                return
            result = progress_callback(progress, stage)
            if asyncio.iscoroutine(result):
                await result

        await emit_progress(70, "Parsing changed lines from unified diff")
        diff_summary = self.diff_parser.parse(diff_content)

        async def run_static():
            await emit_progress(74, "Running static analysis tools and deterministic heuristics")
            result = await self.static_analyzer.analyze(files_with_content, diff_summary)
            await emit_progress(82, "Static analysis completed")
            return result

        async def run_semantic():
            await emit_progress(76, "Building semantic facts from code structure")
            result = self.semantic_analyzer.analyze(
                files_with_content=files_with_content,
                diff_summary=diff_summary,
                commit_message=commit_message,
            )
            await emit_progress(86, "Semantic analysis completed")
            return result

        static_findings, semantic_report = await asyncio.gather(run_static(), run_semantic())

        await emit_progress(90, "Evaluating deterministic rules with semantic context")
        rule_findings = self.rule_engine.evaluate(
            semantic_report=semantic_report,
            static_findings=static_findings,
            diff_summary=diff_summary,
            commit_message=commit_message,
        )

        await emit_progress(95, "Building full weakness report")
        profile = self.report_builder.build(
            static_findings=static_findings,
            semantic_report=semantic_report,
            rule_findings=rule_findings,
            existing_profile=existing_profile,
        )
        logger.info(
            "developer_id=%s files=%s findings=%s quality_score=%s",
            developer_id,
            len(files_with_content),
            len(profile.get("findings", [])),
            profile.get("quality_score"),
        )
        return profile
