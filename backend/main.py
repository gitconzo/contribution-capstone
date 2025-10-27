from git import Repo
import os
import lizard
from collections import defaultdict
import tempfile
import json
import argparse

#Analyse average complexity, % of functions written and % of hotspots written by each author 
def analyse_functions(tempFolder):

    #analyze and assign complexity using Lizard according to each collaborator
    print("Analysing repository... please wait ... this could take a while...") 
    analyseRepo = list(lizard.analyze([tempFolder]))

    repo = Repo(tempFolder)

    Authors = defaultdict(list) #dictionary for each author
    
    authorsFunctions = defaultdict(float) #dictionary to store amount of functions per author
    totalFunctions = 0

    authorHotspots = defaultdict(float) #dictionary to store amount of hotspots per author
    totalCCN = [f.cyclomatic_complexity for file in analyseRepo for f in file.function_list] #get total complexity ratingg in each file
    if not totalCCN:
        print("No functions found in repository.")
        return {}
    totalHotspots = 0
    hotspotThreshold = sum(totalCCN)/len(totalCCN) #determine a hotspot is above complexity average

    for file in analyseRepo:
        
        relPath = os.path.relpath(file.filename, tempFolder) #relative path of temp folder to be used by blame
        absPath = os.path.join(tempFolder, relPath)
        if not os.path.exists(absPath): #check if file exists before analyzing
            continue

        for func in file.function_list:
            startLine = func.start_line
            endLine = func.end_line

            blameOutput = repo.git.blame('-w', '-L', f"{startLine},{endLine}", '--line-porcelain', relPath) 
            # '-L' limit blame to line range (start/end line)
            # '--line-poreclain' repeats author, timestamp, SHA of each line 
            
            #Get all authors that contributed towards a function
            linesInFunction = defaultdict(int) #dictionary to track of number of lines of code written by each author in function
            currentAuthor = None
            for line in blameOutput.splitlines():
                if line.startswith("author "): #remove author from 'author [name]'
                    currentAuthor = line.replace("author ", "").strip()
                elif line.startswith("\t") and currentAuthor: 
                    linesInFunction[currentAuthor] += 1 #increment +1 for author who wrote that line in the function
            
            totalLines = sum(linesInFunction.values()) #get total lines in function
            if totalLines == 0:
                continue

            totalFunctions += 1
            
            #Calculate total complexity for each author in that function 
            for author, numOfLines in linesInFunction.items():
                authorComplexity = func.cyclomatic_complexity * (numOfLines/totalLines) # function complexity * lines by author/total lines
                Authors[author].append(authorComplexity)

            maxLines = max(linesInFunction.values())
            owners = [a for a, n in linesInFunction.items() if n ==maxLines]
            share = 1.0/len(owners)
            for a in owners:
                authorsFunctions[a] += share
            
            if func.cyclomatic_complexity > hotspotThreshold: #hotspot = complexity > average
                totalHotspots += 1
                for a in owners:
                    authorHotspots[a] += share 

    #Gather metrics and print them grouped by author
    scores = {}
    for author, complexity in Authors.items():
        total = sum(complexity)
        count = len(complexity)
        owned = authorsFunctions.get(author, 0.0)
        funcPercentage = round((owned / totalFunctions) * 100, 2) if totalFunctions else 0.0
        average = total / count if count else 0
        ownedHotspots = authorHotspots.get(author, 0.0)
        hotspotPercentage = round((ownedHotspots / totalHotspots) * 100, 2) if totalHotspots else 0.0
        scores[author] = {
            "average_complexity": round(average, 3),
            "percentage_of_functions_written": funcPercentage,
            "percentage_of_hotspots": hotspotPercentage
        }
    
    return scores

#function used to calculate %LOC by each author in latest version of repo (no past data)
#may have to update to ignore installed packages 
def calculate_LOC(tempFolder):
    print("Calcualting %LOC contributed by each author...")
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
                
    totalLOC = sum(authorLOC.values())
    authorPercentage = {
        author: round((loc / totalLOC) * 100, 2)
        for author, loc in authorLOC.items()
    }

    return authorPercentage

#function used to merge LOC metric and function analysis metric
def merge_metrics(results, locPecentage):
    mergedMetrics = {}
    allAuthors = set(results.keys() | set(locPecentage.keys()))
    for author in allAuthors:
        stats = results.get(author, {
            "average_complexity": 0.0,
            "percentage_of_functions_written": 0.0,
            "percentage_of_hotspots": 0.0
        })
        output = dict(stats)
        output["percentage_of_LOC"] = locPecentage.get(author, 0.0)
        mergedMetrics[author] = output
        return mergedMetrics

#function used to write to output.json
def write_json(jsonPath, repoURL, resutls, locPercentage):
    write = {
        "repo": repoURL,
        "authors": resutls,
        "%LOC": locPercentage
    }

    with open(jsonPath, "w", encoding="utf-8") as f:
        json.dump(write, f, indent=2)

#function to combine commits.json and output.json and write to finalStats.json
def combine_json(outputJson, commitsJson, finalStatsJson):

    with open(outputJson, "r", encoding="utf-8") as f:
        outputData = json.load(f)
    with open(commitsJson, "r", encoding="utf-8") as f:
        commitsData = json.load(f)

    merged = defaultdict(dict)

    #get metrics from output.JSON
    authors = (outputData or {}).get("authors", {}) 
    for author, metrics in authors.items():
        merged[author].update(metrics)

    #Add LOC percentages 
    locMap = (outputData or {}).get("%LOC", {})
    for author, loc in locMap.items():
        merged[author]["percentage_of_LOC"] = loc

    for a in list(merged.keys()):
        merged[a].setdefault("percentage_of_LOC", 0.0)

    #assign commit.json stats to author
    commitJSONstat = defaultdict(dict)
    for commit in commitsData:
        author = commit.get("author") or "Unknown"
        stats = commit.get("stats") or {}

        if "commits" not in commitJSONstat[author]:
            commitJSONstat[author]["commits"] = 0
        if "additions" not in commitJSONstat[author]:
            commitJSONstat[author]["additions"] = 0
        if "deletions" not in commitJSONstat[author]:
            commitJSONstat[author]["deletions"] = 0

        commitJSONstat[author]["commits"] += 1
        commitJSONstat[author]["additions"] += int(stats.get("additions", 0))
        commitJSONstat[author]["deletions"] += int(stats.get("deletions", 0))

    #merge commit aggregates into merged dict
    for a, stats in commitJSONstat.items():
        merged[a].update(stats)

    #calculate percentages for commits and edits
    totalCommits = sum(var["commits"] for var in commitJSONstat.values()) or 0
    totalEdits = sum(var["additions"] + var["deletions"] for var in commitJSONstat.values()) or 0

    for a, data in merged.items():
        commits = int(data.get("commits", 0))
        edits = int(data.get("additions", 0)) + int(data.get("deletions", 0))
        data["commit_percentage"] = round((commits / totalCommits) * 100, 2) if totalCommits else 0.0
        data["edit_percentage"] = round((edits / totalEdits) * 100, 2) if totalEdits else 0.0


    with open(finalStatsJson, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2)
    print(f"Combined data written to {finalStatsJson}")

def main():
    #repoURL = "https://github.com/IsotopicIO/iso-space-game"
    p = argparse.ArgumentParser()
    p.add_argument("--repo-url", required=True, help="Raw GitHub repo link or owner/repo")
    args = p.parse_args()

    repoURL = args.repoURL
    #create temporary folder in current path to store clone repo 
    currentDirectory = os.getcwd()
    with tempfile.TemporaryDirectory(dir=currentDirectory) as tempFolder:
        #Clone repo files into temp folder - needed to analyse code
        try:
            print("Creating temporary folder ... Cloning Repository - this could take a while ...")
            Repo.clone_from(repoURL, tempFolder)
            print(f"Repository cloned to: {tempFolder}")

            results = analyse_functions(tempFolder) #function to analyse compelxity and %function written 
            locPercentage = calculate_LOC(tempFolder) #function to calculate %LOC written

        except Exception as e:
            print(f"Error cloning repository: {e}")
    
    jsonPath = os.path.join(currentDirectory, "output.json") #write to output.json    
    write_json(jsonPath, repoURL, results, locPercentage)

    #see outputs in console
    print("\n Author Complexity")
    for author, stats in results.items():
        pct = locPercentage.get(author, 0.0)
        print(f"{author}: {stats}, LOC: {pct}%")
    print("\n Author %LOC")
    for author, pct in locPercentage.items():

        print(f"{author}: {pct}% LOC")


if __name__ == "__main__":
    main()  
    combine_json(
        outputJson="data/output.json",
        commitsJson="data/commits.json", 
        finalStatsJson="data/finalStats.json"
    )      

