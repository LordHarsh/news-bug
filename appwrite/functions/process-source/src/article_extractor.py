from typing import Dict, Any, Optional
from newspaper import Article
import nltk
from datetime import datetime
from bson import ObjectId
from appwrite.client import Client
from .logger import Logger

nltk.data.path.append("/tmp/nltk_data")
nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)

class ArticleExtractor:
    def __init__(self, client: Client, logger: Logger):
        self.client = client
        self.logger = logger

    def extract_article(
        self, url: str, job_data: Dict[str, Any], is_source_url: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Extract article content using newspaper3k"""
        try:
            article = Article(url, language="en")
            article.download()
            article.parse()
            article.nlp()

            article_data = {
                "title": article.title,
                "sourceId": job_data["sourceId"],
                "categoryId": job_data["categoryId"],
                "url": url,
                "publishDate": (
                    article.publish_date if article.publish_date else None
                ),
                "updatedAt": datetime.utcnow(),
                "content": article.text,
                "metadata": {
                    "authors": article.authors,
                },
            }
            return article_data

        except Exception as e:
            self.logger.error(f"Failed to extract article: {str(e)}")
            return None