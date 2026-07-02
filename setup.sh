#!/bin/bash

echo "======================================================"
echo "🔧 Setting up Contribution Capstone environment..."
echo "======================================================"

# Exit if any command fails
set -e

# --- FRONTEND & BACKEND JS DEPENDENCIES ---
echo "📦 Installing frontend and backend npm dependencies..."
cd backend
npm install
cd ..

cd frontend
npm install
cd ..

# PYTHON DEPENDENCIES
pip install -r requirements.txt
# textstat 0.7.4 imports pkg_resources, which setuptools >=81 removed. Pin it back.
pip install "setuptools<81"

# spaCy model — install the wheel directly. The `spacy download` shortcut can
# fail to resolve the compatibility table and 404 on a malformed URL.
pip install "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl"

# NLP MODEL DOWNLOADS
python - <<'EOF'
import nltk
print("Downloading NLTK data...")
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('averaged_perceptron_tagger')
nltk.download('wordnet')
EOF

echo "Setup complete!"
echo "Start backend:  cd backend && npm run dev"
echo "Start frontend: cd frontend && npm start"