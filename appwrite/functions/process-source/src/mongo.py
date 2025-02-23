# create and export a mongodb session
import pymongo
import os
from bson import ObjectId
from .article_processor import ArticleResponse
from typing import List


class MongoSession:
    def __init__(self, context=None):
        uri = os.environ.get("MONGODB_URI")
        if not uri:
            raise ValueError("MONGODB_URI environment variable is not set")
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

    def get_cron_schedule_from_sourceId(self, source_id):
        source = self.sources_collection.find_one({"_id": ObjectId(source_id)})
        return source["cronSchedule"]

    def update_articles_with_process_data(self, articles: List[ArticleResponse]):
        for article in articles:
            self.context.log(f"Processing article {str(article)}")
            # Convert DiseaseAnalysis objects to dictionaries
            keywords_data = [
                {
                    "keyword": analysis.keyword,
                    "location": analysis.location,
                    "case_count": analysis.case_count,
                }
                for analysis in article.data
            ]

            self.articles_collection.update_one(
                {"_id": ObjectId(article.article_id)},
                {
                    "$set": {
                        "keywords": keywords_data,  # Now using the dictionary version
                        "is_article_valid": article.is_valid_article,
                    }
                },
                upsert=True,
            )
