"""
Unit tests for parsers/semgrep_parser.get_code_context — uses real temp
files (via pytest's tmp_path fixture), no external tools/services needed.
"""

from parsers.semgrep_parser import get_code_context


def _write_sample_file(tmp_path):
    content = "\n".join(f"line {i}" for i in range(1, 11))  # "line 1".."line 10"
    f = tmp_path / "sample.py"
    f.write_text(content, encoding="utf-8")
    return str(f)


def test_reads_lines_with_context_padding(tmp_path):
    filepath = _write_sample_file(tmp_path)

    result = get_code_context(filepath, start_line=5, end_line=5, context=2)

    # Expect lines 3..7 (5 - 2 through 5 + 2)
    line_numbers = [row["ln"] for row in result]
    assert line_numbers == [3, 4, 5, 6, 7]


def test_highlight_flag_marks_only_the_finding_range(tmp_path):
    filepath = _write_sample_file(tmp_path)

    result = get_code_context(filepath, start_line=5, end_line=6, context=1)

    highlighted = {row["ln"] for row in result if row["highlight"]}
    assert highlighted == {5, 6}


def test_context_is_clamped_at_file_boundaries(tmp_path):
    filepath = _write_sample_file(tmp_path)

    # start_line=1 with context=5 would go negative — should clamp to line 1.
    result = get_code_context(filepath, start_line=1, end_line=1, context=5)
    assert result[0]["ln"] == 1

    # end_line near the end with a large context should clamp at the last line.
    result = get_code_context(filepath, start_line=10, end_line=10, context=5)
    assert result[-1]["ln"] == 10


def test_missing_file_returns_empty_list_instead_of_raising():
    result = get_code_context("/nonexistent/path/does_not_exist.py", 1, 1)
    assert result == []


def test_code_content_matches_source_lines(tmp_path):
    filepath = _write_sample_file(tmp_path)

    result = get_code_context(filepath, start_line=1, end_line=1, context=0)
    assert result[0]["code"] == "line 1"
