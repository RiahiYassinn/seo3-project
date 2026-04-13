from __future__ import annotations

from collections import defaultdict
from math import isfinite

from app.services.analysis_types import RuleFinding, SemanticReport, StaticFinding


RESOURCE_MAP = {
    "frontend_react_hooks": [
        {
            "title": "React Effects",
            "type": "official_docs",
            "url": "https://react.dev/learn/synchronizing-with-effects",
        },
        {
            "title": "React useEffect Reference",
            "type": "guide",
            "url": "https://react.dev/reference/react/useEffect",
        },
    ],
    "async_error_handling": [
        {
            "title": "MDN Fetch API",
            "type": "guide",
            "url": "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch",
        }
    ],
    "type_safety": [
        {
            "title": "TypeScript Handbook",
            "type": "official_docs",
            "url": "https://www.typescriptlang.org/docs/",
        }
    ],
    "python_error_handling": [
        {
            "title": "Python Exceptions",
            "type": "official_docs",
            "url": "https://docs.python.org/3/tutorial/errors.html",
        }
    ],
    "security_secrets_auth": [
        {
            "title": "OWASP Cheat Sheet Series",
            "type": "security",
            "url": "https://cheatsheetseries.owasp.org/",
        }
    ],
    "testing_reliability": [
        {
            "title": "Testing Library",
            "type": "guide",
            "url": "https://testing-library.com/docs/",
        },
        {
            "title": "pytest Documentation",
            "type": "official_docs",
            "url": "https://docs.pytest.org/",
        },
    ],
    "documentation_readability": [
        {
            "title": "Write the Docs Guide",
            "type": "guide",
            "url": "https://www.writethedocs.org/guide/",
        }
    ],
    "api_service_design": [
        {
            "title": "NestJS Providers",
            "type": "official_docs",
            "url": "https://docs.nestjs.com/providers",
        }
    ],
}


class ReportBuilder:
    def build(
        self,
        static_findings: list[StaticFinding],
        semantic_report: SemanticReport,
        rule_findings: list[RuleFinding],
        existing_profile: dict | None = None,
    ) -> dict:
        weakness_scores = self._build_scores(rule_findings, existing_profile)
        findings_payload = [self._serialize_finding(finding) for finding in rule_findings]
        skills = self._build_skill_summary(rule_findings)
        quality_score = self._quality_score(rule_findings)

        return {
            "version": "2.0.0",
            "dominant_language": semantic_report.dominant_language,
            "commit_topics": semantic_report.commit_topics,
            "quality_score": quality_score,
            "summary": {
                "finding_count": len(rule_findings),
                "critical_count": sum(1 for item in rule_findings if item.severity == "critical"),
                "high_count": sum(1 for item in rule_findings if item.severity == "high"),
                "medium_count": sum(1 for item in rule_findings if item.severity == "medium"),
                "low_count": sum(1 for item in rule_findings if item.severity == "low"),
            },
            "weakness_scores": weakness_scores,
            "skills": skills,
            "findings": findings_payload,
            "learning_resources": self._collect_resources(rule_findings),
            "analysis_metadata": {
                "semantic_fact_count": len(semantic_report.facts),
                "static_finding_count": len(static_findings),
                "rule_finding_count": len(rule_findings),
                "files_analyzed": len(semantic_report.facts),
                "changed_file_count": sum(1 for fact in semantic_report.facts if fact.changed),
            },
        }

    def _build_scores(
        self,
        rule_findings: list[RuleFinding],
        existing_profile: dict | None,
    ) -> dict[str, float]:
        weights = {"critical": 1.0, "high": 0.75, "medium": 0.45, "low": 0.2}
        scores: dict[str, float] = defaultdict(float)
        for finding in rule_findings:
            scores[finding.skill] += weights.get(finding.severity, 0.2) * finding.confidence

        if existing_profile:
            previous_scores = existing_profile.get("weakness_scores", {})
            for skill, score in list(scores.items()):
                scores[skill] = round(
                    (float(previous_scores.get(skill, 0.0)) * 0.35) + (score * 0.65),
                    4,
                )

        return {
            skill: round(min(value, 10.0), 2)
            for skill, value in sorted(scores.items(), key=lambda item: (-item[1], item[0]))
        }

    def _build_skill_summary(self, rule_findings: list[RuleFinding]) -> list[dict]:
        grouped: dict[str, list[RuleFinding]] = defaultdict(list)
        for finding in rule_findings:
            grouped[finding.skill].append(finding)

        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        summary = []
        for skill, findings in grouped.items():
            sorted_findings = sorted(
                findings,
                key=lambda item: (-severity_order.get(item.severity, 0), -item.confidence),
            )
            summary.append(
                {
                    "skill": skill,
                    "issue_count": len(findings),
                    "highest_severity": sorted_findings[0].severity,
                    "average_confidence": round(
                        sum(item.confidence for item in findings) / len(findings),
                        2,
                    ),
                    "example_titles": [item.title for item in sorted_findings[:3]],
                }
            )
        return sorted(summary, key=lambda item: (-item["issue_count"], item["skill"]))

    def _collect_resources(self, rule_findings: list[RuleFinding]) -> list[dict]:
        resources = []
        seen: set[tuple[str, str]] = set()
        for finding in rule_findings:
            for resource in RESOURCE_MAP.get(finding.skill, []):
                key = (finding.skill, resource["url"])
                if key in seen:
                    continue
                seen.add(key)
                resources.append({"skill": finding.skill, **resource})
        return resources

    def _serialize_finding(self, finding: RuleFinding) -> dict:
        return {
            "file_path": finding.file_path,
            "line": finding.line,
            "category": finding.category,
            "skill": finding.skill,
            "title": finding.title,
            "message": finding.message,
            "severity": finding.severity,
            "confidence": round(finding.confidence, 2),
            "rule_id": finding.rule_id,
            "source": finding.source,
            "evidence": finding.evidence,
            "related_symbols": finding.related_symbols,
            "tags": finding.tags,
        }

    def _quality_score(self, rule_findings: list[RuleFinding]) -> float:
        penalties = {"critical": 2.2, "high": 1.2, "medium": 0.55, "low": 0.2}
        total_penalty = sum(
            penalties.get(finding.severity, 0.2) * finding.confidence
            for finding in rule_findings
        )
        if total_penalty <= 0:
            return 10.0

        # Use diminishing returns so weak repositories still surface gradations
        # instead of collapsing to 0/10 after a few stacked findings.
        penalty_scale = 3.5 + (0.15 * len(rule_findings))
        score = 10.0 / (1.0 + (total_penalty / penalty_scale))
        if not isfinite(score):
            return 0.0
        return round(max(0.5, min(10.0, score)), 2)
