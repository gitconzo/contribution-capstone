import os
from git import Repo
from ignoreFiles import should_ignore


def get_commit_stats(tempFolder):
    print("Reading commit stats from all branches...")
    repo = Repo(tempFolder)
    seen = set()
    commits_list = []  # store individual commits instead of aggregating

    all_commits = []
    for ref in repo.references:
        try:
            for commit in repo.iter_commits(ref):
                if commit.hexsha in seen:
                    continue
                seen.add(commit.hexsha)
                all_commits.append(commit)
        except Exception:
            continue

    print(f"Found {len(all_commits)} unique commits across all branches")

    for commit in all_commits:
        if len(commit.parents) > 1:
            continue

        author = commit.author.name
        additions = 0
        deletions = 0

        try:
            for filename, file_stats in commit.stats.files.items():
                if should_ignore(filename):
                    continue
                additions += file_stats.get("insertions", 0)
                deletions += file_stats.get("deletions", 0)
        except Exception:
            pass

        commits_list.append({
            "sha": commit.hexsha,
            "author": author,
            "stats": {"additions": additions, "deletions": deletions}
        })

    return commits_list


def build_commits_json(commitStats):
    return commitStats