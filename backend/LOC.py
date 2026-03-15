import os
from git import Repo
from collections import defaultdict
from ignoreFiles import should_ignore, IGNORE_DIRS

def calculate_LOC(tempFolder):
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
            for line in blameOutput.splitlines():
                if line.startswith("author "):
                    authorName = line.replace("author ", "").strip()
                    authorLOC[authorName] += 1

    totalLOC = sum(authorLOC.values()) or 1
    authorPercentage = {author: round((loc / totalLOC) * 100, 2)
                        for author, loc in authorLOC.items()}
    return authorPercentage