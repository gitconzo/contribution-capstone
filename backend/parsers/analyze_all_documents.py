import json
import os
from pathlib import Path
from statistics import mean

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
OUTPUT_PATH = DATA_DIR / "combined_documentation_metrics.json"

def safe_add(a, b):
    return (a or 0) + (b or 0)

def merge_student_metrics(existing, new_metrics):
    """
    existing and new_metrics are dicts like:
    {
      "word_count": int,
      "avg_sentence_length": float,
      "sentence_complexity": float,
      "readability_score": float
    }

    Strategy:
    - word_count => sum
    - avg_sentence_length => weighted average by word_count
    - sentence_complexity => weighted average by word_count
    - readability_score => plain average across docs (not weighted)
    We'll store enough info to do those calcs.
    """

    if "tot_word_count" not in existing:
        # initialize accumulation buckets
        existing["tot_word_count"] = 0
        existing["weighted_sent_len_num"] = 0.0
        existing["weighted_complexity_num"] = 0.0
        existing["readability_list"] = []

    wc = new_metrics.get("word_count", 0)
    asl = new_metrics.get("avg_sentence_length", 0.0)
    comp = new_metrics.get("sentence_complexity", 0.0)
    read = new_metrics.get("readability_score", 0.0)

    existing["tot_word_count"] += wc
    existing["weighted_sent_len_num"] += asl * wc
    existing["weighted_complexity_num"] += comp * wc
    existing["readability_list"].append(read)

    return existing

def finalize_student_metrics(accum):
    # Turn accumulation buckets into final nice numbers.
    wc = accum.get("tot_word_count", 0)
    if wc > 0:
        avg_sentence_length = accum["weighted_sent_len_num"] / wc
        sentence_complexity = accum["weighted_complexity_num"] / wc
    else:
        avg_sentence_length = 0.0
        sentence_complexity = 0.0

    readability_vals = accum.get("readability_list", [])
    readability_score = mean(readability_vals) if readability_vals else 0.0

    return {
        "total_word_count": wc,
        "avg_sentence_length": round(avg_sentence_length, 2),
        "sentence_complexity": round(sentence_complexity, 3),
        "readability_score": round(readability_score, 2)
    }

def analyze_all_documents(data_dir=DATA_DIR, output_path=OUTPUT_PATH):
    """
    1. Loop every *.json in data_dir.
    2. For each file, load its "students" block.
    3. Merge per-student metrics.
    4. Emit combined_documentation_metrics.json with shape:

    {
      "students": {
        "Connor Lack": {
          "docs": {
             "SprintReport.docx": {
                "sections_written": [...],
                "word_count": ...,
                ...
             },
             "ProjectPlan.docx": { ... }
          },
          "combined": {
             "total_word_count": ...,
             "avg_sentence_length": ...,
             "sentence_complexity": ...,
             "readability_score": ...
          }
        },
        ...
      }
    }
    """

    combined = {}

    for fname in os.listdir(data_dir):
        if not fname.endswith(".json"):
            continue

        path = Path(data_dir) / fname
        with open(path, "r", encoding="utf-8") as f:
            try:
                parsed = json.load(f)
            except Exception:
                continue  # skip junk

        doc_source = parsed.get("source_file", fname)
        students_block = parsed.get("students", {})

        for student_name, details in students_block.items():
            # ensure student entry exists
            if student_name not in combined:
                combined[student_name] = {
                    "docs": {},
                    "_accum": {}
                }

            # store per-doc breakdown
            combined[student_name]["docs"][doc_source] = {
                "sections_written": details.get("sections_written", []),
                "word_count": details.get("metrics", {}).get("word_count", 0),
                "avg_sentence_length": details.get("metrics", {}).get("avg_sentence_length", 0),
                "sentence_complexity": details.get("metrics", {}).get("sentence_complexity", 0),
                "readability_score": details.get("metrics", {}).get("readability_score", 0),
                "raw_text": details.get("raw_text", "")
            }

            # merge into accum buckets
            combined[student_name]["_accum"] = merge_student_metrics(
                combined[student_name]["_accum"],
                details.get("metrics", {})
            )

    # finalize accumulators into nice "combined" stats
    for student_name, obj in combined.items():
        obj["combined"] = finalize_student_metrics(obj["_accum"])
        del obj["_accum"]

    result = { "students": combined }

    # write final combined view
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Wrote combined metrics to {output_path}")
    return result


if __name__ == "__main__":
    analyze_all_documents()
