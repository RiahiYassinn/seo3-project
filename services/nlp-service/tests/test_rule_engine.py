import pytest

from app.services.analysis_types import (
    SemanticFact,
    SemanticReport,
    StaticFinding,
    SymbolFact,
)
from app.services.rule_engine import RuleEngine


engine = RuleEngine()


def fact(**overrides) -> SemanticFact:
    """A neutral fact that trips no rule on its own."""
    defaults = dict(
        file_path="src/thing.ts",
        language="typescript",
        file_role="component",
        frameworks=[],
        intents=[],
        changed_lines=[10],
        changed=True,
        signals={"has_tests": True, "has_docs": True, "has_docstrings": True},
        observations={},
        symbols=[],
    )
    defaults.update(overrides)
    return SemanticFact(**defaults)


def evaluate(*facts, static_findings=None, commit_message="chore: change"):
    report = SemanticReport(
        facts=list(facts),
        files_by_path={},
        dominant_language="typescript",
        commit_topics=[],
    )
    return engine.evaluate(report, static_findings or [], {}, commit_message)


def rule_ids(findings):
    return {finding.rule_id for finding in findings}


class TestReactEffectRules:
    def react_fact(self, **observations):
        base = {
            "react_effect_fetch_pairs_in_changed_scope": 1,
            "fetch_call_count_in_changed_scope": 1,
            "response_ok_count_in_changed_scope": 1,
            "error_handler_count_in_changed_scope": 1,
            "loading_state_count_in_changed_scope": 1,
        }
        base.update(observations)
        return fact(
            signals={
                "has_cleanup": True,
                "has_tests": True,
                "has_docs": True,
            },
            observations=base,
        )

    def test_a_well_formed_effect_trips_nothing(self):
        assert evaluate(self.react_fact()) == []

    def test_missing_cleanup_is_reported(self):
        no_cleanup = self.react_fact()
        no_cleanup.signals = {"has_tests": True, "has_docs": True}

        findings = evaluate(no_cleanup)

        assert "react.effect.cleanup" in rule_ids(findings)

    def test_missing_error_handling_is_high_severity(self):
        findings = evaluate(self.react_fact(error_handler_count_in_changed_scope=0))

        [finding] = [
            item for item in findings if item.rule_id == "react.effect.api.error-handling"
        ]
        assert finding.severity == "high"
        assert finding.skill == "async_error_handling"

    def test_missing_loading_state_is_reported(self):
        findings = evaluate(self.react_fact(loading_state_count_in_changed_scope=0))

        assert "frontend.async.loading-state" in rule_ids(findings)

    def test_effect_rules_are_skipped_when_no_effect_fetch_pair_exists(self):
        findings = evaluate(
            self.react_fact(
                react_effect_fetch_pairs_in_changed_scope=0,
                error_handler_count_in_changed_scope=0,
                loading_state_count_in_changed_scope=0,
            )
        )

        assert "react.effect.cleanup" not in rule_ids(findings)
        assert "frontend.async.loading-state" not in rule_ids(findings)

    def test_the_reported_line_comes_from_the_observation_when_available(self):
        findings = evaluate(
            self.react_fact(
                error_handler_count_in_changed_scope=0,
                fetch_call_lines=[42],
            )
        )

        [finding] = [
            item for item in findings if item.rule_id == "react.effect.api.error-handling"
        ]
        assert finding.line == 42

    def test_the_reported_line_falls_back_to_the_first_changed_line(self):
        findings = evaluate(self.react_fact(error_handler_count_in_changed_scope=0))

        [finding] = [
            item for item in findings if item.rule_id == "react.effect.api.error-handling"
        ]
        assert finding.line == 10


class TestHttpResponseRule:
    def test_unchecked_response_is_reported(self):
        findings = evaluate(
            fact(
                signals={"has_tests": True, "has_docs": True},
                observations={
                    "fetch_call_count_in_changed_scope": 2,
                    "response_ok_count_in_changed_scope": 1,
                },
            )
        )

        [finding] = [item for item in findings if item.rule_id == "http.response.ok-check"]
        assert finding.severity == "high"
        assert "2 fetch call(s) vs 1 response.ok check(s)" in finding.evidence[0]

    def test_a_matched_check_count_trips_nothing(self):
        findings = evaluate(
            fact(
                signals={"has_tests": True, "has_docs": True},
                observations={
                    "fetch_call_count_in_changed_scope": 2,
                    "response_ok_count_in_changed_scope": 2,
                },
            )
        )

        assert "http.response.ok-check" not in rule_ids(findings)


class TestExplicitAnyRule:
    def test_any_usage_is_reported(self):
        findings = evaluate(
            fact(
                signals={"has_tests": True, "has_docs": True},
                observations={"explicit_any_count_in_changed_scope": 3},
            )
        )

        [finding] = [item for item in findings if item.rule_id == "typescript.any"]
        assert finding.skill == "type_safety"
        assert "3 explicit any usage(s)" in finding.evidence[0]

    def test_any_is_tolerated_in_test_files(self):
        findings = evaluate(
            fact(
                file_role="test",
                signals={"has_tests": True, "has_docs": True},
                observations={"explicit_any_count_in_changed_scope": 3},
            )
        )

        assert "typescript.any" not in rule_ids(findings)

    def test_javascript_is_evaluated_alongside_typescript(self):
        findings = evaluate(
            fact(
                language="javascript",
                signals={"has_tests": True, "has_docs": True},
                observations={
                    "fetch_call_count_in_changed_scope": 1,
                    "response_ok_count_in_changed_scope": 0,
                },
            )
        )

        assert "http.response.ok-check" in rule_ids(findings)


class TestNestLayeringRule:
    def test_query_coupling_in_a_nest_service_is_reported(self):
        findings = evaluate(
            fact(
                file_role="service",
                intents=["database_query"],
                frameworks=["nestjs"],
                signals={"has_tests": True, "has_docs": True, "has_docstrings": True},
                symbols=[SymbolFact(name="findAll", kind="method", line=1, end_line=5)],
            )
        )

        assert "nestjs.layering.query-coupling" in rule_ids(findings)

    def test_a_non_nest_service_is_left_alone(self):
        findings = evaluate(
            fact(
                file_role="service",
                intents=["database_query"],
                frameworks=["express"],
                signals={"has_tests": True, "has_docs": True, "has_docstrings": True},
            )
        )

        assert "nestjs.layering.query-coupling" not in rule_ids(findings)


class TestPythonRules:
    def python_fact(self, **overrides):
        defaults = dict(
            file_path="app/service.py",
            language="python",
            file_role="component",
            signals={"has_tests": True, "has_docs": True, "has_docstrings": True},
        )
        defaults.update(overrides)
        return fact(**defaults)

    def test_bare_except_is_critical(self):
        findings = evaluate(
            self.python_fact(observations={"changed_bare_except_lines": [17]})
        )

        [finding] = [item for item in findings if item.rule_id == "python.except.bare"]
        assert finding.severity == "critical"
        assert finding.line == 17

    def test_broad_except_without_a_raise_is_reported(self):
        findings = evaluate(
            self.python_fact(observations={"changed_broad_except_lines": [20]})
        )

        assert "python.except.exception-swallow" in rule_ids(findings)

    def test_broad_except_is_forgiven_when_the_scope_re_raises(self):
        findings = evaluate(
            self.python_fact(
                observations={"changed_broad_except_lines": [20]},
                signals={
                    "has_raise": True,
                    "has_tests": True,
                    "has_docs": True,
                    "has_docstrings": True,
                },
            )
        )

        assert "python.except.exception-swallow" not in rule_ids(findings)

    def test_hardcoded_secret_is_critical_and_tagged_security(self):
        findings = evaluate(
            self.python_fact(observations={"changed_hardcoded_secret_lines": [4]})
        )

        [finding] = [
            item for item in findings if item.rule_id == "python.security.hardcoded-secret"
        ]
        assert finding.severity == "critical"
        assert finding.category == "security"

    def test_auth_mixed_with_data_access_is_reported(self):
        findings = evaluate(
            self.python_fact(intents=["database_query", "authentication"])
        )

        assert "python.auth.query-coupling" in rule_ids(findings)

    def test_auth_alone_is_not_reported(self):
        findings = evaluate(self.python_fact(intents=["authentication"]))

        assert "python.auth.query-coupling" not in rule_ids(findings)

    def test_an_undocumented_service_module_is_flagged(self):
        findings = evaluate(
            self.python_fact(
                file_role="module",
                signals={"has_tests": True, "has_docs": True},
            )
        )

        [finding] = [item for item in findings if item.rule_id == "python.docs.missing"]
        assert finding.severity == "low"

    def test_python_rules_do_not_fire_on_typescript(self):
        findings = evaluate(
            fact(
                signals={"has_tests": True, "has_docs": True},
                observations={"changed_bare_except_lines": [17]},
            )
        )

        assert "python.except.bare" not in rule_ids(findings)


class TestCrossLanguageRules:
    @pytest.mark.parametrize(
        "file_role", ["controller", "service", "repository", "hook", "module"]
    )
    def test_untested_production_boundaries_are_flagged(self, file_role):
        findings = evaluate(
            fact(
                file_role=file_role,
                changed_lines=[1, 2, 3],
                signals={"has_docs": True, "has_docstrings": True},
            )
        )

        assert "testing.missing-signal" in rule_ids(findings)

    def test_a_trivial_change_is_not_flagged_for_missing_tests(self):
        findings = evaluate(
            fact(
                file_role="service",
                changed_lines=[1, 2],
                signals={"has_docs": True, "has_docstrings": True},
            )
        )

        assert "testing.missing-signal" not in rule_ids(findings)

    def test_the_scope_size_observation_overrides_the_changed_line_count(self):
        findings = evaluate(
            fact(
                file_role="service",
                changed_lines=[1],
                observations={"changed_scope_line_count": 40},
                signals={"has_docs": True, "has_docstrings": True},
            )
        )

        assert "testing.missing-signal" in rule_ids(findings)

    def test_an_unchanged_file_is_not_flagged(self):
        findings = evaluate(
            fact(
                file_role="service",
                changed=False,
                changed_lines=[1, 2, 3],
                signals={"has_docs": True, "has_docstrings": True},
            )
        )

        assert "testing.missing-signal" not in rule_ids(findings)

    def test_an_undocumented_changed_boundary_is_flagged(self):
        findings = evaluate(
            fact(
                file_role="controller",
                signals={"has_tests": True},
                symbols=[
                    SymbolFact(name="create", kind="method", line=3, end_line=9, changed=True)
                ],
            )
        )

        assert "docs.boundary.missing" in rule_ids(findings)

    def test_the_docs_rule_needs_at_least_one_changed_symbol(self):
        findings = evaluate(
            fact(
                file_role="controller",
                signals={"has_tests": True},
                symbols=[
                    SymbolFact(name="create", kind="method", line=3, end_line=9, changed=False)
                ],
            )
        )

        assert "docs.boundary.missing" not in rule_ids(findings)

    def test_related_symbols_list_only_the_changed_ones(self):
        findings = evaluate(
            fact(
                file_role="controller",
                signals={"has_tests": True},
                symbols=[
                    SymbolFact(name="changed", kind="method", line=1, end_line=2, changed=True),
                    SymbolFact(name="untouched", kind="method", line=3, end_line=4),
                ],
            )
        )

        [finding] = [item for item in findings if item.rule_id == "docs.boundary.missing"]
        assert finding.related_symbols == ["changed"]


class TestStaticFindingPromotion:
    def static(self, **overrides):
        defaults = dict(
            file_path="src/thing.ts",
            line=12,
            category="code_quality",
            skill="type_safety",
            severity="medium",
            rule_id="eslint:no-unused-vars",
            source="eslint",
            message="'x' is assigned but never used",
            confidence=0.8,
        )
        defaults.update(overrides)
        return StaticFinding(**defaults)

    def test_a_linter_finding_is_promoted_onto_the_report(self):
        findings = evaluate(fact(), static_findings=[self.static()])

        [finding] = [item for item in findings if item.source == "eslint"]
        assert finding.title == "'x' is assigned but never used"
        assert finding.rule_id == "eslint:no-unused-vars"

    def test_changed_code_raises_the_confidence(self):
        [changed] = evaluate(fact(changed=True), static_findings=[self.static()])
        [unchanged] = evaluate(fact(changed=False), static_findings=[self.static()])

        assert changed.confidence > unchanged.confidence

    def test_a_finding_matching_the_file_intent_is_boosted_further(self):
        [plain] = evaluate(fact(changed=False), static_findings=[self.static()])
        [matched] = evaluate(
            fact(changed=False, intents=["type_safety"]),
            static_findings=[self.static()],
        )

        assert matched.confidence > plain.confidence

    def test_confidence_is_capped_at_0_99(self):
        [finding] = evaluate(
            fact(intents=["type_safety"]),
            static_findings=[self.static(confidence=0.99)],
        )

        assert finding.confidence == 0.99

    def test_findings_for_another_file_are_not_attached(self):
        findings = evaluate(
            fact(file_path="src/thing.ts"),
            static_findings=[self.static(file_path="src/other.ts")],
        )

        assert findings == []

    def test_a_missing_evidence_string_is_synthesised(self):
        [finding] = evaluate(fact(), static_findings=[self.static(evidence=None)])

        assert finding.evidence == ["eslint reported eslint:no-unused-vars"]


class TestDeduplicationAndOrdering:
    def test_identical_findings_from_two_facts_collapse_to_one(self):
        duplicate = StaticFinding(
            file_path="src/thing.ts",
            line=12,
            category="code_quality",
            skill="type_safety",
            severity="medium",
            rule_id="eslint:no-unused-vars",
            source="eslint",
            message="duplicate",
        )

        findings = evaluate(
            fact(file_path="src/thing.ts"),
            fact(file_path="src/thing.ts"),
            static_findings=[duplicate],
        )

        assert len(findings) == 1

    def test_the_higher_confidence_duplicate_wins(self):
        shared = dict(
            file_path="src/thing.ts",
            line=12,
            category="code_quality",
            skill="type_safety",
            severity="medium",
            rule_id="eslint:no-unused-vars",
            source="eslint",
            message="duplicate",
        )

        findings = evaluate(
            fact(file_path="src/thing.ts", changed=True),
            fact(file_path="src/thing.ts", changed=False),
            static_findings=[StaticFinding(confidence=0.5, **shared)],
        )

        assert findings[0].confidence == pytest.approx(0.58)

    def test_results_are_ordered_by_severity_then_confidence(self):
        findings = evaluate(
            fact(
                file_path="app/service.py",
                language="python",
                observations={
                    "changed_bare_except_lines": [1],
                    "changed_broad_except_lines": [2],
                },
            ),
        )

        assert [item.severity for item in findings] == ["critical", "high"]

    def test_an_empty_report_yields_no_findings(self):
        assert evaluate() == []
