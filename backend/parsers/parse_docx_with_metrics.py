import json
import re
import difflib
import argparse
from pathlib import Path
from docx import Document
import textstat
import spacy
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk import download as nltk_download

# Ensure NLTK + spaCy models are ready
nltk_download("punkt", quiet=True)
nlp = spacy.load("en_core_web_sm")

# ---------------- Low-level helpers ----------------

def extract_all_lines(doc: Document):
    # Return all non-empty paragraphs as a list of strings, in order
    return [p.text.strip() for p in doc.paragraphs if p.text.strip()]

def join_lines(lines):
    # Utility to join an array of lines back into one block of text
    return "\n".join(lines)

def get_text_metrics(text: str):
    """
    Compute:
    - word_count
    - avg_sentence_length (words per sentence)
    - sentence_complexity (subordinate clauses per sentence)
    - readability_score (Flesch Reading Ease; higher = easier)
    """
    cleaned = text.strip()
    if not cleaned:
        return {
            "word_count": 0,
            "avg_sentence_length": 0,
            "sentence_complexity": 0,
            "readability_score": 0
        }

    # sentences / words
    sentences = sent_tokenize(cleaned)
    words = word_tokenize(cleaned)
    avg_sentence_length = (len(words) / len(sentences)) if sentences else 0.0

    # readability
    readability = textstat.flesch_reading_ease(cleaned)

    # rough complexity: subordinate/embedded clause-ish deps per sentence
    doc_obj = nlp(cleaned)
    subordinate_deps = {"advcl", "ccomp", "xcomp", "acl", "relcl"}
    subordinate_count = sum(1 for token in doc_obj if token.dep_ in subordinate_deps)
    sentence_complexity = (subordinate_count / len(sentences)) if sentences else 0.0

    return {
        "word_count": len(words),
        "avg_sentence_length": round(avg_sentence_length, 2),
        "sentence_complexity": round(sentence_complexity, 3),
        "readability_score": round(readability, 2)
    }

# ---------------- Parsing helpers ----------------

def parse_contribution_table(doc: Document):
    """
    Looks for a table with columns like:
    Student Name | Student Id | Contribution to the report
    Returns a dict: { "Name": ["Section A", "Section B", ...], ... }
    """
    authorship = {}

    for table in doc.tables:
        if len(table.rows) == 0:
            continue

        header_cells = [c.text.strip().lower() for c in table.rows[0].cells]
        header_blob = " ".join(header_cells)

        if ("student" in header_blob and "contribution" in header_blob and "report" in header_blob):
            for row in table.rows[1:]:
                cells = [c.text.strip() for c in row.cells]
                if len(cells) < 3:
                    continue
                student_name = cells[0]
                contribution_field = cells[2]
                if not student_name or not contribution_field:
                    continue
                sections = [s.strip() for s in re.split(r"[\n\r]+", contribution_field) if s.strip()]
                if sections:
                    authorship[student_name] = sections
            break

    return authorship

def normalize_section_title(title):
    # Normalize section headings for consistent key matching
    title = re.sub(r"\(.*?\)", "", title)      # remove parentheses
    title = re.sub(r"[:\-]+", " ", title)      # replace punctuation with space
    title = re.sub(r"\s+", " ", title).strip() # normalize whitespace
    return title.lower()

def extract_numbered_sections(lines):
    """
    Find sections like:
        "1. Sprint plan"
        "2. Sprint progress"
        ...
        "6. Lessons learned"
    and capture all text until the next heading.
    """
    full_text = join_lines(lines)
    heading_regex = re.compile(r"(?P<num>\d+)\.\s*(?P<title>[A-Za-z][^\n]+)", flags=re.IGNORECASE)
    sections = {}
    matches = list(heading_regex.finditer(full_text))

    for i, m in enumerate(matches):
        title_raw = m.group("title").strip()
        start_idx = m.end()
        end_idx = len(full_text)
        if i + 1 < len(matches):
            end_idx = matches[i + 1].start()
        body = full_text[start_idx:end_idx].strip()
        norm_key = normalize_section_title(title_raw)
        sections[norm_key] = body

    return sections

def fuzzy_find_section(sec, extracted_sections):
    # Find the closest section title match for a student's claimed section
    norm_sec = normalize_section_title(sec)
    all_keys = list(extracted_sections.keys())

    if norm_sec in all_keys:
        return norm_sec

    for key in all_keys:
        if norm_sec in key or key in norm_sec:
            return key

    matches = difflib.get_close_matches(norm_sec, all_keys, n=1, cutoff=0.6)
    if matches:
        return matches[0]
    return None

def build_student_metrics(authorship_map, extracted_sections):
    students = {}
    for student, claimed_sections in authorship_map.items():
        collected_texts = []
        for sec in claimed_sections:
            matched_key = fuzzy_find_section(sec, extracted_sections)
            if matched_key:
                collected_texts.append(extracted_sections[matched_key])

        full_text = "\n\n".join(collected_texts).strip()
        students[student] = {
            "sections_written": claimed_sections,
            "raw_text": full_text,
            "metrics": get_text_metrics(full_text)
        }
    return students

# ---------------- Public API ----------------

def parse_docx_with_metrics(docx_path, output_json_path=None):
    """Main parser entry point (importable)"""
    doc = Document(docx_path)
    lines = extract_all_lines(doc)

    authorship_map = parse_contribution_table(doc)
    extracted_sections = extract_numbered_sections(lines)
    students = build_student_metrics(authorship_map, extracted_sections)

    result = {
        "source_file": Path(docx_path).name,
        "authorship_map": authorship_map,
        "sections": extracted_sections,
        "students": students
    }

    if output_json_path:
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

    return result

# ---------------- CLI wrapper (adds --students-json roster filter) ----------------

def _filter_to_roster(result, roster_names):
    """Keep only students present in roster (exact or fuzzy)."""
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

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("docx_path")
    parser.add_argument("--output", default=None)
    parser.add_argument("--students-json", default=None)
    args = parser.parse_args()

    result = parse_docx_with_metrics(args.docx_path, args.output)

    if args.students_json:
        try:
            with open(args.students_json, "r", encoding="utf-8") as f:
                roster = [ (s.get("name") or "").strip() for s in json.load(f) if (s.get("name") or "").strip() ]
        except Exception:
            roster = None
        if roster:
            result = _filter_to_roster(result, roster)
            if args.output:
                with open(args.output, "w", encoding="utf-8") as f:
                    json.dump(result, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
