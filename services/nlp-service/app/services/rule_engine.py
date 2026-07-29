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
        observations = fact.observations or {}

        if fact.language in {"typescript", "javascript"}:
            react_fetch_pair_count = int(
                observations.get("react_effect_fetch_pairs_in_changed_scope", 0) or 0
            )
            fetch_count = int(observations.get("fetch_call_count_in_changed_scope", 0) or 0)
            response_ok_count = int(
                observations.get("response_ok_count_in_changed_scope", 0) or 0
            )
            error_handler_count = int(
                observations.get("error_handler_count_in_changed_scope", 0) or 0
            )
            loading_state_count = int(
                observations.get("loading_state_count_in_changed_scope", 0) or 0
            )
            any_count = int(observations.get("explicit_any_count_in_changed_scope", 0) or 0)

            if react_fetch_pair_count > 0:
                if not fact.signals.get("has_cleanup"):
                    findings.append(
                        self._finding(
                            fact=fact,
                            line=self._observation_line(observations, "use_effect_lines", changed_line),
                            category="performance",
                            skill="frontend_react_hooks",
                            title="Missing cleanup in React side effect",
                            message="The changed React effect appears to perform async work without a cleanup path in the same changed symbol.",
                            severity="medium",
                            rule_id="react.effect.cleanup",
                            confidence=0.88,
                            evidence=[
                                f"{react_fetch_pair_count} changed symbol(s) combine useEffect and fetch without cleanup",
                            ],
                            tags=["react", "useEffect", "async"],
                        )
                    )
                if error_handler_count == 0:
                    findings.append(
                        self._finding(
                            fact=fact,
                            line=self._observation_line(observations, "fetch_call_lines", changed_line),
                            category="error_handling",
                            skill="async_error_handling",
                            title="API side effect is missing error handling",
                            message="The changed React side-effect path performs async work without visible try/catch handling in the changed scope.",
                            severity="high",
                            rule_id="react.effect.api.error-handling",
                            confidence=0.9,
                            evidence=[
                                f"{react_fetch_pair_count} changed symbol(s) combine useEffect and fetch with no changed-scope error handler",
                            ],
                            tags=["react", "api_call"],
                        )
                    )
                if loading_state_count == 0:
                    findings.append(
                        self._finding(
                            fact=fact,
                            line=self._observation_line(observations, "fetch_call_lines", changed_line),
                            category="code_quality",
                            skill="frontend_async_state_management",
                            title="Async UI flow lacks loading-state handling",
                            message="The changed UI async path appears to initiate network work without a visible loading-state signal nearby.",
                            severity="medium",
                            rule_id="frontend.async.loading-state",
                            confidence=0.7,
                            evidence=[
                                f"{fetch_count} fetch call(s) in changed scope without loading-state markers",
                            ],
                            tags=["ux", "async"],
                        )
                    )

            if fetch_count > 0 and response_ok_count < fetch_count:
                findings.append(
                    self._finding(
                        fact=fact,
                        line=self._observation_line(observations, "fetch_call_lines", changed_line),
                        category="error_handling",
                        skill="async_error_handling",
                        title="HTTP response is consumed without status validation",
                        message="The changed path performs fetch calls but does not appear to validate `response.ok` for each changed-scope request.",
                        severity="high",
                        rule_id="http.response.ok-check",
                        confidence=0.95,
                        evidence=[
                            f"{fetch_count} fetch call(s) vs {response_ok_count} response.ok check(s) in changed scope",
                        ],
                        tags=["http", "fetch"],
                    )
                )

            if any_count > 0 and fact.file_role != "test":
                findings.append(
                    self._finding(
                        fact=fact,
                        line=self._observation_line(observations, "explicit_any_lines", changed_line),
                        category="code_quality",
                        skill="type_safety",
                        title="Weak typing reduces deterministic guarantees",
                        message="The changed code uses `any`, which weakens type guarantees and usually hides validation or shape assumptions.",
                        severity="medium",
                        rule_id="typescript.any",
                        confidence=0.86,
                        evidence=[f"{any_count} explicit any usage(s) detected in changed scope"],
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
            bare_except_lines = observations.get("changed_bare_except_lines", []) or []
            broad_except_lines = observations.get("changed_broad_except_lines", []) or []
            secret_lines = observations.get("changed_hardcoded_secret_lines", []) or []
            if bare_except_lines:
                findings.append(
                    self._finding(
                        fact=fact,
                        line=bare_except_lines[0],
                        category="error_handling",
                        skill="python_error_handling",
                        title="Bare except hides the real failure type",
                        message="The semantic parser found a bare `except` block directly in changed Python code.",
                        severity="critical",
                        rule_id="python.except.bare",
                        confidence=0.98,
                        evidence=[f"Bare except in changed scope at line {bare_except_lines[0]}"],
                        tags=["python", "exceptions"],
                    )
                )
            if broad_except_lines and not fact.signals.get("has_raise"):
                findings.append(
                    self._finding(
                        fact=fact,
                        line=broad_except_lines[0],
                        category="error_handling",
                        skill="python_error_handling",
                        title="Broad exception handling without re-raise",
                        message="The changed Python path catches `Exception` broadly and does not appear to re-raise in the changed scope.",
                        severity="high",
                        rule_id="python.except.exception-swallow",
                        confidence=0.9,
                        evidence=[
                            f"Broad except in changed scope at line {broad_except_lines[0]} without matching changed-scope raise",
                        ],
                        tags=["python", "exceptions"],
                    )
                )
            if secret_lines:
                findings.append(
                    self._finding(
                        fact=fact,
                        line=secret_lines[0],
                        category="security",
                        skill="security_secrets_auth",
                        title="Hardcoded secret-like value in source code",
                        message="The changed Python code appears to embed a secret, token, or password literal directly in source.",
                        severity="critical",
                        rule_id="python.security.hardcoded-secret",
                        confidence=0.96,
                        evidence=[
                            f"Secret-like assignment detected in changed scope at line {secret_lines[0]}",
                        ],
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

        production_boundary = fact.file_role in {"controller", "service", "repository", "hook", "module"}
        changed_scope_size = int(observations.get("changed_scope_line_count", 0) or len(fact.changed_lines))
        if (
            fact.changed
            and production_boundary
            and changed_scope_size >= 3
            and not fact.signals.get("has_tests")
            and fact.file_role != "test"
        ):
            findings.append(
                self._finding(
                    fact=fact,
                    line=changed_line,
                    category="testing",
                    skill="testing_reliability",
                    title="Changed production code has no nearby testing signal",
                    message="Changed production logic has no nearby test-oriented signal, which lowers confidence in safe iteration.",
                    severity="medium",
                    rule_id="testing.missing-signal",
                    confidence=0.66,
                    evidence=[f"{changed_scope_size} changed-scope line(s) with no test markers detected"],
                    tags=["testing"],
                )
            )

        if (
            fact.changed
            and fact.file_role in {"controller", "service", "repository"}
            and not fact.signals.get("has_docs", False)
            and not fact.signals.get("has_docstrings", False)
            and len([symbol for symbol in fact.symbols if symbol.changed]) > 0
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

    def _observation_line(
        self,
        observations: dict[str, object],
        key: str,
        fallback: int | None,
    ) -> int | None:
        raw_value = observations.get(key, [])
        if isinstance(raw_value, list) and raw_value:
            first = raw_value[0]
            if isinstance(first, int):
                return first
        return fallback

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
