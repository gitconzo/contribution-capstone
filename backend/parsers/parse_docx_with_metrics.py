import json
import re
import difflib
import argparse
from pathlib import Path
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
import textstat
import spacy
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk import download as nltk_download

# Ensure NLTK + spaCy models are ready
nltk_download("punkt", quiet=True)
nltk_download("punkt_tab", quiet=True)
nlp = spacy.load("en_core_web_sm")

# ---------------- Low-level helpers ----------------

def _count_words(sentence):
    # Count only tokens containing a letter/digit so punctuation isn't counted.
    return len([token for token in word_tokenize(sentence) if any(char.isalnum() for char in token)])

def _ends_like_sentence(sentence):
    # sent_tokenize (Punkt) already detected the boundary using abbreviation and
    # capitalisation cues; we only check whether the detected unit terminates
    # like a real sentence. Strip trailing quotes/brackets/spaces first.
    stripped = sentence.rstrip(" \t\n\r\"')]}>”’")
    return stripped.endswith((".", "!", "?"))

def get_text_metrics(text: str):
    """
    Compute word_count, avg_sentence_length, sentence_complexity and readability
    on prose only: word_count uses 3..60-word sentences (excluding table run-ons);
    quality metrics also require a sentence terminator.
    """
    cleaned = text.strip()
    if not cleaned:
        return {
            "word_count": 0,
            "avg_sentence_length": 0,
            "sentence_complexity": 0,
            "readability_score": 0
        }

    sentences = sent_tokenize(cleaned)

    # Volume - prose words only (excludes <3-word fragments and >60-word
    # merged-table run-ons; punctuation already excluded by _count_words).
    prose_sentences = [sentence for sentence in sentences if 3 <= _count_words(sentence) <= 60]
    word_count = sum(_count_words(sentence) for sentence in prose_sentences)

    # Quality - stricter: also require a real sentence terminator.
    quality_sentences = [sentence for sentence in prose_sentences if _ends_like_sentence(sentence)]
    quality_text = " ".join(quality_sentences)

    if quality_sentences:
        quality_word_count = sum(_count_words(sentence) for sentence in quality_sentences)
        avg_sentence_length = quality_word_count / len(quality_sentences)
        readability = textstat.flesch_reading_ease(quality_text)
        parsed = nlp(quality_text)
        subordinate_deps = {"advcl", "ccomp", "xcomp", "acl", "relcl"}
        subordinate_count = sum(1 for token in parsed if token.dep_ in subordinate_deps)
        sentence_complexity = subordinate_count / len(quality_sentences)
    else:
        avg_sentence_length = 0.0
        readability = 0.0
        sentence_complexity = 0.0

    return {
        "word_count": word_count,
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

def _heading_level(text, para):
    """
    Return the heading level (1 = top-level section, 2+ = sub-section), or
    0 if the paragraph is not a heading.

    Levels matter because a top-level section (e.g. "QUALITY PLAN") must absorb
    all of its sub-sections (2.1, 2.2 …) rather than ending at the first one.
    """
    style = para.style.name.lower() if para.style and para.style.name else ""

    # Figure/table captions are never section headings, even when styled as one.
    # e.g. "Figure 3 – Architecture Diagram of System Overview", "Table 2: ...".
    if re.match(r"^(figure|fig\.?|table|diagram)\s*\d+", text, flags=re.IGNORECASE):
        return 0

    # Explicit Word heading styles
    if "heading 1" in style or style == "title":
        return 1
    if "heading 2" in style:
        return 2
    if "heading 3" in style:
        return 3
    if "heading 4" in style or "heading 5" in style or "heading 6" in style:
        return 4
    # Auto-numbered main sections ("1. PRODUCT BACKLOG" via List Number style)
    if "list number" in style:
        return 1

    # Manually typed decimal sub-heading: "2.1 Target Quality Expectations"
    if re.match(r"^\d+\.\d+", text):
        return 2
    # Manually typed top-level: "1. Product Backlog" (single int, short, no comma)
    if re.match(r"^\d+[\.\)]\s+[A-Za-z]", text) and len(text.split()) <= 8 and "," not in text:
        return 1
    # "Epic N:" style sub-headings inside the product backlog
    if re.match(r"^epic\s+\d+", text, flags=re.IGNORECASE):
        return 2

    # Unspecified heading style --> treat as a sub-heading so it is absorbed
    if "heading" in style:
        return 2

    return 0


def _table_to_text(table):
    """Flatten a table to text: cells joined by spaces, rows by newlines."""
    row_texts = []
    for row in table.rows:
        cell_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
        if cell_texts:
            row_texts.append(" ".join(cell_texts))
    return "\n".join(row_texts)


def iter_blocks(doc):
    """
    Yield the document body's paragraphs and tables in document order.
    """
    body = doc.element.body
    for child in body.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, doc)
        elif isinstance(child, CT_Tbl):
            yield Table(child, doc)


def extract_sections(doc: Document):
    """
    Extract sections hierarchically.  Each heading's content runs until the next heading of equal-or-higher level
    Returns {normalized_title: body_text}.
    """
    # Build an ordered list of blocks with their text and heading level.
    blocks = []
    for block in iter_blocks(doc):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if not text:
                continue
            level = _heading_level(text, block)
            blocks.append({"text": text, "level": level, "is_heading": level > 0})
        else:  # Table
            text = _table_to_text(block)
            if text:
                blocks.append({"text": text, "level": 0, "is_heading": False})

    heading_indexes = [index for index, block in enumerate(blocks) if block["is_heading"]]

    sections = {}
    for position, heading_index in enumerate(heading_indexes):
        heading = blocks[heading_index]
        # Section ends at the next heading of equal-or-higher level (lower/equal
        # level number). Everything before that - deeper sub-headings, their
        # bodies, and any tables - belongs to this section.
        section_end = len(blocks)
        for next_heading_index in heading_indexes[position + 1:]:
            if blocks[next_heading_index]["level"] <= heading["level"]:
                section_end = next_heading_index
                break

        body_lines = [blocks[index]["text"]
                      for index in range(heading_index + 1, section_end)
                      if blocks[index]["text"]]
        content = "\n".join(body_lines).strip()
        title = re.sub(r"^\d+[\.\)]\s*", "", heading["text"]).strip()  # strip typed number prefix
        key = normalize_section_title(title)
        if key and content:
            sections[key] = (sections[key] + "\n" + content) if key in sections else content

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

    authorship_map    = parse_contribution_table(doc)
    extracted_sections = extract_sections(doc)
    students          = build_student_metrics(authorship_map, extracted_sections)

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
