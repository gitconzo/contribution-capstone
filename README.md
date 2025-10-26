# Contribution Capstone Web App

## Tech Stack
- Frontend: React.js
- Backend: Node.js + Express (REST API) + Python 3.11
- NLP & Parsing: Python-docx, spaCy, NLTK, textstat
- Database: MySQL (to be added)
- Future: Python FastAPI microservices (to be added)

## Setup
1. Clone this repository.
2. Ensure Node.js **v20.19.5** is installed on your machine.  
   Download: https://nodejs.org/en/download
3. Ensure **Python 3.11** (or compatible version) is installed and accessible via terminal.
4. Run the setup script:
   ```bash
   ./setup.sh

5. Start backend
cd backend && npm run dev
6. Start frontend
cd frontend && npm start

If the automatic setup fails, in root directory:
pip install -r backend/requirements.txt

Then:
python backend/setup_nlp_models.py