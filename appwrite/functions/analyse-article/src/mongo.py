# create and export a mongodb session
import pymongo
from datetime import datetime
from bson import ObjectId
from .geocode import GeoProcessedArticle
from typing import List


class MongoSession:
    def __init__(self, context=None, mongo_uri=None):
        self.client = pymongo.MongoClient(mongo_uri)
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

    def get_articles_for_analysis(self):
        pipeline = [
            # Match articles with "data_extracted" status
            {"$match": {"status": "data_extracted"}},
            # Group articles by sourceId
            {
                "$group": {
                    "_id": "$sourceId",
                    "articles": {"$push": "$$ROOT"},
                    "count": {"$sum": 1},
                }
            },
            # Filter to only include groups with at least one article
            {"$match": {"count": {"$gte": 1}}},
            # Sort by count descending to get the sourceId with most articles first
            {"$sort": {"count": -1}},
            # Take just the first group
            {"$limit": 1},
            # Limit to 10 articles from this group if there are more
            {"$project": {"articles": {"$slice": ["$articles", 10]}}},
        ]

        result = self.articles_collection.aggregate(pipeline)
        result_list = list(result)
        # Return the articles array from the first group, or empty list if none found
        return result_list[0]["articles"] if result_list else []

    def get_keywords_from_category(self, category_id):
        category = self.categories_collection.find_one(
            {"_id": ObjectId(category_id)}, {"keywords": 1}
        )
        return category["keywords"]

    def check_if_url_exists(self, url, category_id):
        return (
            self.articles_collection.find_one({"url": url, "categoryId": category_id})
            is not None
        )

    def get_cron_schedule_from_sourceId(self, source_id):
        source = self.sources_collection.find_one({"_id": ObjectId(source_id)})
        return source["cronSchedule"]

    def update_articles_with_process_data(self, articles: List[GeoProcessedArticle]):
        for article in articles:
            self.context.log(f"Processing article {str(article)}")
            # Convert DiseaseAnalysis objects to dictionaries
            keywords_data = [
                {
                    "keyword": analysis.keyword,
                    "location": analysis.location,
                    "caseCount": analysis.case_count,
                    "latitude": analysis.latitude,
                    "longitude": analysis.longitude,
                }
                for analysis in article.data
            ]

            self.articles_collection.update_one(
                {"_id": ObjectId(article.article_id)},
                {
                    "$set": {
                        "keywords": keywords_data,
                        "isArticleValid": article.is_valid_article,
                        "updatedAt": datetime.utcnow(),
                        "status": "completed",
                    }
                },
                upsert=True,
            )
