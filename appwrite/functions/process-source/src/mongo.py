# create and export a mongodb session
import pymongo
import os
from bson import ObjectId


class MongoSession:
    def __init__(self, context=None):
        uri = os.environ.get("MONGODB_URI")
        self.client = pymongo.MongoClient(uri)
        self.db = self.client["disease-data"]
        self.categories_collection = self.db.get_collection("categories")
        self.sources_collection = self.db.get_collection("sources")
        self.articles_collection = self.db.get_collection("articles")
        self.job_executions_collection = self.db.get_collection("job-executions")
        self.context = context

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.client.close()

    def get_job_execution(self, job_id):
        return self.job_executions_collection.find_one({"_id": ObjectId(job_id)})

    def update_job_execution(self, job_id, data):
        self.job_executions_collection.update_one(
            {"_id": ObjectId(job_id)}, {"$set": data}
        )

    def check_if_url_exists(self, url, category_id):
        return (
            self.articles_collection.find_one({"url": url, "categoryId": category_id})
            is not None
        )
