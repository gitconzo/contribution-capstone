import os
from git import Repo
from ignoreFiles import should_ignore
from datetime import datetime, timezone


def parse_date(date_str):
    """Parse YYYY-MM-DD string to timezone-aware datetime."""
    if not date_str:
        return None
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return dt.replace(tzinfo=timezone.utc)


def get_commit_stats(tempFolder, start_date=None, end_date=None):
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

   # Filter by date range if provided
    if start_date or end_date:
        start_dt = parse_date(start_date)
        end_dt = parse_date(end_date)
        if end_dt:
            end_dt = end_dt.replace(hour=23, minute=59, second=59)

        all_commits = [
            c for c in all_commits
            if (not start_dt or datetime.fromtimestamp(c.committed_date, tz=timezone.utc) >= start_dt)
            and (not end_dt or datetime.fromtimestamp(c.committed_date, tz=timezone.utc) <= end_dt)
        ]
        print(f"Filtered to {len(all_commits)} commits between {start_date} and {end_date}")

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