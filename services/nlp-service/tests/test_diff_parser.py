from app.services.diff_parser import DiffParser


parser = DiffParser()


def test_detects_the_file_and_its_language():
    files = parser.parse(
        "diff --git a/src/app.py b/src/app.py\n"
        "@@ -1,2 +1,3 @@\n"
        " import os\n"
        "+import sys\n"
    )

    assert set(files) == {"src/app.py"}
    assert files["src/app.py"].language == "python"


def test_added_line_numbers_are_relative_to_the_new_file():
    files = parser.parse(
        "diff --git a/src/app.py b/src/app.py\n"
        "@@ -1,3 +1,4 @@\n"
        " import os\n"
        "+import sys\n"
        "\n"
        " def main():\n"
    )

    assert files["src/app.py"].added_lines == {2}


def test_hunk_offset_is_honoured():
    files = parser.parse(
        "diff --git a/src/app.py b/src/app.py\n"
        "@@ -40,2 +40,3 @@\n"
        " context\n"
        "+added\n"
    )

    assert files["src/app.py"].added_lines == {41}


def test_removed_lines_do_not_advance_the_new_file_cursor():
    files = parser.parse(
        "diff --git a/src/app.py b/src/app.py\n"
        "@@ -1,3 +1,2 @@\n"
        " keep\n"
        "-gone\n"
        "+replacement\n"
    )

    summary = files["src/app.py"]
    assert summary.removed_lines == {2}
    assert summary.added_lines == {2}


def test_file_headers_are_not_mistaken_for_content():
    files = parser.parse(
        "diff --git a/src/app.py b/src/app.py\n"
        "--- a/src/app.py\n"
        "+++ b/src/app.py\n"
        "@@ -1,1 +1,2 @@\n"
        " keep\n"
        "+added\n"
    )

    assert files["src/app.py"].added_lines == {2}


def test_no_newline_marker_is_ignored():
    files = parser.parse(
        "diff --git a/src/app.py b/src/app.py\n"
        "@@ -1,1 +1,2 @@\n"
        "+added\n"
        "\\ No newline at end of file\n"
        "+second\n"
    )

    assert files["src/app.py"].added_lines == {1, 2}


def test_multiple_hunks_are_counted():
    files = parser.parse(
        "diff --git a/src/app.py b/src/app.py\n"
        "@@ -1,1 +1,2 @@\n"
        "+first\n"
        "@@ -30,1 +40,2 @@\n"
        "+second\n"
    )

    summary = files["src/app.py"]
    assert summary.hunk_count == 2
    assert summary.added_lines == {1, 40}


def test_minimal_hunk_header_starts_at_line_one():
    """The upstream snapshot builder emits a bare `@@` for whole-file content."""
    files = parser.parse(
        "diff --git a/src/app.py b/src/app.py\n"
        "@@\n"
        "+first\n"
        "+second\n"
    )

    assert files["src/app.py"].added_lines == {1, 2}


def test_multiple_files_are_tracked_independently():
    files = parser.parse(
        "diff --git a/src/app.py b/src/app.py\n"
        "@@ -1,1 +1,2 @@\n"
        "+py line\n"
        "diff --git a/web/page.tsx b/web/page.tsx\n"
        "@@ -1,1 +1,2 @@\n"
        "+tsx line\n"
    )

    assert files["src/app.py"].language == "python"
    assert files["web/page.tsx"].language == "typescript"
    assert files["web/page.tsx"].added_lines == {1}


def test_the_same_file_across_two_commits_accumulates():
    files = parser.parse(
        "diff --git a/src/app.py b/src/app.py\n"
        "@@ -1,1 +1,2 @@\n"
        "+first\n"
        "diff --git a/src/app.py b/src/app.py\n"
        "@@ -50,1 +50,2 @@\n"
        "+later\n"
    )

    summary = files["src/app.py"]
    assert summary.added_lines == {1, 50}
    assert summary.hunk_count == 2


def test_content_before_any_hunk_header_is_skipped():
    files = parser.parse(
        "diff --git a/src/app.py b/src/app.py\n"
        "similarity index 100%\n"
        "+not really a change\n"
    )

    assert files["src/app.py"].added_lines == set()


def test_empty_diff_yields_no_files():
    assert parser.parse("") == {}


def test_content_with_no_diff_header_is_ignored():
    assert parser.parse("+just some text\n@@ -1 +1 @@\n") == {}


def test_renamed_paths_are_keyed_by_the_new_path():
    files = parser.parse(
        "diff --git a/old/name.ts b/new/name.ts\n"
        "@@ -1,1 +1,2 @@\n"
        "+added\n"
    )

    assert set(files) == {"new/name.ts"}


class TestLanguageDetection:
    def test_python(self):
        assert parser._detect_language("a/b/c.py") == "python"

    def test_typescript_variants(self):
        assert parser._detect_language("x.ts") == "typescript"
        assert parser._detect_language("x.tsx") == "typescript"

    def test_javascript_variants(self):
        assert parser._detect_language("x.js") == "javascript"
        assert parser._detect_language("x.jsx") == "javascript"

    def test_is_case_insensitive(self):
        assert parser._detect_language("Component.TSX") == "typescript"

    def test_unknown_extensions(self):
        assert parser._detect_language("README.md") == "unknown"
        assert parser._detect_language("Dockerfile") == "unknown"
