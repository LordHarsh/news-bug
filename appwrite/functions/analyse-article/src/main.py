import os
from .logger import Logger
from .mongo import MongoSession
from .article_processor import ArticleProcessor, ArticleRequest
from .geocode import GeocodingService
from time import time


def main(context):
    start_time = time()
    api_key = os.environ.get("GEMINI_API_KEY")
    mongo_uri = os.environ.get("MONGODB_URI")
    mapbox_token = os.environ.get("MAPBOX_API_KEY")
    logger = Logger(context)
    try:
        if not api_key:
            raise ValueError("Gemini API key is missing")
        if not mongo_uri:
            raise ValueError("MongoDB URI is missing")
        if not mapbox_token:
            raise ValueError("Mapbox API key is missing")
        mongo_client = MongoSession(context, mongo_uri)
        articles = mongo_client.get_articles_for_analysis()
        total_articles = 0
        while articles and len(articles) > 1 and time() - start_time < 600:

            if not articles:
                return context.res.json(
                    {
                        "status": "success",
                        "message": "No articles to process",
                    }
                )
            processor = ArticleProcessor(context, logger, api_key)
            geocode_service = GeocodingService(mapbox_token)
            category_id = articles[0]["categoryId"]
            logger.info(
                f"Processing {len(articles)} articles from category {category_id}"
            )
            keywords = mongo_client.get_keywords_from_category(category_id)
            processor.set_keywords(keywords)
            article_requests = [
                ArticleRequest(
                    article_id=str(article["_id"]),
                    content=article["content"],
                )
                for article in articles
            ]
            results = processor.process_articles(article_requests)
            geo_processed_articles = geocode_service.batch_geocode(results["results"])
            mongo_client.update_articles_with_process_data(geo_processed_articles)
            logger.info(
                f"Article analysis completed successfully for {len(articles)} articles"
            )
            total_articles += len(articles)
            articles = mongo_client.get_articles_for_analysis
        logger.info(f"Processed {total_articles} articles")
    except Exception as e:
        logger.error(f"Failed to process article: {str(e)}")
        return context.res.json(
            {
                "status": "error",
                "message": "Failed to process article",
            },
        )
    return context.res.json(
        {
            "status": "success",
            "message": "Article analysis completed successfully",
        }
    )
