import nltk
import spacy

print("Downloading NLTK data...")
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('averaged_perceptron_tagger')
nltk.download('wordnet')

print("Downloading spaCy model...")
import os
os.system("python -m spacy download en_core_web_sm")

print("NLP setup complete.")