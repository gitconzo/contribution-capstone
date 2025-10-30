# backend/main.py
from git import Repo
import os
import lizard
from collections import defaultdict
import tempfile
import json
import argparse
import time


# ====================== FILTERS & LIMITS ======================

EXCLUDED_DIRS = {
    ".git", "node_modules", "venv", "__pycache__", "dist", "build",
    ".idea", ".vscode", ".next", "coverage", "out", "target"
}

ALLOWED_EXTS = {
    ".py", ".js", ".jsx", ".ts", ".tsx",
    ".java", ".kt", ".kts", ".c", ".cc", ".cpp", ".h", ".hpp",
    ".cs", ".go", ".rb", ".php", ".swift", ".m", ".mm",
    ".rs", ".scala", ".lua", ".sh", ".ps1"
}

SKIP_NAME_SUBSTRINGS = {"min.", ".bundle", ".generated", ".map"}

MAX_FILE_BYTES   = 1_000_000       # ~1 MB
MAX_FILE_LINES   = 4000
MAX_FILES        = 400             # limit number of files to inspect
MAX_FUNCTIONS    = 10_000          # limit number of functions analysed
TIME_BUDGET_SEC  = 75              # total time budget for analyse_functions()


# ====================== HELPER FUNCTIONS ======================

def _should_skip_path(path: str) -> bool:
    norm = path.replace("\\", "/")
    parts = set(norm.split("/"))
    if parts & EXCLUDED_DIRS:
        return True
    base = os.path.basename(norm).lower()
    if any(s in base for s in SKIP_NAME_SUBSTRINGS):
        return True
    ext = os.path.splitext(base)[1].lower()
    if ext not in ALLOWED_EXTS:
        return True
    try:
        size = os.path.getsize(path)
        if size > MAX_FILE_BYTES:
            return True
        lines = 0
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 15), b""):
                lines += chunk.count(b"\n")
                if lines > MAX_FILE_LINES:
                    return True
        return False
    except Exception:
        return True


def _gather_candidate_files(root_dir: str):
    files = []
    for root, dirs, names in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for n in names:
            p = os.path.join(root, n)
            if _should_skip_path(p):
                continue
            files.append(p)
            if len(files) >= MAX_FILES:
                return files
    return files


def _parse_blame_map(full_blame_output: str):
    authors_by_line = []
    current_author = None
    for line in full_blame_output.splitlines():
        if line.startswith("author "):
            current_author = line[7:].strip()
        elif line.startswith("\t"):
            authors_by_line.append(current_author or "Unknown")
    return authors_by_line


# ====================== MAIN ANALYSIS ======================

def analyse_functions(tempFolder):
    print("Analysing repository... please wait ... this could take a while...")
    t0 = time.monotonic()

    candidate_files = _gather_candidate_files(tempFolder)
    if not candidate_files:
        print("No candidate files after filtering.")
        return {}

    per_file_functions = {}
    all_ccn = []
    func_count = 0

    # --- Stage 1: Collect functions per file ---
    for fp in candidate_files:
        if time.monotonic() - t0 > TIME_BUDGET_SEC:
            print("Time budget reached (collect stage). Proceeding with partial data.")
            break
        try:
            res = list(lizard.analyze([fp]))
        except KeyboardInterrupt:
            raise
        except Exception:
            continue

        if not res:
            continue
        funcs = getattr(res[0], "function_list", None) or []
        if not funcs:
            continue

        per_file_functions[fp] = funcs[:]
        for f in funcs:
            cc = getattr(f, "cyclomatic_complexity", 0) or 0
            all_ccn.append(cc)
            func_count += 1
            if func_count >= MAX_FUNCTIONS:
                break
        if func_count >= MAX_FUNCTIONS:
            print(f"Function cap reached ({MAX_FUNCTIONS}).")
            break

    if not all_ccn:
        print("No functions found in repository (after filtering).")
        return {}

    hotspotThreshold = sum(all_ccn) / len(all_ccn)

    # --- Stage 2: Blame once per file ---
    repo = Repo(tempFolder)
    Authors = defaultdict(list)
    authorsFunctions = defaultdict(float)
    authorHotspots = defaultdict(float)
    totalFunctions = 0
    totalHotspots = 0

    for absPath, funcs in per_file_functions.items():
        if time.monotonic() - t0 > TIME_BUDGET_SEC:
            print("Time budget reached (blame stage). Using partial results.")
            break

        relPath = os.path.relpath(absPath, tempFolder)
        try:
            full_blame = repo.git.blame("-w", "--line-porcelain", relPath)
            authors_by_line = _parse_blame_map(full_blame)
        except KeyboardInterrupt:
            raise
        except Exception:
            continue

        n_lines = len(authors_by_line)
        for func in funcs:
            if time.monotonic() - t0 > TIME_BUDGET_SEC:
                print("Time budget reached (per-function). Finalising.")
                break

            start = getattr(func, "start_line", None)
            end   = getattr(func, "end_line", None)
            ccn   = getattr(func, "cyclomatic_complexity", 0) or 0

            if not (isinstance(start, int) and isinstance(end, int) and end >= start):
                continue
            if start < 1 or end > n_lines:
                continue

            slice_authors = authors_by_line[start-1:end]
            counts = defaultdict(int)
            for a in slice_authors:
                counts[a or "Unknown"] += 1

            total_lines = sum(counts.values())
            if total_lines == 0:
                continue

            totalFunctions += 1

            for a, nl in counts.items():
                Authors[a].append(ccn * (nl / total_lines))

            max_lines = max(counts.values())
            owners = [a for a, nl in counts.items() if nl == max_lines]
            share = 1.0 / max(1, len(owners))
            for a in owners:
                authorsFunctions[a] += share

            if ccn > hotspotThreshold:
                totalHotspots += 1
                for a in owners:
                    authorHotspots[a] += share

        else:
            continue
        break

    scores = {}
    for author, contribs in Authors.items():
        total = sum(contribs)
        count = len(contribs)
        owned = authorsFunctions.get(author, 0.0)
        avg   = total / count if count else 0.0
        funcPct = round((owned / totalFunctions) * 100, 2) if totalFunctions else 0.0
        ownedHot = authorHotspots.get(author, 0.0)
        hotPct   = round((ownedHot / totalHotspots) * 100, 2) if totalHotspots else 0.0
        scores[author] = {
            "average_complexity": round(avg, 3),
            "percentage_of_functions_written": funcPct,
            "percentage_of_hotspots": hotPct
        }

    print(f"[fast] analysed {len(per_file_functions)} files, {min(func_count, MAX_FUNCTIONS)} functions "
          f"in {round(time.monotonic() - t0, 1)}s; threshold={round(hotspotThreshold, 3)}")

    return scores


# ====================== LOC CALCULATION ======================

def calculate_LOC(tempFolder):
    print("Calculating %LOC contributed by each author...")
    repo = Repo(tempFolder)
    authorLOC = defaultdict(int)

    for root, dirs, files in os.walk(tempFolder):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for file in files:
            absPath = os.path.join(root, file)
            if _should_skip_path(absPath):
                continue

            relPath = os.path.relpath(absPath, tempFolder)
            try:
                blameOutput = repo.git.blame('--line-porcelain', relPath)
            except Exception:
                continue
            for line in blameOutput.splitlines():
                if line.startswith("author "):
                    authorName = line.replace("author ", "").strip()
                    authorLOC[authorName] += 1

    totalLOC = sum(authorLOC.values()) or 1
    authorPercentage = {author: round((loc / totalLOC) * 100, 2) for author, loc in authorLOC.items()}
    return authorPercentage


# ====================== JSON MERGING ======================

def merge_metrics(results, locPercentage):
    mergedMetrics = {}
    allAuthors = set(results.keys()) | set(locPercentage.keys())
    for author in allAuthors:
        stats = results.get(author, {
            "average_complexity": 0.0,
            "percentage_of_functions_written": 0.0,
            "percentage_of_hotspots": 0.0
        })
        output = dict(stats)
        output["percentage_of_LOC"] = locPercentage.get(author, 0.0)
        mergedMetrics[author] = output
    return mergedMetrics


def write_json(jsonPath, repoURL, results, locPercentage):
    write = {
        "repo": repoURL,
        "authors": results,
        "%LOC": locPercentage
    }
    os.makedirs(os.path.dirname(jsonPath), exist_ok=True)
    with open(jsonPath, "w", encoding="utf-8") as f:
        json.dump(write, f, indent=2)


def combine_json(outputJson, commitsJson, finalStatsJson):
    with open(outputJson, "r", encoding="utf-8") as f:
        outputData = json.load(f)
    with open(commitsJson, "r", encoding="utf-8") as f:
        commitsData = json.load(f)

    merged = defaultdict(dict)
    authors = (outputData or {}).get("authors", {})
    for author, metrics in authors.items():
        merged[author].update(metrics)

    locMap = (outputData or {}).get("%LOC", {})
    for author, loc in locMap.items():
        merged[author]["percentage_of_LOC"] = loc
    for a in list(merged.keys()):
        merged[a].setdefault("percentage_of_LOC", 0.0)

    commitJSONstat = defaultdict(lambda: {"commits": 0, "additions": 0, "deletions": 0})
    for commit in commitsData:
        author = commit.get("author") or "Unknown"
        stats = commit.get("stats") or {}
        commitJSONstat[author]["commits"] += 1
        commitJSONstat[author]["additions"] += int(stats.get("additions", 0))
        commitJSONstat[author]["deletions"] += int(stats.get("deletions", 0))

    for a, stats in commitJSONstat.items():
        merged[a].update(stats)

    totalCommits = sum(v["commits"] for v in commitJSONstat.values()) or 1
    totalEdits = sum(v["additions"] + v["deletions"] for v in commitJSONstat.values()) or 1
    for a, data in merged.items():
        commits = int(data.get("commits", 0))
        edits = int(data.get("additions", 0)) + int(data.get("deletions", 0))
        data["commit_percentage"] = round((commits / totalCommits) * 100, 2)
        data["edit_percentage"] = round((edits / totalEdits) * 100, 2)

    os.makedirs(os.path.dirname(finalStatsJson), exist_ok=True)
    with open(finalStatsJson, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2)
    print(f"Combined data written to {finalStatsJson}")


# ====================== ENTRY POINT ======================

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo-url", required=True, help="Raw GitHub repo link or owner/repo")
    args = p.parse_args()

    repoURL = args.repo_url
    currentDirectory = os.getcwd()

    with tempfile.TemporaryDirectory(dir=currentDirectory) as tempFolder:
        try:
            print("Creating temporary folder ... Cloning Repository - this could take a while ...")
            Repo.clone_from(repoURL, tempFolder)
            print(f"Repository cloned to: {tempFolder}")
            results = analyse_functions(tempFolder)
            locPercentage = calculate_LOC(tempFolder)
        except Exception as e:
            print(f"Error cloning repository: {e}")
            results, locPercentage = {}, {}

    dataDir = os.path.join(currentDirectory, "data")
    outputJson = os.path.join(dataDir, "output.json")
    write_json(outputJson, repoURL, results, locPercentage)

    print("\n Author Complexity")
    for author, stats in results.items():
        pct = locPercentage.get(author, 0.0)
        print(f"{author}: {stats}, LOC: {pct}%")

    print("\n Author %LOC")
    for author, pct in locPercentage.items():
        print(f"{author}: {pct}% LOC")

    combine_json(
        outputJson=outputJson,
        commitsJson=os.path.join(dataDir, "commits.json"),
        finalStatsJson=os.path.join(dataDir, "finalStats.json"),
    )


if __name__ == "__main__":
    main()
