from collections import defaultdict

from app.services.static_analyzer import StaticIssue, WEAKNESS_CATEGORIES


class WeaknessAggregator:
    def aggregate(
        self,
        static_issues: list[StaticIssue],
        llm_review: dict,
        existing_profile: dict | None = None,
    ) -> dict:
        """
        Returns a structured weakness profile.
        """
        current_scores = {category: 0.0 for category in WEAKNESS_CATEGORIES}
        evidence_map: dict[str, list[str]] = defaultdict(list)
        recommendation_map: dict[str, dict[str, str]] = {}

        static_weights = {"high": 0.3, "medium": 0.15, "low": 0.05}
        for issue in static_issues:
            category = issue.category if issue.category in current_scores else "language_idioms"
            current_scores[category] = min(
                1.0,
                current_scores[category] + static_weights.get(issue.severity, 0.05),
            )
            location = f"{issue.file}:{issue.line}" if issue.line else issue.file
            evidence_map[category].append(
                f"{location} [{issue.tool}:{issue.rule}] {issue.message}"
            )

        llm_weights = {"high": 0.4, "medium": 0.2, "low": 0.1}
        for weakness in llm_review.get("weaknesses", []):
            category = weakness.get("category", "language_idioms")
            if category not in current_scores:
                continue
            severity = weakness.get("severity", "low")
            current_scores[category] = min(
                1.0,
                current_scores[category] + llm_weights.get(severity, 0.1),
            )
            if weakness.get("evidence"):
                evidence_map[category].append(str(weakness["evidence"]))
            recommendation_map[category] = {
                "weakness": category,
                "action": weakness.get(
                    "recommendation",
                    f"Improve {category.replace('_', ' ')} practices in future changes.",
                ),
                "learning_query": weakness.get(
                    "learning_query",
                    f"{category.replace('_', ' ')} best practices",
                ),
            }

        if existing_profile:
            old_scores = existing_profile.get("weakness_scores", {})
            for category in current_scores:
                old_score = float(old_scores.get(category, 0.0))
                current_scores[category] = round(
                    (old_score * 0.7) + (current_scores[category] * 0.3),
                    4,
                )
        else:
            for category in current_scores:
                current_scores[category] = round(current_scores[category], 4)

        sorted_categories = sorted(
            current_scores.items(),
            key=lambda item: (-item[1], item[0]),
        )
        top_weaknesses = []
        recommendations = []
        for category, score in sorted_categories[:3]:
            if score <= 0:
                continue
            priority = "high" if score >= 0.6 else "medium" if score >= 0.25 else "low"
            top_weaknesses.append(
                {
                    "category": category,
                    "score": round(score, 2),
                    "evidence": evidence_map.get(category, [])[:3],
                    "priority": priority,
                }
            )
            recommendations.append(
                recommendation_map.get(
                    category,
                    {
                        "weakness": category,
                        "action": f"Focus on improving {category.replace('_', ' ')} in future diffs.",
                        "learning_query": f"{category.replace('_', ' ')} best practices",
                    },
                )
            )

        quality_score = llm_review.get("overall_quality_score")
        if quality_score is None:
            quality_score = round(max(0.0, 10.0 - (sum(current_scores.values()) * 2.5)), 2)

        strengths = [str(item) for item in llm_review.get("strengths", []) if str(item).strip()]
        if not strengths and not top_weaknesses:
            strengths = ["The submitted code did not trigger any material weaknesses."]

        skill_level = llm_review.get("skill_level_signals", {}).get("apparent_experience", "unknown")
        if skill_level == "unknown":
            if quality_score >= 8:
                skill_level = "senior"
            elif quality_score >= 5:
                skill_level = "mid"
            else:
                skill_level = "junior"

        return {
            "weakness_scores": {key: round(value, 2) for key, value in current_scores.items()},
            "top_weaknesses": top_weaknesses,
            "strengths": strengths,
            "quality_score": round(float(quality_score), 2) if quality_score is not None else None,
            "skill_level": skill_level,
            "recommendations": recommendations,
        }
