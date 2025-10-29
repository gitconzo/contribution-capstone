from pathlib import Path
from docx import Document
import sys, os, json
import json
import re
import textstat
import spacy
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk import download as nltk_download
from difflib import SequenceMatcher, get_close_matches
import argparse

input_path = sys.argv[1]
output_path = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(input_path)[0] + ".json"

# Ensure models exist
nltk_download("punkt", quiet=True)
nlp = spacy.load("en_core_web_sm")

# ---------------- TEXT METRICS ----------------

def get_text_metrics(text: str):
    cleaned = text.strip()
    if not cleaned:
        return dict(word_count=0, avg_sentence_length=0, sentence_complexity=0, readability_score=0)

    sentences = sent_tokenize(cleaned)
    words = word_tokenize(cleaned)
    avg_sentence_length = (len(words) / len(sentences)) if sentences else 0.0
    readability = textstat.flesch_reading_ease(cleaned)
    doc_obj = nlp(cleaned)
    subordinate_deps = {"advcl", "ccomp", "xcomp", "acl", "relcl"}
    sub_count = sum(1 for t in doc_obj if t.dep_ in subordinate_deps)
    sentence_complexity = (sub_count / len(sentences)) if sentences else 0.0

    return {
        "word_count": len(words),
        "avg_sentence_length": round(avg_sentence_length, 2),
        "sentence_complexity": round(sentence_complexity, 3),
        "readability_score": round(readability, 2)
    }

# ---------------- PARSING HELPERS ----------------

def extract_text_sections(doc):
    """
    Extract sections even if they aren't numbered or styled as headings.
    """
    sections = {}
    current_heading = None
    buffer = []

    heading_keywords = [
        "teamwork", "document", "risk", "problem", "scope", "stakeholder",
        "requirement", "approach", "solution", "backlog", "quality", "plan", "profile", "role"
    ]

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue

        if text.startswith(("-", "•", "●", "▪")) and current_heading:
            buffer.append(text)
            continue

        is_heading = (
            len(text.split()) <= 8 and (
                re.match(r"^\d+[\.\-]?\s*[A-Z]", text) or
                text.isupper() or
                text.istitle() or
                any(k in text.lower() for k in heading_keywords)
            )
        )

        if is_heading:
            if current_heading and buffer:
                sections[current_heading] = "\n".join(buffer).strip()
                buffer = []
            current_heading = text
        else:
            buffer.append(text)

    if current_heading and buffer:
        sections[current_heading] = "\n".join(buffer).strip()

    # Merge certain subheadings
    merged_sections = {}
    skip_next = False
    section_names = list(sections.keys())

    for i, heading in enumerate(section_names):
        if skip_next:
            skip_next = False
            continue
        lower_heading = heading.lower()
        if lower_heading in ["problem at hand", "proposed solution", "research", "trialing", "implementation", "testing"]:
            prev = section_names[i - 1] if i > 0 else None
            if prev and "solution" in prev.lower():
                merged_sections[prev] = sections[prev] + "\n\n" + sections[heading]
                skip_next = True
                continue
        merged_sections[heading] = sections[heading]

    return merged_sections

def parse_table(table):
    rows = []
    headers = [c.text.strip() for c in table.rows[0].cells]
    for row in table.rows[1:]:
        values = [c.text.strip() for c in row.cells]
        if any(values):
            rows.append(dict(zip(headers, values)))
    return rows

# ---------------- MAIN PARSER ----------------

def parse_project_plan_docx(docx_path, output_json_path=None):
    doc = Document(docx_path)
    result = {
        "source_file": Path(docx_path).name,
        "tables": {},
        "students": {}
    }

    # Identify tables
    for table in doc.tables:
        header = " ".join(c.text.strip().lower() for c in table.rows[0].cells)
        if "student" in header and "contribution" in header:
            result["tables"]["TeamContributions"] = {"include_in_metrics": True, "rows": parse_table(table)}
        elif "technical skills" in header:
            result["tables"]["TeamProfile"] = {"include_in_metrics": False, "rows": parse_table(table)}
        elif "team role" in header:
            result["tables"]["TeamRole"] = {"include_in_metrics": False, "rows": parse_table(table)}
        elif "impact on project" in header or "mitigation" in header:
            result["tables"]["RiskMitigation"] = {"include_in_metrics": True, "rows": parse_table(table)}
        elif "user story" in header and "priority" in header:
            result["tables"]["ProductBacklog"] = {"include_in_metrics": True, "rows": parse_table(table)}
        elif "functional requirements" in header or "story" in header:
            result["tables"]["HighLevelRequirements"] = {"include_in_metrics": True, "rows": parse_table(table)}

    # Extract text sections
    sections = extract_text_sections(doc)

    # Normalise + fuzzy helpers
    def normalize_text(s):
        return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

    def fuzzy_match(a, b):
        return SequenceMatcher(None, a, b).ratio() > 0.6

    normalized_sections = {normalize_text(k): k for k in sections.keys()}
    contributions = result["tables"].get("TeamContributions", {}).get("rows", [])

    for row in contributions:
        name = row.get("Student Name") or row.get("Student name")
        desc = row.get("Description of contribution in team and project planning", "")
        if not name:
            continue

        desc_keywords = [normalize_text(x) for x in re.split(r"[\n,;/]+", desc) if x.strip()]
        matched_sections = []

        for kw in desc_keywords:
            for norm_title, orig_title in normalized_sections.items():
                cleaned_title = re.sub(r"^\d+[\.\-]?\s*", "", norm_title)
                if kw and (kw in cleaned_title or cleaned_title in kw or fuzzy_match(kw.lower(), cleaned_title.lower())):
                    matched_sections.append(orig_title)
                    break

        relevant_tables = []
        if any("risk" in kw or "mitigation" in kw for kw in desc_keywords):
            relevant_tables.append("RiskMitigation")
        if any("requirement" in kw for kw in desc_keywords):
            relevant_tables.append("HighLevelRequirements")
        if any("backlog" in kw for kw in desc_keywords):
            relevant_tables.append("ProductBacklog")

        section_text = "\n\n".join(sections[s] for s in matched_sections if s in sections)
        table_texts = []
        for tbl in relevant_tables:
            if tbl in result["tables"] and result["tables"][tbl]["include_in_metrics"]:
                for r in result["tables"][tbl]["rows"]:
                    table_texts.append(" ".join(r.values()))

        combined_text = (section_text + "\n\n" + "\n\n".join(table_texts)).strip()

        result["students"][name] = {
            "sections_written": matched_sections,
            "relevant_tables": relevant_tables,
            "raw_text": combined_text,
            "metrics": get_text_metrics(combined_text)
        }

    # Overall metrics
    full_text = "\n\n".join(sections.values())
    result["overall_metrics"] = get_text_metrics(full_text)

    if output_json_path:
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

    return result

# ---------------- CLI (+ roster filter) ----------------

def _filter_students_to_roster(res_obj, roster_names):
    keep = {}
    for name, details in res_obj.get("students", {}).items():
        if name in roster_names or get_close_matches(name, roster_names, n=1, cutoff=0.85):
            keep[name] = details
    res_obj["students"] = keep
    return res_obj

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("input_path")
    ap.add_argument("output_path", nargs="?")
    ap.add_argument("--students-json", default=None)
    args = ap.parse_args()
    out_path = args.output_path or str(Path(args.docx_path).with_name("sprint_report_summary.json"))
    res = parse_project_plan_docx(args.input_path, out_path)

    if args.students_json:
        try:
            with open(args.students_json, "r", encoding="utf-8") as f:
                roster = [ (s.get("name") or "").strip() for s in json.load(f) if (s.get("name") or "").strip() ]
        except Exception:
            roster = None
        if roster:
            res = _filter_students_to_roster(res, roster)
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(res, f, indent=2, ensure_ascii=False)

    print(f"Project Plan parsed --> {out_path}")
