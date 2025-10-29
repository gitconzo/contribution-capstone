# backend/main.py
from git import Repo
import os
import lizard
from collections import defaultdict
import tempfile
import json
import argparse

def analyse_functions(tempFolder):
    print("Analysing repository... please wait ... this could take a while...")
    analyseRepo = list(lizard.analyze([tempFolder]))
    repo = Repo(tempFolder)

    Authors = defaultdict(list)
    authorsFunctions = defaultdict(float)
    totalFunctions = 0

    totalCCN = [f.cyclomatic_complexity for file in analyseRepo for f in file.function_list]
    if not totalCCN:
        print("No functions found in repository.")
        return {}

    authorHotspots = defaultdict(float)
    totalHotspots = 0
    hotspotThreshold = sum(totalCCN) / len(totalCCN)

    for file in analyseRepo:
        relPath = os.path.relpath(file.filename, tempFolder)
        absPath = os.path.join(tempFolder, relPath)
        if not os.path.exists(absPath):
            continue

        for func in file.function_list:
            startLine = func.start_line
            endLine = func.end_line

            blameOutput = repo.git.blame('-w', '-L', f"{startLine},{endLine}", '--line-porcelain', relPath)
            linesInFunction = defaultdict(int)
            currentAuthor = None
            for line in blameOutput.splitlines():
                if line.startswith("author "):
                    currentAuthor = line.replace("author ", "").strip()
                elif line.startswith("\t") and currentAuthor:
                    linesInFunction[currentAuthor] += 1

            totalLines = sum(linesInFunction.values())
            if totalLines == 0:
                continue

            totalFunctions += 1

            for author, numOfLines in linesInFunction.items():
                authorComplexity = func.cyclomatic_complexity * (numOfLines / totalLines)
                Authors[author].append(authorComplexity)

            maxLines = max(linesInFunction.values())
            owners = [a for a, n in linesInFunction.items() if n == maxLines]
            share = 1.0 / len(owners)
            for a in owners:
                authorsFunctions[a] += share

            if func.cyclomatic_complexity > hotspotThreshold:
                totalHotspots += 1
                for a in owners:
                    authorHotspots[a] += share

    scores = {}
    for author, complexity in Authors.items():
        total = sum(complexity)
        count = len(complexity)
        owned = authorsFunctions.get(author, 0.0)
        funcPercentage = round((owned / totalFunctions) * 100, 2) if totalFunctions else 0.0
        average = total / count if count else 0.0
        ownedHotspots = authorHotspots.get(author, 0.0)
        hotspotPercentage = round((ownedHotspots / totalHotspots) * 100, 2) if totalHotspots else 0.0
        scores[author] = {
            "average_complexity": round(average, 3),
            "percentage_of_functions_written": funcPercentage,
            "percentage_of_hotspots": hotspotPercentage
        }
    return scores

def calculate_LOC(tempFolder):
    print("Calculating %LOC contributed by each author...")
    repo = Repo(tempFolder)
    authorLOC = defaultdict(int)

    for root, dirs, files in os.walk(tempFolder):
        if ".git" in dirs:
            dirs.remove(".git")
        for file in files:
            absPath = os.path.join(root, file)
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
    authorPercentage = { author: round((loc / totalLOC) * 100, 2) for author, loc in authorLOC.items() }
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
    return mergedMetrics  # <-- moved out of loop

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

    commitJSONstat = defaultdict(lambda: { "commits":0, "additions":0, "deletions":0 })
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
    p.add_argument("--repo-url", required=True, dest="repo_url", help="Raw GitHub repo link or owner/repo")
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

    # Write to data/output.json to match combine_json inputs
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

    # Merge with commits
    combine_json(
        outputJson=outputJson,
        commitsJson=os.path.join(dataDir, "commits.json"),
        finalStatsJson=os.path.join(dataDir, "finalStats.json"),
    )

if __name__ == "__main__":
    main()
