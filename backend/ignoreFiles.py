import os

IGNORE_DIRS = {
    ".git", "__pycache__", "venv", ".venv", "env",
    "site-packages", "node_modules", "dist", "build",
    "coverage", "vendor",
}
IGNORE_EXTENSIONS = {
    ".pyc", ".pyo", ".exe", ".dll", ".so", ".dylib",
    ".png", ".jpg", ".jpeg", ".gif", ".ico",
    ".pdf", ".docx", ".xlsx", ".zip", ".tar", ".gz",
}

def should_ignore(path: str) -> bool:
    #Return true if the path should be skipped
    parts = set(os.path.normpath(path).split(os.sep))
    if parts & IGNORE_DIRS:
        return True
    ext = os.path.splitext(path)[1].lower()
    if ext in IGNORE_EXTENSIONS:
        return True
    return False