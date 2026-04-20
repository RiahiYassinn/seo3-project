from __future__ import annotations

from collections import defaultdict

from app.services.analysis_types import (
    DiffFileSummary,
    RuleFinding,
    SemanticFact,
    SemanticReport,
    StaticFinding,
)


class RuleEngine:
    def evaluate(
        self,
        semantic_report: SemanticReport,
        static_findings: list[StaticFinding],
        diff_summary: dict[str, DiffFileSummary],
        commit_message: str,
    ) -> list[RuleFinding]:
        findings: list[RuleFinding] = []
        static_by_file: dict[str, list[StaticFinding]] = defaultdict(list)
        for finding in static_findings:
            static_by_file[finding.file_path].append(finding)

        for fact in semantic_report.facts:
            file_static_findings = static_by_file.get(fact.file_path, [])
            findings.extend(self._evaluate_fact(fact, file_static_findings))

        return self._deduplicate(findings)

    def _evaluate_fact(
        self,
        fact: SemanticFact,
        static_findings: list[StaticFinding],
    ) -> list[RuleFinding]:
        findings: list[RuleFinding] = []
        changed_line = fact.changed_lines[0] if fact.changed_lines else None

        if fact.language in {"typescript", "javascript"}:
            if fact.signals.get("uses_use_effect") and fact.signals.get("uses_fetch"):
                if not fact.signals.get("has_cleanup"):
                    findings.append(
                        self._finding(
                            fact=fact,
                            line=changed_line,
                            category="performance",
                            skill="frontend_react_hooks",
                            title="Missing cleanup in React side effect",
                            message="This changed code looks like a React effect performing async work without a cleanup path.",
                            severity="medium",
                            rule_id="react.effect.cleanup",
                            confidence=0.88,
                            evidence=["useEffect + fetch detected without cleanup return"],
                            tags=["react", "useEffect", "async"],
                        )
                    )
                if not fact.signals.get("has_error_handling"):
                    findings.append(
                        self._finding(
                            fact=fact,
                            line=changed_line,
                            category="error_handling",
                            skill="async_error_handling",
                            title="API side effect is missing error handling",
                            message="The semantic analyzer identified an API call inside UI side-effect code without catch/try handling.",
                            severity="high",
                            rule_id="react.effect.api.error-handling",
                            confidence=0.9,
                            evidence=["useEffect + fetch detected without catch/try"],
                            tags=["react", "api_call"],
                        )
                    )
                if not fact.signals.get("has_loading_state"):
                    findings.append(
                        self._finding(
                            fact=fact,
                            line=changed_line,
                            category="code_quality",
                            skill="frontend_async_state_management",
                            title="Async UI flow lacks loading-state handling",
                            message="The code appears to initiate user-visible async work without a loading state signal.",
                            severity="medium",
                            rule_id="frontend.async.loading-state",
                            confidence=0.7,
                            evidence=["fetch detected without loading-state signal"],
                            tags=["ux", "async"],
                        )
                    )

            if fact.signals.get("uses_fetch") and not fact.signals.get("checks_response_ok"):
                findings.append(
                    self._finding(
                        fact=fact,
                        line=changed_line,
                        category="error_handling",
                        skill="async_error_handling",
                        title="HTTP response is consumed without status validation",
                        message="The changed path performs a fetch call but does not validate `response.ok` before reading the payload.",
                        severity="high",
                        rule_id="http.response.ok-check",
                        confidence=0.95,
                        evidence=["fetch detected without response.ok"],
                        tags=["http", "fetch"],
                    )
                )

            if fact.signals.get("uses_any"):
                findings.append(
                    self._finding(
                        fact=fact,
                        line=changed_line,
                        category="code_quality",
                        skill="type_safety",
                        title="Weak typing reduces deterministic guarantees",
                        message="The semantic layer found use of `any`, which weakens type safety and usually hides shape validation gaps.",
                        severity="medium",
                        rule_id="typescript.any",
                        confidence=0.86,
                        evidence=["TypeScript any usage detected"],
                        tags=["typescript"],
                    )
                )

            if (
                fact.file_role in {"controller", "service"}
                and "database_query" in fact.intents
                and "nestjs" in fact.frameworks
            ):
                findings.append(
                    self._finding(
                        fact=fact,
                        line=changed_line,
                        category="architecture",
                        skill="api_service_design",
                        title="NestJS service/controller is coupled to persistence details",
                        message="The code intent suggests request-handling logic mixed with direct query-oriented behavior.",
                        severity="medium",
                        rule_id="nestjs.layering.query-coupling",
                        confidence=0.68,
                        evidence=["file role and database-query intent overlap"],
                        tags=["nestjs", "architecture"],
                    )
                )

        if fact.language == "python":
            if fact.signals.get("bare_except"):
                findings.append(
                    self._finding(
                        fact=fact,
                        line=changed_line,
                        category="error_handling",
                        skill="python_error_handling",
                        title="Bare except hides the real failure type",
                        message="The semantic parser found a bare `except` block in changed Python code.",
                        severity="critical",
                        rule_id="python.except.bare",
                        confidence=0.98,
                        evidence=["bare except detected"],
                        tags=["python", "exceptions"],
                    )
                )
            if fact.signals.get("broad_except") and not fact.signals.get("has_raise"):
                findings.append(
                    self._finding(
                        fact=fact,
                        line=changed_line,
                        category="error_handling",
                        skill="python_error_handling",
                        title="Broad exception handling without re-raise",
                        message="The changed Python path catches `Exception` broadly and does not appear to re-raise.",
                        severity="high",
                        rule_id="python.except.exception-swallow",
                        confidence=0.9,
                        evidence=["broad except detected without raise"],
                        tags=["python", "exceptions"],
                    )
                )
            if fact.signals.get("hardcoded_secret"):
                findings.append(
                    self._finding(
                        fact=fact,
                        line=changed_line,
                        category="security",
                        skill="security_secrets_auth",
                        title="Hardcoded secret-like value in source code",
                        message="The changed Python code appears to embed a secret/token/password literal directly in source.",
                        severity="critical",
                        rule_id="python.security.hardcoded-secret",
                        confidence=0.96,
                        evidence=["secret/password/token assignment detected"],
                        tags=["security", "secret-management"],
                    )
                )
            if "database_query" in fact.intents and "authentication" in fact.intents:
                findings.append(
                    self._finding(
                        fact=fact,
                        line=changed_line,
                        category="security",
                        skill="security_secrets_auth",
                        title="Authentication logic is coupled to direct data-access flow",
                        message="Semantic facts show authentication intent mixed with query-like behavior in the same code path.",
                        severity="medium",
                        rule_id="python.auth.query-coupling",
                        confidence=0.7,
                        evidence=["authentication + database_query intents detected together"],
                        tags=["auth", "data-access"],
                    )
                )
            if fact.file_role in {"service", "module"} and not fact.signals.get("has_docstrings"):
                findings.append(
                    self._finding(
                        fact=fact,
                        line=changed_line,
                        category="documentation",
                        skill="documentation_readability",
                        title="Public Python module lacks documentation context",
                        message="No module/function documentation signal was found in changed Python service logic.",
                        severity="low",
                        rule_id="python.docs.missing",
                        confidence=0.6,
                        evidence=["module/function docstrings missing"],
                        tags=["docs"],
                    )
                )

        if fact.changed and not fact.signals.get("has_tests") and fact.file_role != "test":
            findings.append(
                self._finding(
                    fact=fact,
                    line=changed_line,
                    category="testing",
                    skill="testing_reliability",
                    title="Changed production code has no nearby testing signal",
                    message="Changed code path looks like production logic, but no test-oriented signal was found in the file.",
                    severity="medium",
                    rule_id="testing.missing-signal",
                    confidence=0.66,
                    evidence=["changed non-test file without test signal"],
                    tags=["testing"],
                )
            )

        if (
            fact.changed
            and fact.file_role in {"controller", "service", "repository"}
            and not fact.signals.get("has_docs", False)
            and not fact.signals.get("has_docstrings", False)
        ):
            findings.append(
                self._finding(
                    fact=fact,
                    line=changed_line,
                    category="documentation",
                    skill="documentation_readability",
                    title="Changed service boundary lacks documentation",
                    message="Changed service/controller/repository boundary has little semantic documentation context.",
                    severity="low",
                    rule_id="docs.boundary.missing",
                    confidence=0.58,
                    evidence=["boundary file role without docs signal"],
                    tags=["docs", "maintainability"],
                )
            )

        findings.extend(self._promote_static_findings(fact, static_findings))
        return findings

    def _promote_static_findings(
        self,
        fact: SemanticFact,
        static_findings: list[StaticFinding],
    ) -> list[RuleFinding]:
        promoted: list[RuleFinding] = []
        for finding in static_findings:
            confidence = min(
                0.99,
                finding.confidence
                + (0.08 if fact.changed else 0.0)
                + (0.05 if finding.skill in fact.intents else 0.0),
            )
            promoted.append(
                RuleFinding(
                    file_path=finding.file_path,
                    line=finding.line,
                    category=finding.category,
                    skill=finding.skill,
                    title=finding.message,
                    message=finding.message,
                    severity=finding.severity,
                    rule_id=finding.rule_id,
                    confidence=round(confidence, 2),
                    evidence=[finding.evidence or f"{finding.source} reported {finding.rule_id}"],
                    related_symbols=[symbol.name for symbol in fact.symbols if symbol.changed][:3],
                    tags=finding.tags,
                    source=finding.source,
                )
            )
        return promoted

    def _finding(
        self,
        fact: SemanticFact,
        line: int | None,
        category: str,
        skill: str,
        title: str,
        message: str,
        severity: str,
        rule_id: str,
        confidence: float,
        evidence: list[str],
        tags: list[str],
    ) -> RuleFinding:
        return RuleFinding(
            file_path=fact.file_path,
            line=line,
            category=category,
            skill=skill,
            title=title,
            message=message,
            severity=severity,
            rule_id=rule_id,
            confidence=confidence,
            evidence=evidence,
            related_symbols=[symbol.name for symbol in fact.symbols if symbol.changed][:5],
            tags=tags,
        )

    def _deduplicate(self, findings: list[RuleFinding]) -> list[RuleFinding]:
        deduped: dict[tuple[str, int | None, str], RuleFinding] = {}
        for finding in findings:
            key = (finding.file_path, finding.line, finding.rule_id)
            existing = deduped.get(key)
            if not existing or finding.confidence > existing.confidence:
                deduped[key] = finding
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        return sorted(
            deduped.values(),
            key=lambda item: (
                -severity_order.get(item.severity, 0),
                -item.confidence,
                item.file_path,
                item.line or 0,
            ),
        )
