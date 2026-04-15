import os
import lizard
from git import Repo
from collections import defaultdict
from ignoreFiles import should_ignore, IGNORE_DIRS


def calculate_hotspots(complexity, commitFrequency, maxComplexity, maxFrequency):
    normComplexity = complexity / maxComplexity if maxComplexity else 0
    normFrequency = commitFrequency / maxFrequency if maxFrequency else 0
    return round(0.5 * normComplexity + 0.5 * normFrequency, 4)


# Analysing each function in the repo 
def analyse_functions(tempFolder):
    print("Analysing repository... please wait ...")
    exclude_pattern = [f"*/{d}/*" for d in IGNORE_DIRS]
    analyseRepo = list(lizard.analyze([tempFolder], exclude_pattern=exclude_pattern))
    repo = Repo(tempFolder)

    Authors = defaultdict(list)
    authorsFunctions = defaultdict(float)
    totalFunctions = 0

    # filter out ignored dirs/files
    analyseRepo = [
        f for f in analyseRepo if not should_ignore(f.filename)
    ]

    totalCCN = [f.cyclomatic_complexity for file in analyseRepo for f in file.function_list]
    if not totalCCN:
        print("No functions found in repository.")
        return {}

    functionData = []

    for file in analyseRepo:
        relPath = os.path.relpath(file.filename, tempFolder)
        if should_ignore(relPath) or not os.path.exists(file.filename):
            continue

        for func in file.function_list:
            startLine = func.start_line
            endLine = func.end_line

            try:
                blameOutput = repo.git.blame('-w', '-L', f"{startLine},{endLine}", '--line-porcelain', relPath)
            except Exception:
                continue

            linesInFunction = defaultdict(int)
            commitHashes = set()
            currentAuthor = None
            for line in blameOutput.splitlines():
                parts = line.split()
                if parts and len(parts[0]) == 40 and all(c in '0123456789abcdef' for c in parts[0]):
                    commitHashes.add(parts[0])
                elif line.startswith("author "):
                    currentAuthor = line.replace("author ", "").strip()
                elif line.startswith("\t") and currentAuthor:
                    linesInFunction[currentAuthor] += 1

            totalLines = sum(linesInFunction.values())
            if totalLines == 0:
                continue

            commitFrequency = len(commitHashes)

            complexity = (
                (func.cyclomatic_complexity / 10) + (func.token_count / 100)
            )

            functionData.append({
                "complexity": complexity,
                "commitFrequency": commitFrequency,
                "linesInFunction": dict(linesInFunction),
                "totalLines": totalLines,
            })
            

    maxComplexity = max(d["complexity"] for d in functionData) or 1
    maxFrequency = max(d["commitFrequency"] for d in functionData) or 1

    hotspotScore = [
        calculate_hotspots(d["complexity"], d["commitFrequency"], maxComplexity, maxFrequency)
        for d in functionData
    ]
    hotspotScore.sort()
    hotspotThreshold = hotspotScore[int(len(hotspotScore) * 0.75)]

    authorHotspots = defaultdict(float)
    totalHotspots = 0

    for d in functionData:
        linesInFunction = d["linesInFunction"]
        complexity = d["complexity"]
        commitFrequency = d["commitFrequency"]
        totalLines = d["totalLines"]

        totalFunctions += 1
        for author, numOfLines in linesInFunction.items():
            authorComplexity = complexity * (numOfLines / totalLines)
            Authors[author].append(authorComplexity)

        maxLines = max(linesInFunction.values())
        owners = [a for a, n in linesInFunction.items() if n == maxLines]
        share = 1.0 / len(owners)
        for a in owners:
            authorsFunctions[a] += share

        if calculate_hotspots(complexity, commitFrequency, maxComplexity, maxFrequency) >= hotspotThreshold:
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