import pymongo
import os
import datetime
import pymongo
from bson.objectid import ObjectId

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
        {"$set": {"data": data, "status": "Converting to images..."}}
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
    """Retrieves all records from the MongoDB collection.

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
    return list(collection.find({}, {"name": 1, "_id": 1, "date": 1}))

def get_record_by_id(collection, _id):
    """Retrieves a record from the MongoDB collection by ID.

    Args:
        collection (pymongo.collection.Collection): The connected MongoDB collection.
        _id (str): The ID of the record.

    Returns:
        dict: The record with the given ID.
    """
    return collection.find_one({"_id": ObjectId(_id)})
