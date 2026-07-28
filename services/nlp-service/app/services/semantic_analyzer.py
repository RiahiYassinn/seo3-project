from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Any

from app.services.analysis_types import DiffFileSummary, SemanticFact, SemanticReport, SymbolFact


class SemanticAnalyzer:
    def analyze(
        self,
        files_with_content: dict[str, str],
        diff_summary: dict[str, DiffFileSummary],
        commit_message: str,
    ) -> SemanticReport:
        facts: list[SemanticFact] = []
        language_counts: dict[str, int] = {}

        for file_path, content in files_with_content.items():
            fallback_info = DiffFileSummary(
                file_path=file_path,
                language=self._detect_language(file_path),
            )
            diff_info = diff_summary.get(file_path, fallback_info)
            language = diff_info.language
            fact = (
                self._analyze_python_file(file_path, content, diff_info)
                if language == "python"
                else self._analyze_script_file(file_path, content, diff_info, language)
            )
            facts.append(fact)
            language_counts[language] = language_counts.get(language, 0) + 1

        dominant_language = (
            max(language_counts.items(), key=lambda item: item[1])[0]
            if language_counts
            else "unknown"
        )
        return SemanticReport(
            facts=facts,
            files_by_path=diff_summary,
            dominant_language=dominant_language,
            commit_topics=self._extract_topics(commit_message),
        )

    def _analyze_python_file(
        self,
        file_path: str,
        content: str,
        diff_info: DiffFileSummary,
    ) -> SemanticFact:
        changed_lines = sorted(diff_info.added_lines)
        comments = self._extract_comments(content)
        fact = SemanticFact(
            file_path=file_path,
            language="python",
            file_role=self._infer_file_role(file_path),
            comments=comments,
            tokens=self._tokenize_text(" ".join([file_path, *comments])),
            changed_lines=changed_lines,
            changed=bool(changed_lines),
            confidence=0.88,
        )

        try:
            tree = ast.parse(content)
        except SyntaxError:
            fact.confidence = 0.2
            fact.signals["parse_failed"] = True
            return fact

        imports: list[str] = []
        intents: set[str] = set()
        entities: set[str] = set()
        symbols: list[SymbolFact] = []

        fact.signals["has_module_docstring"] = bool(ast.get_docstring(tree))
        fact.signals["has_tests"] = "test" in file_path.lower()

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                symbol = self._build_python_symbol(node, changed_lines)
                symbols.append(symbol)
                intents.update(symbol.intent)
                if any(
                    intent in {"validate_input", "authentication", "database_query"}
                    for intent in symbol.intent
                ):
                    entities.update(symbol.intent)
            elif isinstance(node, ast.ClassDef):
                entities.add(self._classify_name(node.name))

        fact.imports = sorted(set(imports))
        fact.frameworks = self._infer_frameworks(fact.imports, file_path, "python")
        fact.intents = sorted(intents)
        fact.entities = sorted(entity for entity in entities if entity != "generic")
        fact.symbols = symbols
        python_signals, python_observations = self._derive_python_signals(
            tree,
            content,
            changed_lines,
            symbols,
        )
        fact.signals.update(python_signals)
        fact.observations.update(python_observations)
        fact.tokens = sorted(
            set(fact.tokens + self._tokenize_text(" ".join(fact.imports)))
        )
        return fact

    def _build_python_symbol(
        self,
        node: ast.FunctionDef | ast.AsyncFunctionDef,
        changed_lines: list[int],
    ) -> SymbolFact:
        symbol = SymbolFact(
            name=node.name,
            kind="async_function" if isinstance(node, ast.AsyncFunctionDef) else "function",
            line=getattr(node, "lineno", None),
            end_line=getattr(node, "end_lineno", None),
            comments=[ast.get_docstring(node) or ""],
            tokens=self._tokenize_identifier(node.name),
            changed=self._span_overlaps(
                node.lineno,
                getattr(node, "end_lineno", None),
                changed_lines,
            ),
        )
        call_names: list[str] = []
        intents = set(self._infer_intent_from_name(node.name))
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                call_name = self._call_name(child.func)
                if call_name:
                    call_names.append(call_name)
                    intents.update(self._infer_intent_from_name(call_name))
            elif isinstance(child, ast.ExceptHandler):
                intents.add("error_handling")
        symbol.calls = sorted(set(call_names))
        symbol.intent = sorted(intents)
        return symbol

    def _derive_python_signals(
        self,
        tree: ast.AST,
        content: str,
        changed_lines: list[int],
        symbols: list[SymbolFact],
    ) -> tuple[dict[str, bool], dict[str, Any]]:
        has_try = False
        has_docstrings = bool(ast.get_docstring(tree))
        has_assert = False
        has_logging = "logger." in content or "logging." in content
        changed_scope = self._expand_line_scope(changed_lines, len(content.splitlines()), radius=1)
        bare_except_lines: list[int] = []
        broad_except_lines: list[int] = []
        raise_lines: list[int] = []
        try_lines: list[int] = []
        assert_lines: list[int] = []
        hardcoded_secret_lines = self._find_secret_assignment_lines(content)

        for node in ast.walk(tree):
            if isinstance(node, ast.Try):
                has_try = True
                if getattr(node, "lineno", None):
                    try_lines.append(node.lineno)
            elif isinstance(node, ast.ExceptHandler):
                if node.type is None:
                    if getattr(node, "lineno", None):
                        bare_except_lines.append(node.lineno)
                elif isinstance(node.type, ast.Name) and node.type.id == "Exception":
                    if getattr(node, "lineno", None):
                        broad_except_lines.append(node.lineno)
            elif isinstance(node, ast.Raise):
                if getattr(node, "lineno", None):
                    raise_lines.append(node.lineno)
            elif isinstance(node, ast.Assert):
                has_assert = True
                if getattr(node, "lineno", None):
                    assert_lines.append(node.lineno)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if ast.get_docstring(node):
                    has_docstrings = True

        typed_symbols = [
            symbol.name
            for symbol in symbols
            if symbol.changed and self._python_symbol_has_type_hints(tree, symbol.name)
        ]
        changed_bare_except_lines = self._lines_in_scope(bare_except_lines, changed_scope)
        changed_broad_except_lines = self._lines_in_scope(
            broad_except_lines,
            changed_scope,
        )
        changed_raise_lines = self._lines_in_scope(raise_lines, changed_scope)
        changed_try_lines = self._lines_in_scope(try_lines, changed_scope)
        changed_assert_lines = self._lines_in_scope(assert_lines, changed_scope)
        changed_secret_lines = self._lines_in_scope(hardcoded_secret_lines, changed_scope)

        observations = {
            "changed_scope_line_count": len(changed_scope),
            "try_lines": try_lines,
            "changed_try_lines": changed_try_lines,
            "bare_except_lines": bare_except_lines,
            "changed_bare_except_lines": changed_bare_except_lines,
            "broad_except_lines": broad_except_lines,
            "changed_broad_except_lines": changed_broad_except_lines,
            "raise_lines": raise_lines,
            "changed_raise_lines": changed_raise_lines,
            "assert_lines": assert_lines,
            "changed_assert_lines": changed_assert_lines,
            "hardcoded_secret_lines": hardcoded_secret_lines,
            "changed_hardcoded_secret_lines": changed_secret_lines,
            "typed_symbol_names": typed_symbols,
            "typed_symbol_count": len(typed_symbols),
            "docstring_count": sum(
                1
                for node in ast.walk(tree)
                if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
                and ast.get_docstring(node)
            ),
        }

        signals = {
            "has_try": bool(changed_try_lines) or (has_try and not changed_lines),
            "broad_except": bool(changed_broad_except_lines),
            "bare_except": bool(changed_bare_except_lines),
            "has_raise": bool(changed_raise_lines) or (bool(raise_lines) and not changed_lines),
            "has_logging": has_logging,
            "has_docstrings": has_docstrings,
            "has_tests": has_assert or "test" in content.lower(),
            "hardcoded_secret": bool(changed_secret_lines),
            "changed_scope_present": bool(changed_lines),
            "typed_changed_symbols": len(typed_symbols) > 0,
        }
        return signals, observations

    def _analyze_script_file(
        self,
        file_path: str,
        content: str,
        diff_info: DiffFileSummary,
        language: str,
    ) -> SemanticFact:
        changed_lines = sorted(diff_info.added_lines)
        comments = self._extract_comments(content)
        imports = self._extract_script_imports(content)
        frameworks = self._infer_frameworks(imports, file_path, language)
        symbols = self._extract_script_symbols(content, changed_lines)
        intents: set[str] = set()
        for symbol in symbols:
            intents.update(symbol.intent)
        signals, observations = self._build_script_semantic_signals(
            file_path=file_path,
            content=content,
            changed_lines=changed_lines,
            symbols=symbols,
        )
        entities = sorted(
            {
                self._classify_name(Path(file_path).stem),
                *(
                    intent
                    for intent in intents
                    if intent in {"authentication", "database_query", "validate_input"}
                ),
            }
        )
        return SemanticFact(
            file_path=file_path,
            language=language,
            file_role=self._infer_file_role(file_path),
            frameworks=frameworks,
            imports=imports,
            comments=comments,
            tokens=sorted(
                set(self._tokenize_text(" ".join([file_path, *comments, *imports])))
            ),
            intents=sorted(intents),
            entities=[entity for entity in entities if entity != "generic"],
            changed_lines=changed_lines,
            changed=bool(changed_lines),
            confidence=0.72,
            signals=signals,
            observations=observations,
            symbols=symbols,
        )

    def _build_script_semantic_signals(
        self,
        file_path: str,
        content: str,
        changed_lines: list[int],
        symbols: list[SymbolFact],
    ) -> tuple[dict[str, bool], dict[str, Any]]:
        lines = content.splitlines()
        changed_scope = self._expand_changed_scope(changed_lines, symbols, len(lines))
        fetch_lines = self._find_pattern_lines(lines, r"\bfetch\s*\(")
        response_ok_lines = self._find_pattern_lines(lines, r"\bresponse\.ok\b")
        effect_lines = self._find_pattern_lines(lines, r"\buseEffect\s*\(")
        cleanup_lines = self._find_pattern_lines(lines, r"\breturn\s*\(\)\s*=>")
        loading_lines = self._find_pattern_lines(
            lines,
            r"\b(isLoading|loading|setLoading|startTransition|isPending)\b",
        )
        catch_lines = self._find_pattern_lines(lines, r"\.catch\s*\(|\bcatch\s*\(")
        try_lines = self._find_pattern_lines(lines, r"\btry\s*\{")
        any_lines = self._find_pattern_lines(lines, r":\s*any\b|<any>|(?:\s|^)as\s+any\b")
        test_lines = self._find_pattern_lines(lines, r"\b(describe|it|test|expect)\s*\(")
        doc_block_lines = self._find_pattern_lines(lines, r"/\*\*")

        paired_symbols: list[str] = []
        typed_symbols: list[str] = []
        async_symbols: list[str] = []
        for symbol in symbols:
            if not symbol.changed or not symbol.line:
                continue
            window_end = symbol.end_line or symbol.line
            window = "\n".join(lines[symbol.line - 1 : window_end])
            if "useEffect(" in window and "fetch(" in window:
                paired_symbols.append(symbol.name)
            if re.search(r":\s*[A-Za-z_][A-Za-z0-9_<>\[\]\|&,\s]*", window):
                typed_symbols.append(symbol.name)
            if symbol.kind.startswith("async") or "await " in window:
                async_symbols.append(symbol.name)

        observations = {
            "changed_scope_lines": sorted(changed_scope),
            "changed_scope_line_count": len(changed_scope),
            "fetch_call_lines": fetch_lines,
            "fetch_call_count_in_changed_scope": self._count_lines_in_scope(fetch_lines, changed_scope),
            "response_ok_lines": response_ok_lines,
            "response_ok_count_in_changed_scope": self._count_lines_in_scope(
                response_ok_lines,
                changed_scope,
            ),
            "use_effect_lines": effect_lines,
            "use_effect_count_in_changed_scope": self._count_lines_in_scope(
                effect_lines,
                changed_scope,
            ),
            "cleanup_lines": cleanup_lines,
            "cleanup_count_in_changed_scope": self._count_lines_in_scope(
                cleanup_lines,
                changed_scope,
            ),
            "loading_state_lines": loading_lines,
            "loading_state_count_in_changed_scope": self._count_lines_in_scope(
                loading_lines,
                changed_scope,
            ),
            "catch_lines": catch_lines,
            "try_lines": try_lines,
            "error_handler_count_in_changed_scope": self._count_lines_in_scope(
                [*catch_lines, *try_lines],
                changed_scope,
            ),
            "explicit_any_lines": any_lines,
            "explicit_any_count_in_changed_scope": self._count_lines_in_scope(
                any_lines,
                changed_scope,
            ),
            "test_marker_lines": test_lines,
            "test_marker_count": len(test_lines),
            "doc_block_lines": doc_block_lines,
            "doc_block_count_in_changed_scope": self._count_lines_in_scope(
                doc_block_lines,
                changed_scope,
            ),
            "react_effect_fetch_symbol_names": sorted(set(paired_symbols)),
            "react_effect_fetch_pairs_in_changed_scope": len(set(paired_symbols)),
            "typed_symbol_names": sorted(set(typed_symbols)),
            "typed_symbol_count": len(set(typed_symbols)),
            "async_symbol_names": sorted(set(async_symbols)),
            "async_symbol_count": len(set(async_symbols)),
        }

        signals = {
            "uses_fetch": observations["fetch_call_count_in_changed_scope"] > 0,
            "checks_response_ok": observations["response_ok_count_in_changed_scope"] > 0,
            "uses_use_effect": observations["use_effect_count_in_changed_scope"] > 0,
            "has_cleanup": observations["cleanup_count_in_changed_scope"] > 0,
            "has_loading_state": observations["loading_state_count_in_changed_scope"] > 0,
            "has_error_handling": observations["error_handler_count_in_changed_scope"] > 0,
            "uses_any": observations["explicit_any_count_in_changed_scope"] > 0,
            "has_tests": ".test." in file_path
            or ".spec." in file_path
            or observations["test_marker_count"] > 0,
            "has_docs": observations["doc_block_count_in_changed_scope"] > 0,
            "typed_changed_symbols": observations["typed_symbol_count"] > 0,
            "react_effect_fetch_pair": observations["react_effect_fetch_pairs_in_changed_scope"] > 0,
        }
        return signals, observations

    def _extract_script_symbols(
        self,
        content: str,
        changed_lines: list[int],
    ) -> list[SymbolFact]:
        symbols: list[SymbolFact] = []
        patterns = [
            re.compile(
                r"(?P<kind>async function|function)\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\("
            ),
            re.compile(
                r"(?P<kind>const|let|var)\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?\("
            ),
            re.compile(r"(?P<kind>class)\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)"),
        ]
        lines = content.splitlines()
        for index, line in enumerate(lines, start=1):
            for pattern in patterns:
                match = pattern.search(line)
                if not match:
                    continue
                name = match.group("name")
                window_end = min(len(lines), index + 12)
                window = "\n".join(lines[index - 1 : window_end])
                symbol = SymbolFact(
                    name=name,
                    kind=match.group("kind"),
                    line=index,
                    end_line=window_end,
                    tokens=self._tokenize_identifier(name),
                    changed=self._span_overlaps(index, window_end, changed_lines),
                )
                intents = set(self._infer_intent_from_name(name))
                for call in re.findall(r"([A-Za-z_][A-Za-z0-9_\.]*)\s*\(", window):
                    intents.update(self._infer_intent_from_name(call))
                    symbol.calls.append(call)
                if "useEffect(" in window:
                    intents.add("react_effect")
                symbol.intent = sorted(intents)
                symbols.append(symbol)
                break
        return symbols

    def _extract_script_imports(self, content: str) -> list[str]:
        imports = re.findall(r"import\s+.*?\s+from\s+['\"]([^'\"]+)['\"]", content)
        imports.extend(re.findall(r"require\(['\"]([^'\"]+)['\"]\)", content))
        return sorted(set(imports))

    def _infer_frameworks(
        self,
        imports: list[str],
        file_path: str,
        language: str,
    ) -> list[str]:
        joined = " ".join(imports).lower() + " " + file_path.lower()
        frameworks: list[str] = []
        if "react" in joined:
            frameworks.append("react")
        if "next" in joined:
            frameworks.append("nextjs")
        if "nestjs" in joined or "@nestjs/" in joined:
            frameworks.append("nestjs")
        if "express" in joined:
            frameworks.append("express")
        if "django" in joined:
            frameworks.append("django")
        if "fastapi" in joined:
            frameworks.append("fastapi")
        if "flask" in joined:
            frameworks.append("flask")
        if (
            "sqlalchemy" in joined
            or "typeorm" in joined
            or "prisma" in joined
            or "mongoose" in joined
        ):
            frameworks.append("orm")
        if not frameworks and language == "python":
            frameworks.append("python")
        return frameworks

    def _infer_file_role(self, file_path: str) -> str:
        lowered = file_path.lower()
        if any(token in lowered for token in ["controller", "route", "router", "endpoint"]):
            return "controller"
        if "service" in lowered:
            return "service"
        if any(token in lowered for token in ["model", "schema", "entity"]):
            return "model"
        if any(token in lowered for token in ["repository", "dao"]):
            return "repository"
        if any(token in lowered for token in ["test", "spec"]):
            return "test"
        if "hook" in lowered:
            return "hook"
        return "module"

    def _extract_comments(self, content: str) -> list[str]:
        comments = re.findall(r"#(.*)", content)
        comments.extend(re.findall(r"//(.*)", content))
        comments.extend(re.findall(r"/\*\*?([\s\S]*?)\*/", content))
        return [comment.strip() for comment in comments if comment.strip()]

    def _extract_topics(self, commit_message: str) -> list[str]:
        return sorted(set(self._tokenize_text(commit_message)))

    def _expand_changed_scope(
        self,
        changed_lines: list[int],
        symbols: list[SymbolFact],
        total_lines: int,
        radius: int = 2,
    ) -> set[int]:
        scope: set[int] = set(changed_lines)
        for line in changed_lines:
            for candidate in range(max(1, line - radius), min(total_lines, line + radius) + 1):
                scope.add(candidate)
        for symbol in symbols:
            if not symbol.changed or not symbol.line:
                continue
            for candidate in range(symbol.line, min(total_lines, (symbol.end_line or symbol.line)) + 1):
                scope.add(candidate)
        return scope

    def _find_pattern_lines(self, lines: list[str], pattern: str) -> list[int]:
        compiled = re.compile(pattern)
        return [
            index
            for index, line in enumerate(lines, start=1)
            if compiled.search(line)
        ]

    def _count_lines_in_scope(self, lines: list[int], scope: set[int]) -> int:
        if not scope:
            return len(lines)
        return sum(1 for line in lines if line in scope)

    def _lines_in_scope(self, lines: list[int], scope: set[int]) -> list[int]:
        if not scope:
            return lines
        return [line for line in lines if line in scope]

    def _expand_line_scope(
        self,
        lines: list[int],
        total_lines: int,
        radius: int = 1,
    ) -> set[int]:
        scope: set[int] = set()
        for line in lines:
            for candidate in range(max(1, line - radius), min(total_lines, line + radius) + 1):
                scope.add(candidate)
        return scope

    def _find_secret_assignment_lines(self, content: str) -> list[int]:
        pattern = re.compile(
            r"(secret|token|password)\s*=\s*[\"'][^\"']+[\"']",
            re.IGNORECASE,
        )
        return [
            index
            for index, line in enumerate(content.splitlines(), start=1)
            if pattern.search(line)
        ]

    def _python_symbol_has_type_hints(self, tree: ast.AST, symbol_name: str) -> bool:
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == symbol_name:
                if node.returns is not None:
                    return True
                return any(arg.annotation is not None for arg in node.args.args)
        return False

    def _tokenize_text(self, text: str) -> list[str]:
        return [
            token
            for token in re.split(r"[^A-Za-z0-9]+", text.lower())
            if len(token) > 2
        ]

    def _tokenize_identifier(self, identifier: str) -> list[str]:
        normalized = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", identifier)
        normalized = normalized.replace("_", " ")
        return self._tokenize_text(normalized)

    def _infer_intent_from_name(self, name: str) -> list[str]:
        tokens = set(self._tokenize_identifier(name))
        intents = []
        if tokens & {"validate", "validator", "sanitize", "parse"}:
            intents.append("validate_input")
        if tokens & {"auth", "login", "token", "session", "permission"}:
            intents.append("authentication")
        if tokens & {"query", "repo", "repository", "model", "find", "save", "insert", "update", "delete"}:
            intents.append("database_query")
        if tokens & {"fetch", "request", "client", "http", "api"}:
            intents.append("api_call")
        if tokens & {"error", "exception", "retry"}:
            intents.append("error_handling")
        if tokens & {"cache"}:
            intents.append("caching")
        if tokens & {"test", "spec"}:
            intents.append("testing")
        return intents

    def _classify_name(self, name: str) -> str:
        lowered = name.lower()
        if any(token in lowered for token in ["controller", "route"]):
            return "controller"
        if "service" in lowered:
            return "service"
        if any(token in lowered for token in ["model", "schema", "entity"]):
            return "model"
        if any(token in lowered for token in ["repo", "repository"]):
            return "repository"
        return "generic"

    def _call_name(self, node: ast.AST) -> str | None:
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            root = self._call_name(node.value)
            return f"{root}.{node.attr}" if root else node.attr
        return None

    def _span_overlaps(
        self,
        start: int | None,
        end: int | None,
        changed_lines: list[int],
    ) -> bool:
        if not start or not changed_lines:
            return False
        final_end = end or start
        return any(start <= line <= final_end for line in changed_lines)

    def _detect_language(self, file_path: str) -> str:
        extension = Path(file_path).suffix.lower()
        if extension == ".py":
            return "python"
        if extension in {".ts", ".tsx"}:
            return "typescript"
        if extension in {".js", ".jsx"}:
            return "javascript"
        return "unknown"
