import sys
import os
import json
import difflib
from pathlib import Path
import argparse

# Import the base parser
from parse_docx_with_metrics import parse_docx_with_metrics

# For direct script execution (backward compatibility)
if len(sys.argv) >= 2 and not sys.argv[1].startswith('-'):
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(input_path)[0] + ".json"
else:
    input_path = None
    output_path = None

def _filter_to_roster(result, roster_names):
    """Filter students to only those in the roster."""
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

def parse_sprint_report(docx_path, output_json_path, students_json_path=None):
    """
    Parse sprint report docx file and save to JSON.
    
    Args:
        docx_path: Path to the .docx file
        output_json_path: Path where JSON should be saved
        students_json_path: Optional path to students roster JSON for filtering
    """
    # FIX: Call with positional argument, not keyword argument
    result = parse_docx_with_metrics(docx_path, output_json_path)
    
    # Optional roster filter
    if students_json_path:
        try:
            with open(students_json_path, "r", encoding="utf-8") as f:
                student_data = json.load(f)
                roster = [(s.get("name") or "").strip() for s in student_data if (s.get("name") or "").strip()]
        except Exception as e:
            print(f"Warning: Could not load student roster: {e}")
            roster = None
        
        if roster:
            result = _filter_to_roster(result, roster)
            # Re-save with filtered data
            with open(output_json_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"Filtered to {len(result.get('students', {}))} students from roster")
    
    print(f"Sprint report parsed: {docx_path}")
    print(f"Metrics saved to: {output_json_path}")
    
    return result

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Parse sprint report DOCX file")
    ap.add_argument("input_path", help="Path to the sprint report .docx file")
    ap.add_argument("output_path", nargs="?", help="Path for output JSON file")
    ap.add_argument("--students-json", default=None, help="Path to students roster JSON for filtering")
    
    args = ap.parse_args()
    
    # FIX: Use correct argument name
    out_path = args.output_path or str(Path(args.input_path).with_suffix('.json').with_name(
        Path(args.input_path).stem + "_summary.json"
    ))
    
    parse_sprint_report(args.input_path, out_path, args.students_json)