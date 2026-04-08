import asyncio
import ast
import json
import logging
import os
import re
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


logger = logging.getLogger(__name__)

WEAKNESS_CATEGORIES = {
    "error_handling": "Not handling exceptions or errors properly",
    "code_complexity": "Functions too complex or too long",
    "naming_conventions": "Poor naming that hurts readability",
    "security": "Potential security vulnerabilities",
    "testing": "Missing or insufficient tests",
    "solid_principles": "OOP/design principle violations",
    "performance": "Inefficient patterns",
    "documentation": "Missing or poor documentation",
    "language_idioms": "Not using idiomatic patterns for this language",
    "dependency_management": "Import or dependency issues",
}

SEVERITY_ORDER = {"high": 3, "medium": 2, "low": 1}


@dataclass
class StaticIssue:
    file: str
    line: int | None
    category: str
    severity: str
    message: str
    rule: str
    tool: str


class StaticAnalyzer:
    async def analyze(self, files_with_content: dict[str, str]) -> list[StaticIssue]:
        """
        Main entry point. Receives { filepath: file_content } dict.
        Detects language per file, routes to the right analyzer,
        aggregates and returns all issues sorted by severity desc.
        """
        python_files = {
            path: content
            for path, content in files_with_content.items()
            if Path(path).suffix.lower() == ".py"
        }
        ts_files = {
            path: content
            for path, content in files_with_content.items()
            if Path(path).suffix.lower() in {".ts", ".tsx"}
        }

        tasks = []
        if python_files:
            tasks.append(self._analyze_python(python_files))
        if ts_files:
            tasks.append(self._analyze_typescript(ts_files))

        if not tasks:
            return []

        results = await asyncio.gather(*tasks)
        issues = [issue for bucket in results for issue in bucket]
        return sorted(
            issues,
            key=lambda issue: (
                -SEVERITY_ORDER.get(issue.severity, 0),
                issue.file,
                issue.line or 0,
            ),
        )

    async def _analyze_python(
        self, files_with_content: dict[str, str]
    ) -> list[StaticIssue]:
        """
        Writes files to a temp directory, runs ruff and radon, parses output.

        For ruff: run as subprocess with --output-format=json
        Map ruff rule codes to WEAKNESS_CATEGORIES:
          E/W → "naming_conventions" or "language_idioms"
          C90 → "code_complexity"
          S   → "security"
          B   → "language_idioms" (bugbear)
          ANN → "documentation"

        For radon: run `radon cc -j` for cyclomatic complexity
        Any function with complexity > 10 → "code_complexity" HIGH
        complexity 7-10 → "code_complexity" MEDIUM

        Clean up temp directory after analysis.
        """
        issues: list[StaticIssue] = []

        with tempfile.TemporaryDirectory() as temp_dir:
            self._write_temp_files(temp_dir, files_with_content)
            temp_path = Path(temp_dir)

            if self._python_module_available("ruff"):
                stdout, stderr, return_code = await self._run_subprocess(
                    [sys.executable, "-m", "ruff", "check", ".", "--output-format=json"],
                    cwd=temp_dir,
                )
                if return_code in {0, 1}:
                    try:
                        payload = json.loads(stdout or "[]")
                    except json.JSONDecodeError:
                        logger.warning("ruff returned invalid JSON: %s", stdout)
                        payload = []
                    for entry in payload:
                        rule = (entry.get("code") or "").strip()
                        issues.append(
                            StaticIssue(
                                file=self._relative_issue_path(entry.get("filename", ""), temp_path),
                                line=entry.get("location", {}).get("row"),
                                category=self._map_ruff_category(rule, entry.get("message", "")),
                                severity=self._map_ruff_severity(rule),
                                message=entry.get("message", "ruff issue"),
                                rule=rule or "ruff",
                                tool="ruff",
                            )
                        )
                else:
                    logger.warning("ruff failed: %s", stderr.strip() or stdout.strip())
            else:
                logger.warning("ruff is not installed; skipping Python lint analysis")

            if self._python_module_available("radon"):
                stdout, stderr, return_code = await self._run_subprocess(
                    [sys.executable, "-m", "radon", "cc", "-j", "."],
                    cwd=temp_dir,
                )
                if return_code in {0, 1}:
                    try:
                        payload = json.loads(stdout or "{}")
                    except json.JSONDecodeError:
                        logger.warning("radon returned invalid JSON: %s", stdout)
                        payload = {}
                    for file_path, blocks in payload.items():
                        for block in blocks or []:
                            complexity = int(block.get("complexity", 0))
                            if complexity > 10:
                                severity = "high"
                            elif complexity >= 7:
                                severity = "medium"
                            else:
                                continue
                            issues.append(
                                StaticIssue(
                                    file=self._relative_issue_path(file_path, temp_path),
                                    line=block.get("lineno"),
                                    category="code_complexity",
                                    severity=severity,
                                    message=(
                                        f"{block.get('type', 'block').title()} "
                                        f"{block.get('name', '<unknown>')} has cyclomatic complexity {complexity}"
                                    ),
                                    rule=f"radon-cc-{complexity}",
                                    tool="radon",
                                )
                            )
                else:
                    logger.warning("radon failed: %s", stderr.strip() or stdout.strip())
            else:
                logger.warning("radon is not installed; skipping Python complexity analysis")

        issues.extend(self._heuristic_python_issues(files_with_content))
        return issues

    async def _analyze_typescript(
        self, files_with_content: dict[str, str]
    ) -> list[StaticIssue]:
        """
        Writes files to temp dir, runs eslint with --format=json.
        Use a minimal .eslintrc config:
          {
            "parser": "@typescript-eslint/parser",
            "plugins": ["@typescript-eslint"],
            "rules": {
              "no-unused-vars": "warn",
              "no-explicit-any": "warn",
              "@typescript-eslint/explicit-function-return-type": "warn",
              "no-console": "warn",
              "eqeqeq": "error"
            }
          }
        Map eslint rule IDs to WEAKNESS_CATEGORIES.
        If node/eslint not available, return empty list with a warning log, don't crash.
        """
        eslint_bin = shutil.which("eslint") or shutil.which("eslint.cmd")
        if not shutil.which("node") or not eslint_bin:
            logger.warning("node or eslint is unavailable; skipping TypeScript analysis")
            return self._heuristic_typescript_issues(files_with_content)

        issues: list[StaticIssue] = []

        with tempfile.TemporaryDirectory() as temp_dir:
            self._write_temp_files(temp_dir, files_with_content)
            temp_path = Path(temp_dir)
            global_node_modules = self._detect_global_node_modules()
            if not global_node_modules:
                logger.warning("Unable to locate global node_modules for ESLint; using heuristic TypeScript analysis")
                return self._heuristic_typescript_issues(files_with_content)

            parser_module = Path(global_node_modules) / "@typescript-eslint" / "parser" / "dist" / "index.js"
            plugin_module = Path(global_node_modules) / "@typescript-eslint" / "eslint-plugin" / "dist" / "index.js"
            if not parser_module.exists() or not plugin_module.exists():
                logger.warning("TypeScript ESLint parser/plugin not found; using heuristic TypeScript analysis")
                return self._heuristic_typescript_issues(files_with_content)

            config_path = Path(temp_dir) / "eslint.config.mjs"
            config_path.write_text(
                "\n".join(
                    [
                        f"import tsParser from {json.dumps(parser_module.as_posix())};",
                        f"import tsPlugin from {json.dumps(plugin_module.as_posix())};",
                        "",
                        "export default [",
                        "  {",
                        "    files: ['**/*.ts', '**/*.tsx'],",
                        "    languageOptions: {",
                        "      parser: tsParser,",
                        "      ecmaVersion: 'latest',",
                        "      sourceType: 'module',",
                        "    },",
                        "    plugins: {",
                        "      '@typescript-eslint': tsPlugin,",
                        "    },",
                        "    rules: {",
                        "      'no-unused-vars': 'warn',",
                        "      '@typescript-eslint/no-explicit-any': 'warn',",
                        "      '@typescript-eslint/explicit-function-return-type': 'warn',",
                        "      'no-console': 'warn',",
                        "      eqeqeq: 'error',",
                        "    },",
                        "  },",
                        "];",
                    ]
                ),
                encoding="utf-8",
            )
            stdout, stderr, return_code = await self._run_subprocess(
                [
                    eslint_bin,
                    ".",
                    "--config",
                    str(config_path),
                    "--no-config-lookup",
                    "--format",
                    "json",
                ],
                cwd=temp_dir,
            )
            if return_code not in {0, 1}:
                logger.warning("eslint failed: %s", stderr.strip() or stdout.strip())
                return self._heuristic_typescript_issues(files_with_content)

            try:
                payload = json.loads(stdout or "[]")
            except json.JSONDecodeError:
                logger.warning("eslint returned invalid JSON: %s", stdout)
                return self._heuristic_typescript_issues(files_with_content)

            for result in payload:
                relative_path = self._relative_issue_path(result.get("filePath", ""), temp_path)
                for message in result.get("messages", []):
                    rule_id = message.get("ruleId") or "eslint"
                    issues.append(
                        StaticIssue(
                            file=relative_path,
                            line=message.get("line"),
                            category=self._map_eslint_category(rule_id),
                            severity="high" if message.get("severity") == 2 else "medium",
                            message=message.get("message", "eslint issue"),
                            rule=rule_id,
                            tool="eslint",
                        )
                    )

        issues.extend(self._heuristic_typescript_issues(files_with_content))
        return issues

    async def _run_subprocess(
        self, cmd: list[str], cwd: str = None
    ) -> tuple[str, str, int]:
        """
        Runs a subprocess asynchronously using asyncio.create_subprocess_exec.
        Returns (stdout, stderr, return_code).
        Never raises — always returns even on failure.
        """
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(),
                timeout=30,
            )
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

    def _map_ruff_category(self, rule: str, message: str) -> str:
        lowered = f"{rule} {message}".lower()
        if rule == "E722" or "bare except" in lowered:
            return "error_handling"
        if rule.startswith("ANN"):
            return "documentation"
        if rule.startswith("S"):
            return "security"
        if rule.startswith("C90"):
            return "code_complexity"
        if rule.startswith("B"):
            return "language_idioms"
        if rule.startswith(("E", "W")):
            if "name" in lowered or "naming" in lowered:
                return "naming_conventions"
            return "language_idioms"
        return "language_idioms"

    def _map_ruff_severity(self, rule: str) -> str:
        if rule.startswith(("S", "C90")):
            return "high"
        if rule.startswith(("B", "ANN")):
            return "medium"
        return "low"

    def _map_eslint_category(self, rule_id: str) -> str:
        mapping = {
            "no-unused-vars": "naming_conventions",
            "@typescript-eslint/no-explicit-any": "language_idioms",
            "@typescript-eslint/explicit-function-return-type": "documentation",
            "no-console": "language_idioms",
            "eqeqeq": "language_idioms",
        }
        return mapping.get(rule_id, "language_idioms")

    def _python_module_available(self, module_name: str) -> bool:
        stdout, _, return_code = self._run_module_probe(module_name)
        return return_code == 0 and stdout.strip() == "ok"

    def _run_module_probe(self, module_name: str) -> tuple[str, str, int]:
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
            return completed.stdout, completed.stderr, completed.returncode
        except Exception as exc:
            return "", str(exc), 1

    def _detect_global_node_modules(self) -> str | None:
        appdata = Path(os.environ.get("APPDATA", "")) if os.environ.get("APPDATA") else None
        if appdata:
            candidate = appdata / "npm" / "node_modules"
            if candidate.exists():
                return str(candidate)
        try:
            import subprocess

            completed = subprocess.run(
                ["npm.cmd" if sys.platform.startswith("win") else "npm", "root", "-g"],
                capture_output=True,
                text=True,
                check=False,
            )
            if completed.returncode == 0:
                value = completed.stdout.strip()
                return value or None
        except Exception:
            return None
        return None

    def _heuristic_python_issues(
        self, files_with_content: dict[str, str]
    ) -> list[StaticIssue]:
        issues: list[StaticIssue] = []
        for file_path, content in files_with_content.items():
            try:
                tree = ast.parse(content)
            except SyntaxError:
                continue

            for node in ast.walk(tree):
                if isinstance(node, ast.ExceptHandler) and node.type is None:
                    issues.append(
                        StaticIssue(
                            file=file_path,
                            line=node.lineno,
                            category="error_handling",
                            severity="high",
                            message="Bare except block hides real failures.",
                            rule="heuristic-bare-except",
                            tool="heuristic",
                        )
                    )
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    import_lines = [
                        child.lineno
                        for child in ast.walk(node)
                        if isinstance(child, (ast.Import, ast.ImportFrom))
                    ]
                    if import_lines:
                        issues.append(
                            StaticIssue(
                                file=file_path,
                                line=min(import_lines),
                                category="dependency_management",
                                severity="medium",
                                message="Import inside a function suggests dependency setup is leaking into runtime logic.",
                                rule="heuristic-import-in-function",
                                tool="heuristic",
                            )
                        )
                    loop_depth = self._max_loop_depth(node)
                    if loop_depth >= 3:
                        issues.append(
                            StaticIssue(
                                file=file_path,
                                line=node.lineno,
                                category="code_complexity",
                                severity="high",
                                message="Deeply nested loops make the function hard to reason about and maintain.",
                                rule="heuristic-nested-loops",
                                tool="heuristic",
                            )
                        )

            if re.search(r"mongodb://[^\"'\s]*:[^\"'\s]*@", content):
                issues.append(
                    StaticIssue(
                        file=file_path,
                        line=self._find_line(content, "mongodb://"),
                        category="security",
                        severity="high",
                        message="Hardcoded database credentials detected in source code.",
                        rule="heuristic-hardcoded-credentials",
                        tool="heuristic",
                    )
                )
            if re.search(r"find_one\(\{.*password.*\}\)", content, re.DOTALL):
                issues.append(
                    StaticIssue(
                        file=file_path,
                        line=self._find_line(content, "password"),
                        category="security",
                        severity="high",
                        message="Credentials appear to be queried or stored in plaintext.",
                        rule="heuristic-plaintext-password",
                        tool="heuristic",
                    )
                )
            if re.search(r"except\s+Exception(?:\s+as\s+\w+)?\s*:", content):
                issues.append(
                    StaticIssue(
                        file=file_path,
                        line=self._find_line(content, "except Exception"),
                        category="error_handling",
                        severity="medium",
                        message="Broad exception handling can hide the real failure mode unless narrowed carefully.",
                        rule="heuristic-broad-except",
                        tool="heuristic",
                    )
                )

        return issues

    def _heuristic_typescript_issues(
        self, files_with_content: dict[str, str]
    ) -> list[StaticIssue]:
        issues: list[StaticIssue] = []
        for file_path, content in files_with_content.items():
            if ": any" in content:
                issues.append(
                    StaticIssue(
                        file=file_path,
                        line=self._find_line(content, ": any"),
                        category="language_idioms",
                        severity="medium",
                        message="Using 'any' weakens TypeScript's type guarantees.",
                        rule="heuristic-any",
                        tool="heuristic",
                    )
                )
            if "==" in content:
                issues.append(
                    StaticIssue(
                        file=file_path,
                        line=self._find_line(content, "=="),
                        category="language_idioms",
                        severity="medium",
                        message="Loose equality makes control flow harder to reason about.",
                        rule="heuristic-loose-equality",
                        tool="heuristic",
                    )
                )
            if "console.log" in content:
                issues.append(
                    StaticIssue(
                        file=file_path,
                        line=self._find_line(content, "console.log"),
                        category="language_idioms",
                        severity="low",
                        message="Console logging in service code usually belongs behind structured logging.",
                        rule="heuristic-console",
                        tool="heuristic",
                    )
                )
            if "fetch(" in content and "response.ok" not in content:
                issues.append(
                    StaticIssue(
                        file=file_path,
                        line=self._find_line(content, "fetch("),
                        category="error_handling",
                        severity="medium",
                        message="Network calls should verify response.ok before consuming the payload.",
                        rule="heuristic-missing-response-check",
                        tool="heuristic",
                    )
                )
            if "http://" in content:
                issues.append(
                    StaticIssue(
                        file=file_path,
                        line=self._find_line(content, "http://"),
                        category="security",
                        severity="low",
                        message="Plain HTTP endpoints can expose sensitive traffic or credentials.",
                        rule="heuristic-insecure-http",
                        tool="heuristic",
                    )
                )
            missing_return_match = re.search(r"async\s+\w+\([^)]*\)\s*\{", content)
            if missing_return_match and ":" not in missing_return_match.group(0):
                issues.append(
                    StaticIssue(
                        file=file_path,
                        line=self._find_line(content, missing_return_match.group(0).strip()),
                        category="documentation",
                        severity="medium",
                        message="Public async method is missing an explicit return type.",
                        rule="heuristic-missing-return-type",
                        tool="heuristic",
                    )
                )
            short_param_match = re.search(r"\bprocessData\((\w)\)", content)
            if short_param_match:
                issues.append(
                    StaticIssue(
                        file=file_path,
                        line=self._find_line(content, short_param_match.group(0)),
                        category="naming_conventions",
                        severity="low",
                        message="Single-letter parameter names reduce readability.",
                        rule="heuristic-short-name",
                        tool="heuristic",
                    )
                )

        return issues

    def _find_line(self, content: str, snippet: str) -> int | None:
        for index, line in enumerate(content.splitlines(), start=1):
            if snippet in line:
                return index
        return None

    def _max_loop_depth(self, node: ast.AST, depth: int = 0) -> int:
        next_depth = depth + 1 if isinstance(node, (ast.For, ast.AsyncFor, ast.While)) else depth
        child_depths = [self._max_loop_depth(child, next_depth) for child in ast.iter_child_nodes(node)]
        return max([next_depth, *child_depths], default=next_depth)
