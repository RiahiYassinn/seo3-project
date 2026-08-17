import pytest

from app.services.analysis_types import (
    RuleFinding,
    SemanticFact,
    SemanticReport,
    StaticFinding,
    SymbolFact,
)
from app.services.report_builder import ReportBuilder


builder = ReportBuilder()


def finding(**overrides) -> RuleFinding:
    defaults = dict(
        file_path="src/thing.ts",
        line=10,
        category="error_handling",
        skill="async_error_handling",
        title="Missing error handling",
        message="No try/catch",
        severity="high",
        rule_id="react.effect.api.error-handling",
        confidence=1.0,
    )
    defaults.update(overrides)
    return RuleFinding(**defaults)


def fact(**overrides) -> SemanticFact:
    defaults = dict(
        file_path="src/thing.ts",
        language="typescript",
        file_role="component",
        frameworks=[],
        intents=[],
        changed_lines=[10],
        changed=True,
        signals={},
        observations={},
        symbols=[],
    )
    defaults.update(overrides)
    return SemanticFact(**defaults)


def report(*facts, dominant_language="typescript", commit_topics=None) -> SemanticReport:
    return SemanticReport(
        facts=list(facts),
        files_by_path={},
        dominant_language=dominant_language,
        commit_topics=commit_topics or [],
    )


def build(findings=None, facts=(), static_findings=None, existing_profile=None):
    return builder.build(
        list(static_findings or []),
        report(*facts),
        list(findings or []),
        existing_profile,
    )


class TestEnvelope:
    def test_carries_the_report_version_and_commit_context(self):
        result = builder.build(
            [],
            report(dominant_language="python", commit_topics=["auth", "api"]),
            [],
        )

        assert result["version"] == "2.0.0"
        assert result["dominant_language"] == "python"
        assert result["commit_topics"] == ["auth", "api"]

    def test_counts_findings_by_severity(self):
        result = build(
            [
                finding(severity="critical", rule_id="a"),
                finding(severity="high", rule_id="b"),
                finding(severity="high", rule_id="c"),
                finding(severity="medium", rule_id="d"),
                finding(severity="low", rule_id="e"),
            ]
        )

        assert result["summary"] == {
            "finding_count": 5,
            "critical_count": 1,
            "high_count": 2,
            "medium_count": 1,
            "low_count": 1,
        }

    def test_reports_analysis_metadata(self):
        result = build(
            [finding()],
            facts=[fact(changed=True), fact(file_path="src/other.ts", changed=False)],
            static_findings=[
                StaticFinding(
                    file_path="src/thing.ts",
                    line=1,
                    category="code_quality",
                    skill="type_safety",
                    severity="low",
                    rule_id="eslint:x",
                    source="eslint",
                    message="x",
                )
            ],
        )

        metadata = result["analysis_metadata"]
        assert metadata["semantic_fact_count"] == 2
        assert metadata["changed_file_count"] == 1
        assert metadata["static_finding_count"] == 1
        assert metadata["rule_finding_count"] == 1


class TestQualityScore:
    def test_a_clean_commit_scores_a_perfect_ten(self):
        assert build([])["quality_score"] == 10.0

    def test_a_critical_finding_costs_more_than_a_low_one(self):
        critical = build([finding(severity="critical")])["quality_score"]
        low = build([finding(severity="low")])["quality_score"]

        assert critical < low

    def test_confidence_scales_the_penalty(self):
        certain = build([finding(confidence=1.0)])["quality_score"]
        unsure = build([finding(confidence=0.2)])["quality_score"]

        assert unsure > certain

    def test_the_score_never_bottoms_out_at_zero(self):
        many = [
            finding(severity="critical", rule_id=f"rule-{index}", line=index)
            for index in range(200)
        ]

        assert build(many)["quality_score"] >= 0.5

    def test_stacked_findings_degrade_gradually_rather_than_collapsing(self):
        few = build(
            [finding(severity="critical", rule_id=f"r{i}", line=i) for i in range(3)]
        )["quality_score"]
        more = build(
            [finding(severity="critical", rule_id=f"r{i}", line=i) for i in range(10)]
        )["quality_score"]

        assert 0.5 < more < few < 10.0


class TestWeaknessScores:
    def test_accumulates_weighted_confidence_per_skill(self):
        result = build(
            [
                finding(skill="async_error_handling", severity="high", confidence=1.0),
                finding(
                    skill="async_error_handling",
                    severity="medium",
                    confidence=1.0,
                    rule_id="other",
                ),
            ]
        )

        # 0.75 (high) + 0.45 (medium)
        assert result["weakness_scores"]["async_error_handling"] == 1.2

    def test_scores_are_sorted_highest_first(self):
        result = build(
            [
                finding(skill="low_risk", severity="low", rule_id="a"),
                finding(skill="high_risk", severity="critical", rule_id="b"),
            ]
        )

        assert list(result["weakness_scores"]) == ["high_risk", "low_risk"]

    def test_scores_are_capped_at_ten(self):
        result = build(
            [
                finding(severity="critical", rule_id=f"r{index}", line=index)
                for index in range(50)
            ]
        )

        assert result["weakness_scores"]["async_error_handling"] == 10.0

    def test_a_previous_profile_is_blended_in(self):
        fresh = build([finding(severity="high", confidence=1.0)])
        blended = build(
            [finding(severity="high", confidence=1.0)],
            existing_profile={"weakness_scores": {"async_error_handling": 10.0}},
        )

        assert (
            blended["weakness_scores"]["async_error_handling"]
            > fresh["weakness_scores"]["async_error_handling"]
        )

    def test_a_previous_profile_missing_the_skill_only_dampens_it(self):
        fresh = build([finding(severity="high", confidence=1.0)])
        blended = build(
            [finding(severity="high", confidence=1.0)],
            existing_profile={"weakness_scores": {}},
        )

        assert blended["weakness_scores"]["async_error_handling"] == pytest.approx(
            fresh["weakness_scores"]["async_error_handling"] * 0.65, abs=0.01
        )


class TestSkillSummary:
    def test_groups_findings_by_skill(self):
        result = build(
            [
                finding(skill="type_safety", rule_id="a"),
                finding(skill="type_safety", rule_id="b"),
                finding(skill="testing_reliability", rule_id="c"),
            ]
        )

        by_skill = {item["skill"]: item for item in result["skills"]}
        assert by_skill["type_safety"]["issue_count"] == 2
        assert by_skill["testing_reliability"]["issue_count"] == 1

    def test_reports_the_worst_severity_in_the_group(self):
        result = build(
            [
                finding(skill="type_safety", severity="low", rule_id="a"),
                finding(skill="type_safety", severity="critical", rule_id="b"),
            ]
        )

        assert result["skills"][0]["highest_severity"] == "critical"

    def test_averages_confidence_across_the_group(self):
        result = build(
            [
                finding(skill="type_safety", confidence=1.0, rule_id="a"),
                finding(skill="type_safety", confidence=0.5, rule_id="b"),
            ]
        )

        assert result["skills"][0]["average_confidence"] == 0.75

    def test_shows_at_most_three_example_titles(self):
        result = build(
            [
                finding(skill="type_safety", title=f"Issue {index}", rule_id=f"r{index}")
                for index in range(5)
            ]
        )

        assert len(result["skills"][0]["example_titles"]) == 3

    def test_the_busiest_skill_is_listed_first(self):
        result = build(
            [
                finding(skill="quiet", rule_id="a"),
                finding(skill="busy", rule_id="b"),
                finding(skill="busy", rule_id="c"),
            ]
        )

        assert result["skills"][0]["skill"] == "busy"


class TestLearningResources:
    def test_attaches_resources_for_a_known_skill(self):
        result = build([finding(skill="type_safety")])

        assert result["learning_resources"] == [
            {
                "skill": "type_safety",
                "title": "TypeScript Handbook",
                "type": "official_docs",
                "url": "https://www.typescriptlang.org/docs/",
            }
        ]

    def test_the_same_resource_is_not_repeated(self):
        result = build(
            [
                finding(skill="type_safety", rule_id="a"),
                finding(skill="type_safety", rule_id="b"),
            ]
        )

        assert len(result["learning_resources"]) == 1

    def test_an_unmapped_skill_contributes_nothing(self):
        assert build([finding(skill="not_in_the_map")])["learning_resources"] == []


class TestStrengths:
    def test_positive_signals_become_readable_strengths(self):
        result = build(facts=[fact(signals={"checks_response_ok": True})])

        assert result["strengths"] == [
            "Validates HTTP responses before consuming payloads"
        ]

    def test_a_typed_symbol_observation_counts_even_without_the_signal(self):
        result = build(facts=[fact(observations={"typed_symbol_count": 4})])

        assert "Keeps changed function boundaries explicitly typed" in result["strengths"]

    def test_the_same_strength_is_not_listed_twice(self):
        result = build(
            facts=[
                fact(signals={"has_error_handling": True}),
                fact(file_path="src/other.ts", signals={"has_error_handling": True}),
            ]
        )

        assert result["strengths"] == [
            "Uses explicit error handling in changed code paths"
        ]

    def test_at_most_six_strengths_are_reported(self):
        result = build(
            facts=[
                fact(
                    signals={
                        "checks_response_ok": True,
                        "has_error_handling": True,
                        "has_cleanup": True,
                        "typed_changed_symbols": True,
                        "has_docstrings": True,
                        "has_tests": True,
                        "has_raise": True,
                    }
                )
            ]
        )

        assert len(result["strengths"]) == 6

    def test_no_signals_means_no_strengths(self):
        assert build(facts=[fact()])["strengths"] == []


class TestSkillProfileInputs:
    def test_collects_languages_frameworks_and_roles(self):
        result = build(
            facts=[
                fact(language="typescript", frameworks=["react"], file_role="component"),
                fact(
                    file_path="app/x.py",
                    language="python",
                    frameworks=["fastapi"],
                    file_role="service",
                ),
            ]
        )

        inputs = result["analysis_metadata"]["skill_profile_inputs"]
        assert inputs["languages"] == ["python", "typescript"]
        assert inputs["frameworks"] == ["fastapi", "react"]
        assert inputs["roles_touched"] == ["component", "service"]

    def test_lists_only_the_changed_symbols(self):
        result = build(
            facts=[
                fact(
                    symbols=[
                        SymbolFact(name="edited", kind="fn", line=1, end_line=2, changed=True),
                        SymbolFact(name="untouched", kind="fn", line=3, end_line=4),
                    ]
                )
            ]
        )

        assert result["analysis_metadata"]["skill_profile_inputs"][
            "changed_symbols"
        ] == ["edited"]

    def test_counts_positive_signals_using_their_observation(self):
        result = build(
            facts=[
                fact(
                    signals={"checks_response_ok": True},
                    observations={"response_ok_count_in_changed_scope": 4},
                )
            ]
        )

        counts = result["analysis_metadata"]["skill_profile_inputs"][
            "positive_signal_counts"
        ]
        assert counts["http_response_validation"] == 4

    def test_a_signal_with_no_count_still_counts_once(self):
        result = build(facts=[fact(signals={"has_cleanup": True})])

        counts = result["analysis_metadata"]["skill_profile_inputs"][
            "positive_signal_counts"
        ]
        assert counts["react_cleanup"] == 1

    def test_negative_counts_mirror_the_findings_per_skill(self):
        result = build(
            [
                finding(skill="type_safety", rule_id="a"),
                finding(skill="type_safety", rule_id="b"),
                finding(skill="testing_reliability", rule_id="c"),
            ]
        )

        assert result["analysis_metadata"]["skill_profile_inputs"][
            "negative_finding_counts"
        ] == {"testing_reliability": 1, "type_safety": 2}


class TestFindingSerialization:
    def test_every_field_the_client_needs_is_present(self):
        result = build([finding(tags=["react"], related_symbols=["useThing"])])

        assert result["findings"][0] == {
            "file_path": "src/thing.ts",
            "line": 10,
            "category": "error_handling",
            "skill": "async_error_handling",
            "title": "Missing error handling",
            "message": "No try/catch",
            "severity": "high",
            "confidence": 1.0,
            "rule_id": "react.effect.api.error-handling",
            "source": "rule-engine",
            "evidence": [],
            "related_symbols": ["useThing"],
            "tags": ["react"],
        }

    def test_confidence_is_rounded_for_display(self):
        result = build([finding(confidence=0.876543)])

        assert result["findings"][0]["confidence"] == 0.88
