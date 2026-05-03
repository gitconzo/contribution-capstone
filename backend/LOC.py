import os
from git import Repo
from collections import defaultdict
from ignoreFiles import should_ignore, IGNORE_DIRS
from datetime import datetime, timezone, timedelta


def calculate_LOC(tempFolder, start_date=None, end_date=None):
    print("Calculating %LOC contributed by each author...")
    repo = Repo(tempFolder)
    authorLOC = defaultdict(int)

    isSprint = start_date is not None or end_date is not None

    # For sprint mode, get files changed in date range
    # then run blame on those files WITHOUT date filtering
    # This counts who currently owns lines in files that were touched during the sprint
    sprintFiles = None
    if isSprint:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=timezone.utc)

        sprintFiles = set()
        seen = set()
        for ref in repo.references:
            try:
                for commit in repo.iter_commits(ref):
                    if commit.hexsha in seen:
                        continue
                    seen.add(commit.hexsha)
                    if len(commit.parents) > 1:
                        continue
                    commit_dt = datetime.fromtimestamp(commit.committed_date, tz=timezone.utc)
                    if commit_dt < start_dt or commit_dt > end_dt:
                        continue
                    for f in commit.stats.files:
                        sprintFiles.add(f.replace("\\", "/"))
            except Exception:
                continue
        print(f"Sprint LOC: {len(sprintFiles)} files changed in date range")

    for root, dirs, files in os.walk(tempFolder):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for file in files:
            absPath = os.path.join(root, file)
            relPath = os.path.relpath(absPath, tempFolder).replace("\\", "/")
            if should_ignore(relPath):
                continue

            # In sprint mode, only process files changed during the sprint
            if sprintFiles is not None and relPath not in sprintFiles:
                continue

            try:
                blameOutput = repo.git.blame('--line-porcelain', relPath)
            except Exception:
                continue

            current_author = None
            for line in blameOutput.splitlines():
                parts = line.split()
                if parts and len(parts[0]) == 40 and all(c in '0123456789abcdef' for c in parts[0]):
                    current_author = None
                elif line.startswith("author "):
                    current_author = line.replace("author ", "").strip()
                elif line.startswith("\t") and current_author:
                    authorLOC[current_author] += 1

    totalLOC = sum(authorLOC.values()) or 1
    authorPercentage = {author: round((loc / totalLOC) * 100, 2)
                        for author, loc in authorLOC.items()}
    return authorPercentage