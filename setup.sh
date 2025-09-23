#!/bin/bash
echo "Installing frontend and backend dependencies..."

cd backend
npm install
cd ..

cd frontend
npm install
cd ..

echo "Setup complete. Use 'npm run dev' in backend and 'npm start' in frontend."
