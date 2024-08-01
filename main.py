import spacy
import re
import sys
from collections import defaultdict
import os
import pytesseract
from pdf2image import convert_from_path
from scripts.find_location import find_keyword_locations, get_coords
import pandas as pd
from fastapi import FastAPI, Request, UploadFile, Form, File, BackgroundTasks, Body
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager
import uvicorn
import pickle
from datetime import datetime, timedelta
# from models.model import train_model, train_and_evaluate
from scripts.database import connect_to_mongo, insert_record, update_text, update_data, update_status, get_all_names, get_record_by_id, get_filter_data, get_filter_data2
import pymongo
import os
import random
from scripts.database import connect_to_mongo
import math
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
import dateutil.parser
# from bson import ISODate


# Load the spaCy model
nlp = spacy.load("en_core_web_trf")

app = FastAPI()
origins = [
    "*",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/data", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("dtest.html", {"request": request})


class FilterRequest(BaseModel):
    keywords: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = None

class DataField(BaseModel):
    keyword: str
    address: str
    latitude: float
    longitude: float
    page: str
    paragraph: str


@app.post("/filter")
async def filter_articles(filter_request: FilterRequest):
    query = {}
    date_query = {}
    location_query = {}



    
    stage1 = {
        '$match': {
            'status': 'Completed'
        }
    }
    stage2 = {
        '$project': {
            'name': 1, 
            'date': 1, 
            'status': 1, 
            'data': 1
        }
    }
    stage3 = {
        '$unwind': {
            'path': '$data'
        }
    }
    stage4 = {
        '$match': {
        }
    }
    
    if filter_request.start_date or filter_request.end_date:
        if filter_request.start_date:
            date_query["$gte"] = filter_request.start_date
        if filter_request.end_date:
            date_query["$lte"] = filter_request.end_date
        query["date"] = date_query
        stage1['$match']['date'] = date_query
        
    
    
    
    if filter_request.latitude and filter_request.longitude and filter_request.radius:
        location_query = {
                '$geoWithin': {
                    '$centerSphere': [
                        [
                            filter_request.longitude, filter_request.latitude
                        ], filter_request.radius / 6378.1
                    ]
                }
            }
        stage4['$match']['data.location'] = location_query
    
    if filter_request.keywords:
        stage4['$match']['data.keyword'] = {'$in': filter_request.keywords}
    
    
    collection = connect_to_mongo()
    results = get_filter_data2(collection=collection, stage1=stage1, stage2=stage2, stage3=stage3, stage4=stage4)
    return results
    
    
@app.post("/upload_pdf")
async def process_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...), newspaper_name: str = Form(...), date: datetime = Form(...)):
    # Create a folder to store the uploaded file
    print(f"Newspaper Name: {newspaper_name}")
    print(f"Date: {date}")
    foldername = os.path.splitext(file.filename)[0]+str(random.randint(0, 1000))
    filename = file.filename
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
    if not os.path.exists(f"uploads/{foldername}"):
        os.makedirs(f"uploads/{foldername}")
    if not os.path.exists(f"uploads/{foldername}/input"):
        os.makedirs(f"uploads/{foldername}/input")
    if not os.path.exists(f"uploads/{foldername}/images"):
        os.makedirs(f"uploads/{foldername}/images")
    if not os.path.exists(f"uploads/{foldername}/text"):
        os.makedirs(f"uploads/{foldername}/text")
    # Write the file to disk with random name pdfname=filename, 
    with open(f"uploads/{foldername}/input/{filename}", "wb") as f:
        f.write(file.file.read())
    background_tasks.add_task(process_and_save_data, foldername, filename, newspaper_name, date)
    return {"message": "Successfully Uploaded and Started Processing"}
    
@app.post("/submit_url")
async def submit_url(background_tasks: BackgroundTasks, url: str = Form(...)):
    print(f"URL: {url}")


@app.get("/data/names")
def get_all_records():
    collection = connect_to_mongo()
    records = get_all_names(collection)
    print("This ran")
    records = [{**record, '_id': str(record['_id'])} for record in records]
    return records
    
@app.get("/data/{_id}")
def get_record_data(_id: str):
    collection = connect_to_mongo()
    record = get_record_by_id(collection, _id)
    if record is None:
        return {"error": "Record not found"}
    record['id'] = record['id'].str()
    return record



def process_and_save_data(foldername: str, filename: str, newspaper_name: str, date: datetime):
    collection = connect_to_mongo()
    _id: str = insert_record(collection, newspaper_name, date)
    update_status(collection, _id, "Converting to images...")
    convert(f"uploads/{foldername}/input/{filename}", f"uploads/{foldername}/images")
    update_status(collection, _id, "Converting to text...")
    ocr(f"uploads/{foldername}/images", textfolder=f"uploads/{foldername}/text", collection=collection, _id=_id)
    update_status(collection, _id, "Processing data with NER...")
    data = []
    for txtfile in os.listdir(f"uploads/{foldername}/text"):
      ocrtext = ""
      print(f"Reading text from: {txtfile}")
      with open(f"uploads/{foldername}/text/{txtfile}", "r") as f:
          ocrtext += f.read()
      paragraphs = re.split("\n\n+", ocrtext)
      paragraphs = [p for p in paragraphs if len(p) > 30]
      locations = find_keyword_locations(ocrtext, ["virus", "influenza", "LSD"])
      for keyword_location in locations:
          address, lat, lon = get_coords(keyword_location[2])
          if (keyword_location[2] is None):
              continue
        #   print(f"Keyword Mention: {keyword_location[0]} \nParagraph: {keyword_location[1]}\nLocation: {address}\nLatitude: {lat}\nLongitude: {lon}\n")
          data.append({
              "keyword": keyword_location[0].lower(),
              "address": address.lower(),
              "location": {
                    "type": "Point",
                    "coordinates": [lon, lat]
              },
              "page": txtfile,
              "paragraph": keyword_location[1].replace("\n", " "),
          })
    update_data(collection, _id, data)
    df = pd.DataFrame(data)
    print("Completed")
    print(df)

def ocr(folderpath: str, textfolder: str, collection: pymongo.collection.Collection, _id: str):
    print(f"OCR on folder: {folderpath}")
    for filename in os.listdir(folderpath):
        if filename.endswith(".jpg"):
            print(f"Performing OCR on: {filename}")
            page_text = pytesseract.image_to_string(os.path.join(folderpath, filename))
            update_text(collection, _id, filename, page_text)
            with open(f"{textfolder}/{os.path.splitext(os.path.basename(filename))[0]}.txt", "w") as f:
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
