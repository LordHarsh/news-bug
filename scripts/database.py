import pymongo
import os
import datetime
import pymongo
from bson.objectid import ObjectId
from dotenv import load_dotenv

load_dotenv()

def connect_to_mongo(database_name='news_bug', collection_name='newspapers'):
    """Connects to a MongoDB database.

    Args:
        database_name (str, optional): Name of the database. Defaults to 'news_bug'.
        collection_name (str, optional): Name of the collection. Defaults to 'newspapers'.

    Returns:
        pymongo.collection.Collection: The connected MongoDB collection.
    """

    MONGO_URL = os.environ.get('MONGO_URI') or "mongodb://127.0.0.1:27017/"
    client = pymongo.MongoClient(MONGO_URL)  
    db = client[database_name]
    collection = db[collection_name]
    return collection


def insert_record(collection, newspaper_name, date):
    """Inserts a record into the MongoDB collection.

    Args:
        collection (pymongo.collection.Collection): The connected MongoDB collection.
        newspaper_name (str): The name of the newspaper.
        date (datetime): The date of the newspaper.
        
    Returns:
        str: The ID of the inserted record.
    """
    record = {}
    record['name'] = newspaper_name
    record['date'] = date
    record['upload_time'] = datetime.datetime.now()
    record['status'] = 'Processing'
    record['pages'] = []
    record['data'] = []
    _id = collection.insert_one(record).inserted_id
    return _id
def insert_web_data(collection, data):
    """Inserts a record into the MongoDB collection.

    Args:
        collection (pymongo.collection.Collection): The connected MongoDB collection.
        newspaper_name (str): The name of the newspaper.
        date (datetime): The date of the newspaper.
        
    Returns:
        str: The ID of the inserted record.
    """
    record = {}
    record['name'] = data['name']
    record['date'] = data['date']
    record['upload_time'] = datetime.datetime.now()
    # record['status'] = 'Processing'
    # record['pages'] = []
    record['data'] = data['data']
    _id = collection.insert_one(record).inserted_id
    return _id

def update_text(collection, _id, page_no, text):
    """Updates the text of a page in the MongoDB collection.
    
    Args:
        collection (pymongo.collection.Collection): The connected MongoDB collection.
        _id (str): The ID of the record.
        page_no (int): The page number.
        text (str): The text to be updated.
    
    Returns:
        None
    """
    data = {
        "page_no": page_no,
        "text": text
    }
    collection.update_one(
        {"_id": _id},
        {"$push": {"pages": data}}
    )

def update_data(collection, _id, data):
    """Updates the data of a record in the MongoDB collection.

    Args:
        collection (pymongo.collection.Collection): The connected MongoDB collection.
        _id (str): The ID of the record.
        data (list): The data to be updated.

    Returns:
        None
    """
    collection.update_one(
        {"_id": _id},
        {"$set": {"data": data, "status": "Completed"}}
    )

def update_status(collection, _id, status):
    """Updates the status of a record in the MongoDB collection.

    Args:
        collection (pymongo.collection.Collection): The connected MongoDB collection.
        _id (str): The ID of the record.
        status (str): The status to be updated.

    Returns:
        None
    """
    collection.update_one(
        {"_id": _id},
        {"$set": {"status": status}}
    )
    
def get_predictions(collection):
    """Retrieves all records from the MongoDB collection.db.newspapers.createIndex({ "data.location": "2dsphere" });


    Args:
        collection (pymongo.collection.Collection): The connected MongoDB collection.

    Returns:
        list: A list of all records in the collection.
    """
    return list(collection.find())

def get_all_names(collection):
    """Retrieves all newspaper names from the MongoDB collection.

    Args:
        collection (pymongo.collection.Collection): The connected MongoDB collection.

    Returns:
        list: A list of all newspaper names in the collection.
    """
    data = list(collection.find({}, {"pages": 0}))
    print("Here")
    def convert(element):
        return {
            "keyword": element["keyword"],
            "address": element["address"],
            "page": element["page"],
            "paragraph": element["paragraph"],
            "latitude": element["location"]["coordinates"][1],
            "longitude": element["location"]["coordinates"][0],
        }
    for item in data:
        items = []
        for element in item["data"]:
            items.append(convert(element))
        item["data"] = items
    # data = [item.data = convert(element) for item in data for element in item.data]
    return data

def get_record_by_id(collection, _id):
    """Retrieves a record from the MongoDB collection by ID.

    Args:
        collection (pymongo.collection.Collection): The connected MongoDB collection.
        _id (str): The ID of the record.

    Returns:
        dict: The record with the given ID.
    """
    return collection.find_one({"_id": ObjectId(_id)})

def get_filter_data(collection, query, projection=None):
    """Retrieves records from the MongoDB collection based on a query.

    Args:
        collection (pymongo.collection.Collection): The connected MongoDB collection.
        query (dict): The query to filter records.
        projection (dict): The projection to filter fields.

    Returns:
        list: A list of records that match the query.
    """
    data = list(collection.find(query, projection))
    return data


def get_filter_data2(collection, stage1, stage2, stage3, stage4):

    pipeline = [stage1, stage2, stage3, stage4]
    print(pipeline)
    data = collection.aggregate(pipeline)
    results = []
    for item in data:
        item['_id'] = item['_id'].__str__()
        item["keyword"] = item["data"]["keyword"]
        item["address"] = item["data"]["address"]
        item["page"] = item["data"]["page"]
        item["paragraph"] = item["data"]["paragraph"]
        item["latitude"] = item["data"]["location"]["coordinates"][1]
        item["longitude"] = item["data"]["location"]["coordinates"][0]
        del item["data"]
        item['paper_name'] = item['name']
        item['date'] = item['date'].strftime("%d-%m-%Y")
        results.append(item)
    return results

def get_filter_webdata(collection, stage1, stage2, stage3, stage4):
    pipeline = [stage1, stage2, stage3, stage4]
    print(pipeline)
    data = collection.aggregate(pipeline)
    results = []
    for item in data:
        item['_id'] = item['_id'].__str__()
        item["keyword"] = item["data"]["keyword"]
        item["address"] = item["data"]["address"]
        item["page"] = item["data"]["page"]
        item["paragraph"] = item["data"]["paragraph"]
        item["latitude"] = item["data"]["location"]["coordinates"][1]
        item["longitude"] = item["data"]["location"]["coordinates"][0]
        del item["data"]
        item['paper_name'] = item['name']
        item['date'] = item['date'].strftime("%d-%m-%Y")
        results.append(item)
    return results