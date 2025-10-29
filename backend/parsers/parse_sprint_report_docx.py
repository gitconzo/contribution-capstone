import sys, os, json
import difflib
from pathlib import Path
import argparse
from parse_docx_with_metrics import parse_docx_with_metrics

input_path = sys.argv[1]
output_path = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(input_path)[0] + ".json"

def _filter_to_roster(result, roster_names):
    keep_students = {}
    for name in result.get("students", {}):
        if name in roster_names or difflib.get_close_matches(name, roster_names, n=1, cutoff=0.85):
            keep_students[name] = result["students"][name]
    result["students"] = keep_students

    if "authorship_map" in result:
        keep_auth = {}
        for name in result["authorship_map"]:
            if name in roster_names or difflib.get_close_matches(name, roster_names, n=1, cutoff=0.85):
                keep_auth[name] = result["authorship_map"][name]
        result["authorship_map"] = keep_auth
    return result

def parse_sprint_report(docx_path, output_json_path=None, students_json_path=None):
    result = parse_docx_with_metrics(docx_path, output_json_path=output_json_path)

    # Optional roster filter
    if students_json_path:
        try:
            with open(students_json_path, "r", encoding="utf-8") as f:
                roster = [ (s.get("name") or "").strip() for s in json.load(f) if (s.get("name") or "").strip() ]
        except Exception:
            roster = None
        if roster:
            result = _filter_to_roster(result, roster)
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Sprint report parsed: {docx_path}")
    print(f"-->  Metrics saved to {output_json_path}")
    return result

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("docx_path")
    ap.add_argument("output_path", nargs="?")
    ap.add_argument("--students-json", default=None)
    args = ap.parse_args()
    out_path = args.output_path or str(Path(args.docx_path).with_name("sprint_report_summary.json"))
    parse_sprint_report(args.docx_path, out_path, args.students_json)
