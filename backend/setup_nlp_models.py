"""
Run this once after installing requirements.txt to download the NLP models.

    python setup_nlp_models.py
"""
import sys
import subprocess
import nltk
import spacy

# NLTK data
print("Downloading NLTK data...")
for pkg in ["punkt", "punkt_tab", "averaged_perceptron_tagger", "wordnet"]:
    nltk.download(pkg, quiet=True)
print("  NLTK done.")

# spaCy model — derive the correct wheel URL from the installed spaCy version
# so this works regardless of which spaCy 3.x patch is installed.
print("Downloading spaCy model...")
major, minor, *_ = spacy.__version__.split(".")

# Model minor version lags spaCy by at most one patch; 3.7.x uses en_core_web_sm-3.7.1
model_version_map = {
    ("3", "7"): "3.7.1",
    ("3", "6"): "3.6.0",
    ("3", "5"): "3.5.0",
    ("3", "4"): "3.4.1",
}
model_ver = model_version_map.get((major, minor))

if model_ver:
    wheel_url = (
        f"https://github.com/explosion/spacy-models/releases/download/"
        f"en_core_web_sm-{model_ver}/"
        f"en_core_web_sm-{model_ver}-py3-none-any.whl"
    )
    subprocess.check_call([sys.executable, "-m", "pip", "install", wheel_url])
else:
    # Fallback for unmapped versions: try the standard spacy download command
    print(f"  No pinned model for spaCy {spacy.__version__}, trying spacy download...")
    subprocess.check_call([sys.executable, "-m", "spacy", "download", "en_core_web_sm"])

print("  spaCy done.")
print("\nNLP setup complete.")
