from pathlib import Path
from docx import Document
import sys, os, json
import re
import textstat
import spacy
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk import download as nltk_download
from difflib import SequenceMatcher, get_close_matches
import argparse

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

def get_heading_level(text, para):
    """
    Determine heading level (0 = not a heading, 1 = top level, 2 = sub-heading, etc.)
    """
    text = text.strip()
    if not text:
        return 0
    
    # Check paragraph style
    style_name = para.style.name.lower() if para.style and para.style.name else ""
    if "heading 1" in style_name or style_name == "title":
        return 1
    if "heading 2" in style_name:
        return 2
    if "heading 3" in style_name:
        return 3
    if "heading" in style_name:
        return 2  # Default for other heading styles
    
    # Check for bold formatting (common for subsections)
    is_bold = para.runs and all(run.bold for run in para.runs if run.text.strip())
    
    # Markdown-style headings
    if text.startswith("###"):
        return 3
    if text.startswith("##"):
        return 2
    if text.startswith("#"):
        return 1
    
    # Major sections
    if re.match(r"^PART\s+\d+", text.upper()):
        return 1
    
    # Check for specific top-level sections
    top_level_sections = [
        "team and project plan", "acknowledgment of country", 
        "part 1", "part 2", "team code of conduct", "project overview"
    ]
    text_lower = text.lower()
    for section in top_level_sections:
        if section in text_lower:
            return 1
    
    # Specific subsection keywords under "Solution approach"
    solution_subsections = [
        "problem at hand", "proposed solution", "research", 
        "trialing", "implementation", "testing"
    ]
    
    # Check if it looks like a heading (short + keywords OR bold)
    if len(text.split()) <= 10:
        # First check if it's a subsection under "Solution approach"
        if any(sub in text_lower for sub in solution_subsections):
            return 3  # These are level 3 subsections
        
        heading_keywords = [
            "team profile", "team role", "teamwork", "roadmap", "document", 
            "management", "risk", "mitigation", "problem", "statement", 
            "scope", "stakeholder", "requirement", "approach", "solution", 
            "backlog", "quality", "plan", "overview", "purpose", "objectives"
        ]
        for keyword in heading_keywords:
            if keyword in text_lower:
                # If it's bold and short, it's likely a level 3 subsection
                if is_bold and len(text.split()) <= 5:
                    return 3
                return 2  # Sub-heading
        
        # Bold, short text is likely a subsection heading
        if is_bold and len(text.split()) <= 5:
            return 3
        
        # Title case or all caps suggests heading
        if text.isupper() or text.istitle():
            return 2
    
    return 0  # Not a heading

def extract_hierarchical_sections(doc):
    """
    Extract sections preserving hierarchy. Each section includes its own content
    AND all content from its child sections.
    """
    # First pass: identify all headings with their levels and positions
    headings = []
    for i, para in enumerate(doc.paragraphs):
        text = para.text.strip()
        if not text:
            continue
        
        level = get_heading_level(text, para)
        if level > 0:
            clean_heading = re.sub(r"^#+\s*", "", text).strip()
            headings.append({
                "title": clean_heading,
                "level": level,
                "start_index": i,
                "end_index": None  # Will be set in next step
            })
    
    # Second pass: determine where each section ends
    for i, heading in enumerate(headings):
        if i + 1 < len(headings):
            # Section ends where next heading of same or higher level starts
            next_heading = headings[i + 1]
            if next_heading["level"] <= heading["level"]:
                heading["end_index"] = next_heading["start_index"]
            else:
                # Find the next heading at same or higher level
                for j in range(i + 2, len(headings)):
                    if headings[j]["level"] <= heading["level"]:
                        heading["end_index"] = headings[j]["start_index"]
                        break
                if heading["end_index"] is None:
                    heading["end_index"] = len(doc.paragraphs)
        else:
            # Last section goes to end of document
            heading["end_index"] = len(doc.paragraphs)
    
    # Third pass: extract content for each section (including all subsections)
    sections = {}
    for heading in headings:
        content_lines = []
        for i in range(heading["start_index"] + 1, heading["end_index"]):
            para_text = doc.paragraphs[i].text.strip()
            if para_text:
                content_lines.append(para_text)
        
        content = "\n".join(content_lines).strip()
        sections[heading["title"]] = {
            "content": content,
            "level": heading["level"],
            "word_count": len(content.split()) if content else 0
        }
    
    return sections

def normalize_section_name(name):
    """Normalize section names for better matching"""
    normalized = re.sub(r"[^a-z0-9\s]+", "", name.lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized

def find_matching_section(claimed_section, all_sections, debug=True):
    """
    Find the best matching section from available sections.
    Returns the original section key if found, None otherwise.
    """
    claimed_norm = normalize_section_name(claimed_section)
    
    if debug:
        print(f"\n  Searching for: '{claimed_section}' (normalized: '{claimed_norm}')")
    
    # Create normalized mapping
    norm_to_original = {}
    for k in all_sections.keys():
        norm_key = normalize_section_name(k)
        norm_to_original[norm_key] = k
    
    # Try exact match first
    if claimed_norm in norm_to_original:
        matched = norm_to_original[claimed_norm]
        if debug:
            print(f"  ✓ Exact match: '{matched}'")
        return matched
    
    # Try substring matching (both directions)
    for norm_key, orig_key in norm_to_original.items():
        # Check if claimed is substring of available OR vice versa
        if claimed_norm in norm_key or norm_key in claimed_norm:
            # Prefer longer matches to avoid spurious short matches
            if len(claimed_norm) > 3 or len(norm_key) > 3:
                if debug:
                    print(f"  ✓ Substring match: '{orig_key}'")
                return orig_key
    
    # Try fuzzy matching with lower threshold
    matches = get_close_matches(claimed_norm, list(norm_to_original.keys()), n=1, cutoff=0.5)
    if matches:
        matched = norm_to_original[matches[0]]
        if debug:
            print(f"  ✓ Fuzzy match: '{matched}'")
        return matched
    
    if debug:
        print(f"  ✗ No match found")
    return None

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

    # Extract text sections with hierarchy awareness
    sections_data = extract_hierarchical_sections(doc)
    sections = {k: v["content"] for k, v in sections_data.items()}
    
    # Debug: print found sections
    print(f"\nFound {len(sections)} sections:")
    for section_title, data in sections_data.items():
        preview = data["content"][:100].replace('\n', ' ') if data["content"] else "(empty)"
        print(f"  [{data['level']}] '{section_title}' ({data['word_count']} words)")
        print(f"      Preview: {preview}...")
        print()

    contributions = result["tables"].get("TeamContributions", {}).get("rows", [])

    # Track which sections have been claimed
    claimed_sections_map = {}

    for row in contributions:
        name = row.get("Student Name") or row.get("Student name")
        desc = row.get("Description of contribution in team and project planning", "")
        if not name:
            continue

        # Split the description into individual section claims
        claimed_sections = [s.strip() for s in re.split(r"[\n,;/]+", desc) if s.strip()]
        
        print(f"\n{'='*60}")
        print(f"Processing: {name}")
        print(f"Claims: {claimed_sections}")
        
        matched_sections = []
        section_text_parts = []

        # Match each claimed section to actual sections
        for claimed in claimed_sections:
            matched = find_matching_section(claimed, sections, debug=True)
            if matched:
                matched_sections.append(matched)
                section_text_parts.append(sections[matched])
                
                # Track this for debugging
                if matched not in claimed_sections_map:
                    claimed_sections_map[matched] = []
                claimed_sections_map[matched].append(name)

        # Determine relevant tables based on keywords
        relevant_tables = []
        desc_lower = desc.lower()
        if "risk" in desc_lower or "mitigation" in desc_lower:
            relevant_tables.append("RiskMitigation")
        if "requirement" in desc_lower or "high-level" in desc_lower or "high level" in desc_lower:
            relevant_tables.append("HighLevelRequirements")
        if "backlog" in desc_lower:
            relevant_tables.append("ProductBacklog")

        # Collect table text
        table_texts = []
        for tbl in relevant_tables:
            if tbl in result["tables"] and result["tables"][tbl]["include_in_metrics"]:
                for r in result["tables"][tbl]["rows"]:
                    table_texts.append(" ".join(str(v) for v in r.values()))

        # Combine all text
        combined_text = "\n\n".join(section_text_parts + table_texts).strip()

        result["students"][name] = {
            "sections_written": matched_sections,
            "relevant_tables": relevant_tables,
            "raw_text": combined_text,
            "metrics": get_text_metrics(combined_text)
        }
        
        print(f"\nFinal word count for {name}: {result['students'][name]['metrics']['word_count']}")

    # Show which sections were claimed by multiple people
    print(f"\n{'='*60}")
    print("Section ownership summary:")
    for section, owners in claimed_sections_map.items():
        if len(owners) > 1:
            print(f"  ⚠️  '{section}' claimed by: {', '.join(owners)}")
        else:
            print(f"  ✓ '{section}' claimed by: {owners[0]}")

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
    
    out_path = args.output_path or str(Path(args.input_path).with_suffix('.json'))
    res = parse_project_plan_docx(args.input_path, out_path)

    if args.students_json:
        try:
            with open(args.students_json, "r", encoding="utf-8") as f:
                roster = [(s.get("name") or "").strip() for s in json.load(f) if (s.get("name") or "").strip()]
        except Exception:
            roster = None
        if roster:
            res = _filter_students_to_roster(res, roster)
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(res, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"Project Plan parsed --> {out_path}")