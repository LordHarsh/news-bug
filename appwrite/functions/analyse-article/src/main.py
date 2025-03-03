import os
from logger import Logger
from mongo import MongoSession
from article_processor import ArticleProcessor


def main(context):

    api_key = os.environ.get("GEMINI_API_KEY")
    logger = Logger(context)
    try:
        if not api_key:
            raise ValueError("Gemini API key is missing")
        mongo_client = MongoSession(context)
        articles = mongo_client.get_articles_for_analysis()
        if not articles:
            return context.res.json(
                {
                    "status": "success",
                    "message": "No articles to process",
                }
            )
        processor = ArticleProcessor(api_key)
        logger.info(f"Processing {len(articles)} articles")
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
