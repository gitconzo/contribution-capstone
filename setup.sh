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
pip install -r backend/requirements.txt

# NLP MODEL DOWNLOADS
python - <<'EOF'
import nltk, os
print("Downloading NLTK data...")
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('averaged_perceptron_tagger')
nltk.download('wordnet')
print("Downloading spaCy model...")
os.system("python -m spacy download en_core_web_sm")
EOF

echo "Setup complete!"
echo "Start backend:  cd backend && npm run dev"
echo "Start frontend: cd frontend && npm start"