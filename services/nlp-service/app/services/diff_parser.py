from __future__ import annotations

import re
from pathlib import Path

from app.services.analysis_types import DiffFileSummary


class DiffParser:
    _diff_header = re.compile(r"^diff --git a/(.+?) b/(.+)$")
    _hunk_header = re.compile(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
    _minimal_hunk_header = re.compile(r"^@@")

    def parse(self, diff_content: str) -> dict[str, DiffFileSummary]:
        files: dict[str, DiffFileSummary] = {}
        current_file: DiffFileSummary | None = None
        current_new_line = 0

        for raw_line in diff_content.splitlines():
            diff_match = self._diff_header.match(raw_line)
            if diff_match:
                file_path = diff_match.group(2).strip()
                current_file = files.setdefault(
                    file_path,
                    DiffFileSummary(
                        file_path=file_path,
                        language=self._detect_language(file_path),
                    ),
                )
                current_new_line = 0
                continue

            hunk_match = self._hunk_header.match(raw_line)
            if hunk_match and current_file:
                current_file.hunk_count += 1
                current_new_line = int(hunk_match.group(2))
                continue
            if self._minimal_hunk_header.match(raw_line) and current_file:
                current_file.hunk_count += 1
                current_new_line = max(current_new_line, 1)
                continue

            if not current_file or current_new_line <= 0:
                continue

            if raw_line.startswith("+") and not raw_line.startswith("+++"):
                current_file.added_lines.add(current_new_line)
                current_new_line += 1
                continue

            if raw_line.startswith("-") and not raw_line.startswith("---"):
                current_file.removed_lines.add(current_new_line)
                continue

            if not raw_line.startswith("\\"):
                current_new_line += 1

        return files

    def _detect_language(self, file_path: str) -> str:
        extension = Path(file_path).suffix.lower()
        if extension == ".py":
            return "python"
        if extension in {".ts", ".tsx"}:
            return "typescript"
        if extension in {".js", ".jsx"}:
            return "javascript"
        return "unknown"
