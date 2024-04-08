import spacy
import re
import sys
from newspaper import Article
from collections import defaultdict
import os
import cv2
import pytesseract

# Load the spaCy model
nlp = spacy.load("en_core_web_trf")

def extract_text_from_pdf(file_path):
    """
    Extracts text from a PDF file.
    """
    with open(file_path, "rb") as file:
        pdf = PdfFileReader(file)
        text = ""
        for page in range(pdf.getNumPages()):
            text += pdf.getPage(page).extractText()
    return text


def ocr(folderpath:str):
  text = ""
  if not os.path.exists('text'):
    os.makedirs('text')
  for filename in os.listdir(folderpath):
    if filename.endswith(".jpg"):
      print(f"Performing OCR on: {filename}")
      img = cv2.imread(os.path.join(folderpath, filename))
      text += "\n" + pytesseract.image_to_string(img)
      with open(f'text/{filename}.txt', 'w') as f:
        f.write(text[filename])
      
  return text
    
  return text

def preprocess_text(text):
    """
    Preprocesses text by lowercasing, removing punctuation, and tokenizing.
    """
    return [token.lemma_.lower().strip() for token in nlp(text) if token.text.isalnum()]

def group_paragraphs(paragraphs):
    """
    Groups paragraphs based on their content similarity.
    """
    preprocessed_paragraphs = [preprocess_text(p) for p in paragraphs]
    grouped_paragraphs = defaultdict(list)

    for i, p1 in enumerate(preprocessed_paragraphs):
        for j, p2 in enumerate(preprocessed_paragraphs[i + 1:], start=i + 1):
            if len(set(p1).intersection(p2)) / len(set(p1).union(p2)) > 0.5:
                grouped_paragraphs[i].append(j)

    grouped_paragraphs = {
        k: [preprocessed_paragraphs[i] for i in group]
        for k, group in grouped_paragraphs.items()
    }

    return grouped_paragraphs

def main(file_path):
    # Extract text from the PDF file
    # raw_text = extract_text_from_pdf(file_path)
    raw_text = ocr(file_path)

    # Split the text into paragraphs
    paragraphs = re.split("\n\n+", raw_text)

    # Preprocess the paragraphs
    preprocessed_paragraphs = [preprocess_text(p) for p in paragraphs]

    # Group the paragraphs
    grouped_paragraphs = group_paragraphs(preprocessed_paragraphs)

    # Print the results
    for group_index, group in enumerate(grouped_paragraphs.values()):
        print(f"Group {group_index + 1}:")
        for i, paragraph in enumerate(group, start=1):
            print(f"Paragraph {i}: {' '.join(paragraph)}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python main.py text/")
        sys.exit(1)

    file_path = sys.argv[1]
    main(file_path)