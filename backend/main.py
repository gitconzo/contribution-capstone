# backend/main.py
from git import Repo
import os
import lizard
from collections import defaultdict
import tempfile
import json
import argparse

# Directories to skip 
EXCLUDED_DIRS = {
    "node_modules",
    "venv",
    "__pycache__",
    ".git",
    "dist",
    "build",
    ".idea",
    ".vscode",
    ".next",
    "coverage",
    "out",
    "target"
}
ALLOWED_EXTS = {
    ".py", ".js", ".jsx", ".ts", ".tsx",
    ".java", ".kt", ".kts", ".c", ".cc", ".cpp", ".h", ".hpp",
    ".cs", ".go", ".rb", ".php", ".swift", ".m", ".mm",
    ".rs", ".scala", ".lua", ".sh", ".ps1"
    # omit .html/.css from Lizard (no functions/ccn); still counted in LOC elsewhere
}
SKIP_NAME_SUBSTRINGS = {"min.", ".bundle", ".generated", ".map"}  # skip bundles/maps
MAX_FILE_BYTES = 1_000_000       # ~1 MB
MAX_FILE_LINES = 4000

def should_skip_path(path: str) -> bool:
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
        # quick line cap to avoid mega files
        with open(path, "rb") as f:
            # Read in chunks; early stop if > MAX_FILE_LINES
            lines = 0
            for chunk in iter(lambda: f.read(1 << 15), b""):
                lines += chunk.count(b"\n")
                if lines > MAX_FILE_LINES:
                    return True
        return False
    except Exception:
        return True  # unreadable => skip
def should_skip_path(path):
    """Check if a given path should be skipped based on excluded directories."""
    parts = set(path.replace("\\", "/").split("/"))
    return bool(parts & EXCLUDED_DIRS)


def analyse_functions(tempFolder):
    print("Analysing repository... please wait ... this could take a while...")

    # 1) Gather candidate files with filters
    candidate_files = []
    for root, dirs, files in os.walk(tempFolder):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]  # prune walk
        for name in files:
            full = os.path.join(root, name)
            if should_skip_path(full):
                continue
            candidate_files.append(full)

    # 2) First pass: per-file Lizard analysis (robust) -> collect all functions + CCNs
    #    We analyze one file at a time so a pathological file can't stall the batch.
    per_file_functions = {}  # {abs_path: [funcObjs]}
    all_ccn = []

    for fp in candidate_files:
        try:
            # lizard.analyze returns a generator; analyze this file only
            results = list(lizard.analyze([fp]))
        except KeyboardInterrupt:
            raise
        except Exception:
            continue  # ignore weird files/parsers

        if not results:
            continue
        file_res = results[0]
        if not getattr(file_res, "function_list", None):
            continue

        per_file_functions[fp] = file_res.function_list[:]
        all_ccn.extend(f.cyclomatic_complexity for f in file_res.function_list)

    if not all_ccn:
        print("No functions found in repository (after filtering).")
        return {}

    hotspotThreshold = sum(all_ccn) / len(all_ccn)

    repo = Repo(tempFolder)
    Authors = defaultdict(list)         # author -> list of weighted complexities
    authorsFunctions = defaultdict(float)  # author -> owned function shares
    authorHotspots = defaultdict(float)    # author -> owned hotspot shares
    totalFunctions = 0
    totalHotspots = 0

    # 3) Second pass: blame per function to attribute ownership + complexity
    for absPath, funcs in per_file_functions.items():
        relPath = os.path.relpath(absPath, tempFolder)
        if not os.path.exists(absPath):
            continue

        for func in funcs:
            startLine = getattr(func, "start_line", None)
            endLine = getattr(func, "end_line", None)
            ccn = getattr(func, "cyclomatic_complexity", 0) or 0

            if not (isinstance(startLine, int) and isinstance(endLine, int) and endLine >= startLine):
                continue

            try:
                blameOutput = repo.git.blame("-w", "-L", f"{startLine},{endLine}", "--line-porcelain", relPath)
            except KeyboardInterrupt:
                raise
            except Exception:
                continue

            linesInFunction = defaultdict(int)
            currentAuthor = None
            for line in blameOutput.splitlines():
                if line.startswith("author "):
                    currentAuthor = line[7:].strip()
                elif line.startswith("\t") and currentAuthor:
                    linesInFunction[currentAuthor] += 1

            totalLines = sum(linesInFunction.values())
            if totalLines == 0:
                continue

            totalFunctions += 1

            # Weighted complexity contribution by line ownership
            for author, nlines in linesInFunction.items():
                Authors[author].append(ccn * (nlines / totalLines))

            # Function "ownership" by max-line share (tie => split)
            maxLines = max(linesInFunction.values())
            owners = [a for a, n in linesInFunction.items() if n == maxLines]
            share = 1.0 / len(owners)
            for a in owners:
                authorsFunctions[a] += share

            # Hotspot ownership
            if ccn > hotspotThreshold:
                totalHotspots += 1
                for a in owners:
                    authorHotspots[a] += share

    # 4) Summarise scores
    scores = {}
    for author, contribs in Authors.items():
        total = sum(contribs)
        count = len(contribs)
        owned = authorsFunctions.get(author, 0.0)
        avg = total / count if count else 0.0
        funcPct = round((owned / totalFunctions) * 100, 2) if totalFunctions else 0.0
        ownedHot = authorHotspots.get(author, 0.0)
        hotPct = round((ownedHot / totalHotspots) * 100, 2) if totalHotspots else 0.0
        scores[author] = {
            "average_complexity": round(avg, 3),
            "percentage_of_functions_written": funcPct,
            "percentage_of_hotspots": hotPct
        }

    return scores



def calculate_LOC(tempFolder):
    print("Calculating %LOC contributed by each author...")
    repo = Repo(tempFolder)
    authorLOC = defaultdict(int)

    for root, dirs, files in os.walk(tempFolder):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for file in files:
            absPath = os.path.join(root, file)
            if should_skip_path(absPath):
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
