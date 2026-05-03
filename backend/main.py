import os
import argparse
import tempfile
import shutil
import glob
import stat
import re
import json
from git import Repo
from analyser import analyse_functions
from LOC import calculate_LOC
from metricsSetup import write_json, combine_json
from commitStats import get_commit_stats, build_commits_json

def cleanup_old_temps(directory):
    for item in glob.glob(os.path.join(directory, "tmp*")):
        if os.path.isdir(item):
            force_remove(item)
            print(f"Removed leftover temp folder: {item}")

def force_remove(directory):
    def handle_readonly(func, path, exc):
        os.chmod(path, stat.S_IWRITE)
        func(path)
    shutil.rmtree(directory, onerror=handle_readonly)

def parse_repo_url(repoURL):
    match = re.match(r'(https://github\.com/[^/]+/[^/]+)(?:/tree/(.+))?', repoURL)
    if match:
        return match.group(1), match.group(2) or None
    return repoURL, None

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo-url", required=True, dest="repo_url")
    p.add_argument("--start-date", dest="start_date", default=None)
    p.add_argument("--end-date", dest="end_date", default=None)
    p.add_argument("--output", dest="output", default=None)
    args = p.parse_args()
    repoURL = args.repo_url
 
    currentDirectory = os.getcwd()
    tempFolder = tempfile.mkdtemp()
 
    try:
        print("Creating temporary folder ... Cloning Repository - this could take a while ...")
        cleanURL, branch = parse_repo_url(repoURL)
        if branch:
            Repo.clone_from(cleanURL, tempFolder, branch=branch)
        else:
            Repo.clone_from(cleanURL, tempFolder)
        print(f"Repository cloned to: {tempFolder}")
 
        results = analyse_functions(tempFolder, start_date=args.start_date, end_date=args.end_date)
        locPercentage = calculate_LOC(tempFolder, start_date=args.start_date, end_date=args.end_date)
        commitStats = get_commit_stats(tempFolder, start_date=args.start_date, end_date=args.end_date)
 
    except Exception as e:
        print(f"Error during analysis: {e}")
        results, locPercentage, commitStats = {}, {}, {}
    finally:
        force_remove(tempFolder)
 
    dataDir = os.path.join(currentDirectory, "data")
    os.makedirs(dataDir, exist_ok=True)
 
    # Write output.json (complexity + LOC)
    outputJson = os.path.join(dataDir, "output.json")
    write_json(outputJson, repoURL, results, locPercentage)
 
    # Write commits.json from git log
    commitsJson = os.path.join(dataDir, "commits.json")
    commitsData = build_commits_json(commitStats)
    with open(commitsJson, "w", encoding="utf-8") as f:
        json.dump(commitsData, f, indent=2)
    print(f"Wrote {len(commitsData)} commit entries to {commitsJson}")
 
    print("\n Author Complexity")
    for author, s in results.items():
        pct = locPercentage.get(author, 0.0)
        print(f"{author}: {s}, LOC: {pct}%")
 
    print("\n Author %LOC")
    for author, pct in locPercentage.items():
        print(f"{author}: {pct}% LOC")
 
    print("\n Author Commits")
    by_author = {}
    for c in commitStats:
        a = c["author"]
        by_author[a] = by_author.get(a, 0) + 1
    for author, count in by_author.items():
        print(f"{author}: {count} commits")
 
    # Combine everything into finalStats.json
    finalStatsJson = args.output if args.output else os.path.join(dataDir, "finalStats.json")
    if args.output:
        os.makedirs(os.path.dirname(finalStatsJson), exist_ok=True)
    combine_json(
        outputJson=outputJson,
        commitsJson=commitsJson,
        finalStatsJson=finalStatsJson,
    )
 
 
if __name__ == "__main__":
    main()