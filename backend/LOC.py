import os
from git import Repo
from collections import defaultdict
from ignoreFiles import should_ignore, IGNORE_DIRS
from datetime import datetime, timezone

def calculate_LOC(tempFolder, start_date=None, end_date=None):
    print("Calculating %LOC contributed by each author...")
    repo = Repo(tempFolder)
    authorLOC = defaultdict(int)

    for root, dirs, files in os.walk(tempFolder):
        # filter ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for file in files:
            absPath = os.path.join(root, file)
            relPath = os.path.relpath(absPath, tempFolder)
            if should_ignore(relPath):
                continue
            try:
                blameOutput = repo.git.blame('--line-porcelain', relPath)
            except Exception:
                continue
            
            current_author = None
            current_commit_time = None
            
            for line in blameOutput.splitlines():
                if line.startswith("author "):
                    current_author = line.replace("author ", "").strip()
                elif line.startswith("committer-time "):
                    current_commit_time = int(line.replace("committer-time ", "").strip())
                elif line.startswith("\t") and current_author:
                    if start_date or end_date:
                        commit_dt = datetime.fromtimestamp(current_commit_time or 0, tz=timezone.utc)
                        if start_date:
                            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                            if commit_dt < start_dt:
                                continue
                        if end_date:
                            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(
                                hour=23, minute=59, second=59, tzinfo=timezone.utc)
                            if commit_dt > end_dt:
                                continue
                    authorLOC[current_author] += 1

    totalLOC = sum(authorLOC.values()) or 1
    authorPercentage = {author: round((loc / totalLOC) * 100, 2)
                        for author, loc in authorLOC.items()}
    return authorPercentage