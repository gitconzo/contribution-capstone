import os
import json
from collections import defaultdict 

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
