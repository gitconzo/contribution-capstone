import sys
from pathlib import Path
from parse_docx_with_metrics import parse_docx_with_metrics

def parse_sprint_report(docx_path: str):
    #Parse a Sprint Report .docx and write sprint_report_summary.json next to the .docx (same folder).
    doc_path = Path(docx_path)
    out_path = doc_path.with_name("sprint_report_summary.json")

    result = parse_docx_with_metrics(docx_path, output_json_path=out_path)

    print(f"Sprint report parsed: {doc_path.name}")
    print(f"Metrics saved to {out_path}")
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 parse_sprint_report_docx.py <report.docx>")
        sys.exit(1)

    input_file = sys.argv[1]
    parse_sprint_report(input_file)
