import os
import argparse
import tempfile
import shutil
import glob
import stat
from git import Repo
from analyser import analyse_functions
from LOC import calculate_LOC
from metricsSetup import write_json, combine_json

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

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo-url", required=True, dest="repo_url", help="Raw GitHub repo link or owner/repo")
    args = p.parse_args()
    repoURL = args.repo_url

    currentDirectory = os.getcwd()
    cleanup_old_temps(currentDirectory)
    tempFolder = tempfile.mkdtemp(dir=currentDirectory)
    try:
        print("Creating temporary folder ... Cloning Repository - this could take a while ...")
        Repo.clone_from(repoURL, tempFolder)
        print(f"Repository cloned to: {tempFolder}")
        results = analyse_functions(tempFolder)
        locPercentage = calculate_LOC(tempFolder)
    except Exception as e:
        print(f"Error cloning repository: {e}")
        results, locPercentage = {}, {}
    finally:
        force_remove(tempFolder)

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
