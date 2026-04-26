import os
import re
import lizard
from git import Repo
from collections import defaultdict
from ignoreFiles import should_ignore, IGNORE_DIRS


def calculate_hotspots(complexity, callFrequency, maxComplexity, maxFrequency):
    normComplexity = complexity / maxComplexity if maxComplexity else 0
    normFrequency = callFrequency / maxFrequency if maxFrequency else 0
    return round(0.5 * normComplexity + 0.5 * normFrequency, 4)


def calculate_call_frequency(tempFolder, analyseRepo):
    callCounts = defaultdict(int)

    allFunctionNames = set()
    for file in analyseRepo:
        for func in file.function_list:
            if func.name:
                allFunctionNames.add(func.name)

    for root, dirs, files in os.walk(tempFolder):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for filename in files:
            absPath = os.path.join(root, filename)
            relPath = os.path.relpath(absPath, tempFolder)
            if should_ignore(relPath):
                continue
            try:
                with open(absPath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                for funcName in allFunctionNames:
                    count = len(re.findall(rf'\b{re.escape(funcName)}\s*\(', content))
                    callCounts[funcName] += count
            except Exception:
                continue

    return callCounts


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

    # Calculate call frequency for all functions
    callCounts = calculate_call_frequency(tempFolder, analyseRepo)

    # First pass — collect all function data for percentage_of_functions_written
    # and hotspot analysis
    functionData = []      # only complex functions (hotspot candidates)
    allFunctionData = []   # all functions (for ownership percentages)

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
            currentAuthor = None
            for line in blameOutput.splitlines():
                if line.startswith("author "):
                    currentAuthor = line.replace("author ", "").strip()
                elif line.startswith("\t") and currentAuthor:
                    linesInFunction[currentAuthor] += 1

            totalLines = sum(linesInFunction.values())
            if totalLines == 0:
                continue

            complexity = (func.cyclomatic_complexity / 10) + (func.token_count / 100)
            callFrequency = callCounts.get(func.name, 0)

            entry = {
                "complexity": complexity,
                "callFrequency": callFrequency,
                "funcName": func.name,
                "linesInFunction": dict(linesInFunction),
                "totalLines": totalLines,
            }

            allFunctionData.append(entry)

            # Only non-trivial functions are hotspot candidates
            if complexity >= 0.5:
                functionData.append(entry)

    if not allFunctionData:
        print("No function data collected.")
        return {}

    # Compute ownership for all functions
    for d in allFunctionData:
        linesInFunction = d["linesInFunction"]
        complexity = d["complexity"]
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

    # Compute hotspots using call frequency
    authorHotspots = defaultdict(float)
    totalHotspots = 0

    if functionData:
        maxComplexity = max(d["complexity"] for d in functionData) or 1
        maxFrequency = max(d["callFrequency"] for d in functionData) or 1

        hotspotScores = [
            calculate_hotspots(d["complexity"], d["callFrequency"], maxComplexity, maxFrequency)
            for d in functionData
        ]
        sortedScores = sorted(hotspotScores)
        hotspotThreshold = sortedScores[int(len(sortedScores) * 0.75)]

        for d, score in zip(functionData, hotspotScores):
            if score >= hotspotThreshold:
                linesInFunction = d["linesInFunction"]
                maxLines = max(linesInFunction.values())
                owners = [a for a, n in linesInFunction.items() if n == maxLines]
                share = 1.0 / len(owners)
                totalHotspots += 1
                for a in owners:
                    authorHotspots[a] += share

    scores = {}
    for author, complexityList in Authors.items():
        total = sum(complexityList)
        count = len(complexityList)
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