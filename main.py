import spacy
import re
import sys
from collections import defaultdict
import os
import pytesseract
from pdf2image import convert_from_path
from scripts.find_location import find_keyword_locations, get_coords
import pandas as pd
from fastapi import FastAPI, Request, UploadFile, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager
import uvicorn
import pickle
# from models.model import train_model, train_and_evaluate
# from utils.database import connect_to_mongo, insert_record, get_predictions
import os
import random
templates = Jinja2Templates(directory="templates")

# Load the spaCy model
nlp = spacy.load("en_core_web_trf")

app = FastAPI()

class FormData(BaseModel):
    keywords: str = Form(...)
    file: UploadFile = Form(...)
    
@app.post("/process_pdf")
async def process_pdf(data: FormData):
    # Create a folder to store the uploaded file
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
    if not os.path.exists("uploads/input"):
        os.makedirs("uploads/input")
    if not os.path.exists("uploads/images"):
        os.makedirs("uploads/images")
    if not os.path.exists("uploads/text"):
        os.makedirs("uploads/text")
    # Write the file to disk with random name
    filename = os.path.splitext(data.file.filename)[0]+str(random.randint(0, 1000))
    with open(f"uploads/{filename}", "wb") as f:
        f.write(data.file.file.read())
    convert(f"uploads/{filename}", f"uploads/images/{filename}")
    ocr(f"uploads/images/{filename}", pdfname=filename)
    data = []
    for txtfile in os.listdir(f"uploads/text/{filename}"):
      ocrtext = ""
      print(f"Reading text from: {txtfile}")
      with open(f"text/{filename}/{txtfile}", "r") as f:
          ocrtext += f.read()
      paragraphs = re.split("\n\n+", ocrtext)
      paragraphs = [p for p in paragraphs if len(p) > 30]
      locations = find_keyword_locations(ocrtext, [data.keywords])
      for keyword_location in locations:
          address, lat, lon = get_coords(keyword_location[2])
          if (keyword_location[2] is None):
              continue
          print(f"Keyword Mention: {keyword_location[0]} \nParagraph: {keyword_location[1]}\nLocation: {address}\nLatitude: {lat}\nLongitude: {lon}\n")
          data.append({
              "Keyword": keyword_location[0],
              "Paragraph": keyword_location[1].replace("\n", " "),
              "Address": address,
              "Latitude": lat,
              "Longitude": lon,
              "page": txtfile,
          })
    df = pd.DataFrame(data)
    return df

def ocr(folderpath: str, pdfname: str):
    print(f"OCR on folder: {folderpath}")
    if not os.path.exists("text/" + pdfname):
        os.makedirs("text/" + pdfname)
    else:
        return
    for filename in os.listdir(folderpath):
        if filename.endswith(".jpg"):
            print(f"Performing OCR on: {filename}")
            page_text = pytesseract.image_to_string(os.path.join(folderpath, filename))
            with open(f"uploads/text/{pdfname}/{os.path.splitext(os.path.basename(filename))[0]}.txt", "w") as f:
                f.write(page_text)


def preprocess_text(text):
    """
    Preprocesses text by lowercasing, removing punctuation, and tokenizing.
    """
    return [token.lemma_.lower().strip() for token in nlp(text) if token.text.isalnum()]


def group_paragraphs(preprocessed_paragraphs):
    """
    Groups paragraphs based on their content similarity.
    """
    grouped_paragraphs = defaultdict(list)
    
    
    for i, p1 in enumerate(preprocessed_paragraphs):
        for j, p2 in enumerate(preprocessed_paragraphs[i + 1 :], start=i + 1):
            union_len = len(set(p1).union(p2))
            if union_len != 0 and len(set(p1).intersection(p2)) / union_len > 0.05:
                grouped_paragraphs[i].append(j)

    grouped_paragraphs = {
        k: [preprocessed_paragraphs[i] for i in group]
        for k, group in grouped_paragraphs.items()
    }

    return grouped_paragraphs


def convert(filepath: str, img_destination_folder: str):
    print(filepath)
    filename = os.path.splitext(os.path.basename(filepath))[0]
    print(f"Converting pdf: {filename}")
    images = convert_from_path(filepath)

    print(f"PDF converted: {filename} done")
    for i in range(len(images)):
        images[i].save(img_destination_folder + "/page" + str(i) + ".jpg", "JPEG")
    print(f"Images saved to: {img_destination_folder}")
    # clear memory after converting
    del images


def main(folder_path: str):
    # List of all pdf in this folder
    files = [f for f in os.listdir(folder_path) if f.endswith(".pdf")]
    # Iterate over each file
    if not os.path.exists("text"):
        os.makedirs("text")
    if not os.path.exists("images"):
        os.makedirs("images")
    if not os.path.exists("data"):
        os.makedirs("data")
    
    for file in files:
        filepath = os.path.join(folder_path, file)
        # create folder text/filename if not exists
        filename = os.path.splitext(file)[0]
        img_destination_folder = "images/" + filename
        if not os.path.exists("images/" + filename):
            os.makedirs("images/" + filename)
        # Convert pdf to images
        convert(filepath, img_destination_folder)
        ocr(img_destination_folder, pdfname=filename)
        data = []
        for txtfile in os.listdir(f"text/{filename}"):
            ocrtext = ""
            print(f"Reading text from: {txtfile}")
            with open(f"text/{filename}/{txtfile}", "r") as f:
                ocrtext += f.read()
            paragraphs = re.split("\n\n+", ocrtext)
            paragraphs = [p for p in paragraphs if len(p) > 30]
            preprocessed_paragraphs = [preprocess_text(p) for p in paragraphs]
            locations = find_keyword_locations(ocrtext, ["fever", "pandemic", "cold", "covid", "virus", "influenza", "LSD"])
            for keyword_location in locations:
                address, lat, lon = get_coords(keyword_location[2])
                if (keyword_location[2] is None):
                    continue
                print(f"Keyword Mention: {keyword_location[0]} \nParagraph: {keyword_location[1]}\nLocation: {address}\nLatitude: {lat}\nLongitude: {lon}\n")
                data.append({
                    "Keyword": keyword_location[0],
                    "Paragraph": keyword_location[1].replace("\n", " "),
                    "Address": address,
                    "Latitude": lat,
                    "Longitude": lon,
                    "page": txtfile,
                })
        excel_file = os.path.join("data", f"{filename}.xlsx")
        df = pd.DataFrame(data)
        df.to_excel(excel_file, index=False)
        print(f"Data saved to {excel_file}")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print("Starting on port: {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)