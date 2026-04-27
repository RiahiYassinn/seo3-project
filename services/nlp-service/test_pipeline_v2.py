import asyncio
from typing import Any

from app.services.code_analyzer import CodeAnalyzer


def build_diff(file_name: str, content: str) -> str:
    lines = content.strip("\n").splitlines()
    diff_lines = [
        f"diff --git a/{file_name} b/{file_name}",
        f"--- a/{file_name}",
        f"+++ b/{file_name}",
        "@@",
    ]
    diff_lines.extend(f"+{line}" for line in lines)
    return "\n".join(diff_lines)


async def run_analysis(
    analyzer: CodeAnalyzer,
    file_name: str,
    content: str,
    commit_message: str,
) -> dict[str, Any]:
    return await analyzer.analyze(
        files_with_content={file_name: content},
        diff_content=build_diff(file_name, content),
        commit_message=commit_message,
        developer_id="pipeline-v2-test",
        existing_profile=None,
    )


def assert_base_shape(result: dict[str, Any]) -> None:
    required_keys = {
        "version",
        "dominant_language",
        "commit_topics",
        "quality_score",
        "strengths",
        "summary",
        "weakness_scores",
        "skills",
        "findings",
        "learning_resources",
        "analysis_metadata",
    }
    missing = required_keys - set(result.keys())
    assert not missing, f"Missing response keys: {sorted(missing)}"
    assert isinstance(result["findings"], list), "`findings` must be a list"
    assert isinstance(result["strengths"], list), "`strengths` must be a list"
    assert "top_weaknesses" not in result, "Legacy field `top_weaknesses` should not exist"


def finding_exists(result: dict[str, Any], rule_id: str) -> bool:
    for finding in result.get("findings", []):
        if finding.get("rule_id") == rule_id:
            return True
    return False


def print_case_summary(case: str, result: dict[str, Any]) -> None:
    summary = result.get("summary", {})
    print(
        f"[{case}] quality={result.get('quality_score')} findings={summary.get('finding_count')} "
        f"critical={summary.get('critical_count')} high={summary.get('high_count')} "
        f"medium={summary.get('medium_count')} low={summary.get('low_count')}"
    )


async def main() -> None:
    analyzer = CodeAnalyzer()

    python_case = await run_analysis(
        analyzer,
        "auth_service.py",
        """
import os

def authenticate(username, password):
    token = "secret-value-123"
    try:
        return os.getenv("TOKEN", token)
    except:
        return None
""",
        "Add auth helper with fallback token",
    )
    assert_base_shape(python_case)
    assert python_case["dominant_language"] == "python", "Expected dominant language python"
    assert len(python_case["findings"]) > 0, "Expected findings for insecure Python sample"
    assert python_case["quality_score"] > 0, "Weak Python sample should still retain a non-zero quality score"
    assert finding_exists(python_case, "python.except.bare") or finding_exists(
        python_case, "heuristic:bare-except"
    ), "Expected bare-except finding"
    print_case_summary("python_case", python_case)

    ts_case = await run_analysis(
        analyzer,
        "api.service.ts",
        """
export class ApiService {
  data: any;
  async fetchUsers() {
    const response = await fetch('http://api.example.com/users')
    const data = await response.json()
    console.log(data)
    return data
  }
}
""",
        "Add API fetch service",
    )
    assert_base_shape(ts_case)
    assert ts_case["dominant_language"] == "typescript", "Expected dominant language typescript"
    assert len(ts_case["findings"]) > 0, "Expected findings for weakly-typed TS sample"
    assert ts_case["quality_score"] > 0, "Weak TypeScript sample should still retain a non-zero quality score"
    assert finding_exists(ts_case, "http.response.ok-check"), "Expected missing response.ok finding"
    assert finding_exists(ts_case, "typescript.any") or finding_exists(
        ts_case, "heuristic:any"
    ), "Expected any-type finding"
    print_case_summary("ts_case", ts_case)

    cleaner_case = await run_analysis(
        analyzer,
        "user_repository.py",
        """
from dataclasses import dataclass

@dataclass
class User:
    id: str
    name: str

def find_user(client, user_id: str):
    if not user_id:
        raise ValueError("missing user_id")
    return client.get(user_id)
""",
        "Add typed user repository helper",
    )
    assert_base_shape(cleaner_case)
    assert cleaner_case["dominant_language"] == "python", "Expected dominant language python"
    assert cleaner_case["summary"]["finding_count"] <= ts_case["summary"]["finding_count"], (
        "Cleaner Python sample should not produce more findings than weak TS sample"
    )
    assert cleaner_case["quality_score"] > python_case["quality_score"], (
        "Cleaner Python sample should outscore weaker Python sample"
    )
    assert len(cleaner_case["strengths"]) > 0, "Cleaner sample should surface at least one strength"
    print_case_summary("cleaner_case", cleaner_case)

    print("\nAll pipeline-v2 checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
