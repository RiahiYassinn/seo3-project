from __future__ import annotations

import asyncio
import ast
import json
import logging
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

from app.services.analysis_types import DiffFileSummary, StaticFinding


logger = logging.getLogger(__name__)


class StaticAnalyzer:
    async def analyze(
        self,
        files_with_content: dict[str, str],
        diff_summary: dict[str, DiffFileSummary],
    ) -> list[StaticFinding]:
        python_files = {
            path: content
            for path, content in files_with_content.items()
            if Path(path).suffix.lower() == ".py"
        }
        script_files = {
            path: content
            for path, content in files_with_content.items()
            if Path(path).suffix.lower() in {".ts", ".tsx", ".js", ".jsx"}
        }

        findings: list[StaticFinding] = []
        if python_files:
            findings.extend(await self._analyze_python(python_files, diff_summary))
        if script_files:
            findings.extend(await self._analyze_script(script_files, diff_summary))
        return self._sort(findings)

    async def _analyze_python(
        self,
        files_with_content: dict[str, str],
        diff_summary: dict[str, DiffFileSummary],
    ) -> list[StaticFinding]:
        findings: list[StaticFinding] = []
        findings.extend(await self._run_python_tools(files_with_content, diff_summary))
        findings.extend(self._python_heuristics(files_with_content, diff_summary))
        return findings

    async def _run_python_tools(
        self,
        files_with_content: dict[str, str],
        diff_summary: dict[str, DiffFileSummary],
    ) -> list[StaticFinding]:
        findings: list[StaticFinding] = []
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            self._write_temp_files(temp_dir, files_with_content)

            if self._python_module_available("ruff"):
                stdout, stderr, return_code = await self._run_subprocess(
                    [sys.executable, "-m", "ruff", "check", ".", "--output-format=json"],
                    cwd=temp_dir,
                )
                if return_code in {0, 1}:
                    try:
                        payload = json.loads(stdout or "[]")
                    except json.JSONDecodeError:
                        payload = []
                    for entry in payload:
                        relative_path = self._relative_issue_path(entry.get("filename", ""), temp_path)
                        line = entry.get("location", {}).get("row")
                        if not self._line_in_changed_scope(relative_path, line, diff_summary):
                            continue
                        findings.append(
                            StaticFinding(
                                file_path=relative_path,
                                line=line,
                                category=self._map_python_category(entry.get("code", "")),
                                skill=self._map_python_skill(entry.get("code", "")),
                                severity=self._map_python_severity(entry.get("code", "")),
                                rule_id=f"ruff:{entry.get('code', 'unknown')}",
                                source="ruff",
                                message=entry.get("message", "ruff issue"),
                                evidence=entry.get("code"),
                                confidence=0.92,
                                tags=["python", "lint"],
                            )
                        )
                else:
                    logger.warning("ruff failed: %s", stderr.strip() or stdout.strip())

            if self._python_module_available("bandit"):
                stdout, stderr, return_code = await self._run_subprocess(
                    [sys.executable, "-m", "bandit", "-q", "-r", ".", "-f", "json"],
                    cwd=temp_dir,
                )
                if return_code in {0, 1}:
                    try:
                        payload = json.loads(stdout or "{}")
                    except json.JSONDecodeError:
                        payload = {}
                    for result in payload.get("results", []):
                        relative_path = self._relative_issue_path(result.get("filename", ""), temp_path)
                        line = result.get("line_number")
                        if not self._line_in_changed_scope(relative_path, line, diff_summary):
                            continue
                        findings.append(
                            StaticFinding(
                                file_path=relative_path,
                                line=line,
                                category="security",
                                skill="security_secrets_auth",
                                severity=self._bandit_severity(result.get("issue_severity", "MEDIUM")),
                                rule_id=f"bandit:{result.get('test_id', 'unknown')}",
                                source="bandit",
                                message=result.get("issue_text", "Bandit issue"),
                                evidence=result.get("code"),
                                confidence=0.97,
                                tags=["python", "security"],
                            )
                        )
                else:
                    logger.warning("bandit failed: %s", stderr.strip() or stdout.strip())

        return findings

    async def _analyze_script(
        self,
        files_with_content: dict[str, str],
        diff_summary: dict[str, DiffFileSummary],
    ) -> list[StaticFinding]:
        findings = self._script_heuristics(files_with_content, diff_summary)
        findings.extend(await self._run_eslint(files_with_content, diff_summary))
        return findings

    async def _run_eslint(
        self,
        files_with_content: dict[str, str],
        diff_summary: dict[str, DiffFileSummary],
    ) -> list[StaticFinding]:
        eslint_bin = shutil.which("eslint") or shutil.which("eslint.cmd")
        if not shutil.which("node") or not eslint_bin:
            return []

        findings: list[StaticFinding] = []
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            self._write_temp_files(temp_dir, files_with_content)
            node_modules_root = self._detect_node_modules_root()
            if not node_modules_root:
                return []

            parser_module = Path(node_modules_root) / "@typescript-eslint" / "parser" / "dist" / "index.js"
            plugin_module = Path(node_modules_root) / "@typescript-eslint" / "eslint-plugin" / "dist" / "index.js"
            if not parser_module.exists() or not plugin_module.exists():
                return []

            config_path = Path(temp_dir) / "eslint.config.mjs"
            config_path.write_text(
                "\n".join(
                    [
                        f"import tsParser from {json.dumps(parser_module.as_uri())};",
                        f"import tsPlugin from {json.dumps(plugin_module.as_uri())};",
                        "export default [{",
                        "  files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],",
                        "  languageOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module' },",
                        "  plugins: { '@typescript-eslint': tsPlugin },",
                        "  rules: {",
                        "    'no-unused-vars': 'warn',",
                        "    '@typescript-eslint/no-explicit-any': 'warn',",
                        "    'eqeqeq': 'error',",
                        "    'no-console': 'warn'",
                        "  }",
                        "}];",
                    ]
                ),
                encoding="utf-8",
            )

            stdout, stderr, return_code = await self._run_subprocess(
                [eslint_bin, ".", "--config", str(config_path), "--no-config-lookup", "--format", "json"],
                cwd=temp_dir,
            )
            if return_code not in {0, 1}:
                logger.warning("eslint failed: %s", stderr.strip() or stdout.strip())
                return findings

            try:
                payload = json.loads(stdout or "[]")
            except json.JSONDecodeError:
                return findings

            for result in payload:
                relative_path = self._relative_issue_path(result.get("filePath", ""), temp_path)
                for message in result.get("messages", []):
                    line = message.get("line")
                    if not self._line_in_changed_scope(relative_path, line, diff_summary):
                        continue
                    findings.append(
                        StaticFinding(
                            file_path=relative_path,
                            line=line,
                            category=self._map_script_category(message.get("ruleId") or ""),
                            skill=self._map_script_skill(message.get("ruleId") or ""),
                            severity="high" if message.get("severity") == 2 else "medium",
                            rule_id=f"eslint:{message.get('ruleId') or 'unknown'}",
                            source="eslint",
                            message=message.get("message", "ESLint issue"),
                            evidence=message.get("ruleId"),
                            confidence=0.88,
                            tags=["javascript", "typescript", "lint"],
                        )
                    )
        return findings

    def _python_heuristics(
        self,
        files_with_content: dict[str, str],
        diff_summary: dict[str, DiffFileSummary],
    ) -> list[StaticFinding]:
        findings: list[StaticFinding] = []
        for file_path, content in files_with_content.items():
            try:
                tree = ast.parse(content)
            except SyntaxError:
                continue

            for node in ast.walk(tree):
                if isinstance(node, ast.ExceptHandler) and node.type is None and self._line_in_changed_scope(file_path, node.lineno, diff_summary):
                    findings.append(
                        StaticFinding(
                            file_path=file_path,
                            line=node.lineno,
                            category="error_handling",
                            skill="python_error_handling",
                            severity="critical",
                            rule_id="heuristic:bare-except",
                            source="heuristic",
                            message="Bare except block hides the original failure and should be replaced with a specific exception type.",
                            evidence="except:",
                            confidence=0.98,
                            tags=["python", "exceptions"],
                        )
                    )

                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    loop_depth = self._max_loop_depth(node)
                    if loop_depth >= 3 and self._line_in_changed_scope(file_path, node.lineno, diff_summary):
                        findings.append(
                            StaticFinding(
                                file_path=file_path,
                                line=node.lineno,
                                category="performance",
                                skill="performance_data_processing",
                                severity="high",
                                rule_id="heuristic:nested-loops",
                                source="heuristic",
                                message="Deeply nested loops in changed code suggest a potential performance hotspot and higher maintenance cost.",
                                evidence=node.name,
                                confidence=0.84,
                                tags=["python", "performance"],
                            )
                        )

            for snippet, rule_id, skill, category, severity, message in [
                ("mongodb://", "heuristic:hardcoded-db-uri", "security_secrets_auth", "security", "critical", "Hardcoded database URI detected in source code."),
                ("except Exception", "heuristic:broad-except", "python_error_handling", "error_handling", "high", "Broad exception handling in changed code can hide the real failure mode."),
            ]:
                line = self._find_line(content, snippet)
                if line and self._line_in_changed_scope(file_path, line, diff_summary):
                    findings.append(
                        StaticFinding(
                            file_path=file_path,
                            line=line,
                            category=category,
                            skill=skill,
                            severity=severity,
                            rule_id=rule_id,
                            source="heuristic",
                            message=message,
                            evidence=snippet,
                            confidence=0.9,
                            tags=["python"],
                        )
                    )
        return findings

    def _script_heuristics(
        self,
        files_with_content: dict[str, str],
        diff_summary: dict[str, DiffFileSummary],
    ) -> list[StaticFinding]:
        findings: list[StaticFinding] = []
        rules = [
            (": any", "heuristic:any", "type_safety", "code_quality", "medium", "Using `any` weakens type guarantees in changed code."),
            ("console.log", "heuristic:console", "code_maintainability", "code_quality", "low", "Console logging in application logic usually belongs behind structured logging."),
            ("fetch(", "heuristic:fetch", "async_error_handling", "error_handling", "medium", "Network call detected; verify error handling and response checks."),
            ("http://", "heuristic:http", "security_secrets_auth", "security", "medium", "Plain HTTP endpoint detected in changed code."),
            ("==", "heuristic:loose-equality", "type_safety", "code_quality", "medium", "Loose equality makes control flow and coercion harder to reason about."),
        ]
        for file_path, content in files_with_content.items():
            for snippet, rule_id, skill, category, severity, message in rules:
                line = self._find_line(content, snippet)
                if line and self._line_in_changed_scope(file_path, line, diff_summary):
                    findings.append(
                        StaticFinding(
                            file_path=file_path,
                            line=line,
                            category=category,
                            skill=skill,
                            severity=severity,
                            rule_id=rule_id,
                            source="heuristic",
                            message=message,
                            evidence=snippet,
                            confidence=0.74,
                            tags=["javascript", "typescript"],
                        )
                    )
        return findings

    async def _run_subprocess(self, cmd: list[str], cwd: str | None = None) -> tuple[str, str, int]:
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=40)
            return (
                stdout_bytes.decode("utf-8", errors="replace"),
                stderr_bytes.decode("utf-8", errors="replace"),
                process.returncode,
            )
        except asyncio.TimeoutError:
            return "", f"Timed out while running {' '.join(cmd)}", 1
        except Exception as exc:
            return "", str(exc), 1

    def _write_temp_files(self, temp_dir: str, files_with_content: dict[str, str]) -> None:
        for relative_path, content in files_with_content.items():
            destination = Path(temp_dir) / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content, encoding="utf-8")

    def _relative_issue_path(self, file_path: str, temp_path: Path) -> str:
        try:
            return str(Path(file_path).resolve().relative_to(temp_path.resolve())).replace("\\", "/")
        except Exception:
            return Path(file_path).name.replace("\\", "/")

    def _python_module_available(self, module_name: str) -> bool:
        try:
            import subprocess

            completed = subprocess.run(
                [
                    sys.executable,
                    "-c",
                    (
                        "import importlib.util,sys; "
                        f"sys.stdout.write('ok' if importlib.util.find_spec('{module_name}') else 'missing')"
                    ),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            return completed.returncode == 0 and completed.stdout.strip() == "ok"
        except Exception:
            return False

    def _detect_node_modules_root(self) -> str | None:
        candidates: list[Path] = []
        appdata = Path(os.environ.get("APPDATA", "")) if os.environ.get("APPDATA") else None
        if appdata:
            candidates.append(appdata / "npm" / "node_modules")

        for base in Path(__file__).resolve().parents:
            candidates.append(base / "node_modules")
        candidates.append(Path.cwd() / "node_modules")

        for candidate in candidates:
            if candidate.exists():
                return str(candidate)
        return None

    def _find_line(self, content: str, snippet: str) -> int | None:
        for index, line in enumerate(content.splitlines(), start=1):
            if snippet in line:
                return index
        return None

    def _line_in_changed_scope(
        self,
        file_path: str,
        line: int | None,
        diff_summary: dict[str, DiffFileSummary],
    ) -> bool:
        if line is None:
            return False
        diff_info = diff_summary.get(file_path)
        if not diff_info:
            return True
        return line in diff_info.added_lines or not diff_info.added_lines

    def _max_loop_depth(self, node: ast.AST, depth: int = 0) -> int:
        next_depth = depth + 1 if isinstance(node, (ast.For, ast.AsyncFor, ast.While)) else depth
        child_depths = [self._max_loop_depth(child, next_depth) for child in ast.iter_child_nodes(node)]
        return max([next_depth, *child_depths], default=next_depth)

    def _map_python_category(self, rule: str) -> str:
        if rule.startswith("S"):
            return "security"
        if rule.startswith("C90"):
            return "performance"
        if rule.startswith("ANN"):
            return "documentation"
        return "code_quality"

    def _map_python_skill(self, rule: str) -> str:
        if rule.startswith("S"):
            return "security_secrets_auth"
        if rule.startswith("ANN"):
            return "documentation_readability"
        if rule.startswith("C90"):
            return "performance_data_processing"
        return "python_idioms_types"

    def _map_python_severity(self, rule: str) -> str:
        if rule.startswith("S"):
            return "high"
        if rule.startswith("C90"):
            return "high"
        if rule.startswith("ANN"):
            return "medium"
        return "low"

    def _bandit_severity(self, severity: str) -> str:
        mapping = {"LOW": "medium", "MEDIUM": "high", "HIGH": "critical"}
        return mapping.get(str(severity).upper(), "high")

    def _map_script_category(self, rule_id: str) -> str:
        mapping = {
            "@typescript-eslint/no-explicit-any": "code_quality",
            "eqeqeq": "code_quality",
            "no-console": "code_quality",
        }
        return mapping.get(rule_id, "code_quality")

    def _map_script_skill(self, rule_id: str) -> str:
        mapping = {
            "@typescript-eslint/no-explicit-any": "type_safety",
            "eqeqeq": "type_safety",
            "no-console": "code_maintainability",
        }
        return mapping.get(rule_id, "code_maintainability")

    def _sort(self, findings: list[StaticFinding]) -> list[StaticFinding]:
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        return sorted(
            findings,
            key=lambda item: (
                -severity_order.get(item.severity, 0),
                -item.confidence,
                item.file_path,
                item.line or 0,
            ),
        )
