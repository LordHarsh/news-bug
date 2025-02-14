import json
import time
from datetime import datetime
from typing import Dict, Any, Set, List, Tuple, Optional
from newspaper import Article
import nltk
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from bson import ObjectId
from .mongo import MongoSession
from appwrite.client import Client
from appwrite.services.functions import Functions
import croniter
import os

nltk.data.path.append("/tmp/nltk_data")
nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)


class CrawlerSession:
    def __init__(self, mongo_client, context):
        self.db: MongoSession = mongo_client
        self.context = context
        self.appwrite_client = Client()
        self.appwrite_client.set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
        self.appwrite_client.set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        self.appwrite_client.set_key(context.req.headers["x-appwrite-key"])
        self.functions = Functions(self.appwrite_client)

    def trigger_function(self, job_id: str) -> bool:
        """Triggers the Appwrite function for processing"""
        try:
            function_id = os.environ.get("APPWRITE_FUNCTION_ID")
            if not function_id:
                raise ValueError("APPWRITE_FUNCTION_ID environment variable is not set")
            self.functions.create_execution(
                function_id,
                body=json.dumps({"jobId": job_id}),
                xasync=True,
            )
            self.context.log("Function triggered successfully")
            return True
        except Exception as e:
            self.context.error(f"Failed to trigger function: {str(e)}")
            return False

    def is_article_exists(self, url: str, category_id: str) -> bool:
        """Check if article with same URL and categoryId exists"""
        return (
            self.db.articles_collection.find_one(
                {"url": url, "categoryId": category_id}
            )
            is not None
        )

    def log(self, message: str, level: str = "INFO") -> None:
        """Unified logging method"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "message": message,
        }
        self.context.log(json.dumps(log_entry))

    def update_job_status(self, job_id: str, updates: Dict[str, Any]) -> None:
        """Update job status in MongoDB"""
        try:
            self.db.job_executions_collection.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {**updates, "updatedAt": datetime.utcnow().isoformat()}},
            )
        except Exception as e:
            self.log(f"Failed to update job status: {str(e)}", "ERROR")
            raise

    def update_source_status(self, source_id: str, updates: Dict[str, Any]) -> None:
        """Update source status in MongoDB"""
        try:
            self.db.sources_collection.update_one(
                {"_id": ObjectId(source_id)},
                {"$set": {**updates, "updatedAt": datetime.utcnow().isoformat()}},
            )
        except Exception as e:
            self.log(f"Failed to update source status: {str(e)}", "ERROR")

    def extract_article(
        self, url: str, job_data: Dict[str, Any], is_source_url: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Extract article content using newspaper3k"""
        try:
            # Check for existing article unless it's the source URL
            if not is_source_url and self.is_article_exists(
                url, job_data["categoryId"]
            ):
                self.log(f"Article already exists: {url}")
                return None

            # [Rest of the article extraction logic remains the same...]
            article = Article(url, language="en")
            article.download()
            article.parse()
            article.nlp()

            matched_keywords = [
                keyword
                for keyword in job_data["categoryKeywords"]
                if keyword.lower() in article.text.lower()
            ]
            self.log(f"Extracted article url: {url}")
            article_data = {
                "_id": ObjectId(),
                "title": article.title,
                "sourceId": job_data["sourceId"],
                "categoryId": job_data["categoryId"],
                "url": url,
                "publishDate": (
                    article.publish_date.isoformat() if article.publish_date else None
                ),
                "createdAt": datetime.utcnow().isoformat(),
                "content": article.text,
                "keywords": article.keywords,
                "summary": article.summary,
                "metadata": {
                    "authors": article.authors,
                    "topImage": article.top_image,
                    "images": list(article.images),
                    "categoryKeywords": job_data["categoryKeywords"],
                    "matchedKeywords": matched_keywords,
                },
            }

            self.db.articles_collection.insert_one(article_data)
            return article_data

        except Exception as e:
            self.log(f"Article extraction failed for {url}: {str(e)}", "ERROR")
            return None

    def get_domain_links(self, url: str, domain: str) -> Set[str]:
        """Extract links from page that match the domain"""
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            links = set()
            for a_tag in soup.find_all("a", href=True):
                link = urljoin(url, a_tag["href"])
                if domain in link:
                    links.add(link)

            return links
        except Exception as e:
            self.log(f"Link extraction failed for {url}: {str(e)}", "ERROR")
            return set()

    def initialize_metadata(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize metadata structure for new job"""
        return {
            "crawl_progress": {
                "visited": [],
                "to_visit": [(job_data["sourceUrl"], 0)],
                "total_processed": 0,
                "is_completed": False,
            },
            "articleIds": [],
            "last_execution_duration": 0,
            "total_executions": 1,
        }

    def process_with_timeout(
        self,
        job_id: str,
        max_depth: int = 2,
        max_pages: int = 20,
        time_limit: int = 600,
    ) -> Dict[str, Any]:
        """Main processing function with timeout handling"""
        start_time = datetime.utcnow()

        # Get job details
        job_data = self.db.job_executions_collection.find_one({"_id": ObjectId(job_id)})
        if not job_data:
            raise ValueError(f"Job not found: {job_id}")

        # Initialize or load metadata
        if job_data.get("metadata") is None:
            metadata = self.initialize_metadata(job_data)
            self.update_job_status(job_id, {"metadata": metadata})
        else:
            metadata = job_data["metadata"]

        # Load progress from metadata
        progress = metadata["crawl_progress"]
        visited = set(progress.get("visited", []))
        to_visit = progress.get("to_visit", [(job_data["sourceUrl"], 0)])
        processed_urls = []
        unique_processed_count = 0  # Counter for new articles only

        domain = urlparse(job_data["sourceUrl"]).netloc

        try:
            while to_visit and unique_processed_count < max_pages:
                if (datetime.utcnow() - start_time).total_seconds() > time_limit:
                    self.log("Time limit reached, saving progress")
                    break

                current_url, depth = to_visit.pop(0)
                is_source_url = current_url == job_data["sourceUrl"]

                if current_url not in visited:
                    visited.add(current_url)

                    # Process article
                    article_data = self.extract_article(
                        current_url, job_data, is_source_url=is_source_url
                    )

                    if article_data:
                        processed_urls.append(str(article_data["_id"]))
                        if not is_source_url:
                            unique_processed_count += 1

                        # Get more links if within depth limit
                        if depth < max_depth:
                            new_links = self.get_domain_links(current_url, domain)
                            for link in new_links - visited:
                                to_visit.append((link, depth + 1))

            # Update progress data
            execution_progress = {
                "visited": list(visited),
                "to_visit": to_visit,
                "total_processed": metadata["crawl_progress"]["total_processed"]
                + len(processed_urls),
                "is_completed": len(to_visit) == 0
                or unique_processed_count >= max_pages,
            }

            # [Rest of the code remains the same...]
            new_metadata = {
                "crawl_progress": execution_progress,
                "articleIds": metadata.get("articleIds", []) + processed_urls,
                "last_execution_duration": (
                    datetime.utcnow() - start_time
                ).total_seconds(),
                "total_executions": metadata.get("total_executions", 0) + 1,
            }

            status_update = {
                "status": (
                    "completed" if execution_progress["is_completed"] else "in_progress"
                ),
                "metadata": new_metadata,
            }

            if execution_progress["is_completed"]:
                status_update.update(
                    {
                        "completedAt": datetime.utcnow().isoformat(),
                        "duration": (datetime.utcnow() - start_time).total_seconds(),
                    }
                )
                base = datetime.now()
                cron_schedule = self.db.get_cron_schedule_from_sourceId(
                    job_data.get("sourceId", None)
                )
                cron = croniter(cron_schedule, base)
                next_run_at = cron.get_next(datetime)
                self.update_source_status(
                    job_data.get("sourceId"),
                    {
                        "nextRunAt": next_run_at.isoformat() if next_run_at else None,
                        "updatedAt": datetime.utcnow().isoformat(),
                    },
                )
            else:
                self.trigger_function(job_id)

            self.update_job_status(job_id, status_update)

            return {
                "success": True,
                "message": f"Processed {len(processed_urls)} articles"
                + (
                    " (completed)"
                    if execution_progress["is_completed"]
                    else " (in progress)"
                ),
                "articleCount": len(processed_urls),
                "articleIds": processed_urls,
                "needsNextExecution": not execution_progress["is_completed"],
            }

        except Exception as e:
            self.log(f"Processing failed: {str(e)}", "ERROR")
            self.update_job_status(
                job_id,
                {
                    "status": "error",
                    "error": str(e),
                    "completedAt": datetime.utcnow().isoformat(),
                    "duration": (datetime.utcnow() - start_time).total_seconds(),
                },
            )
            raise


def main(context):
    """Main entry point for the function"""
    try:
        start_time = time.time()
        request_data = json.loads(context.req.body)
        job_id = request_data.get("jobId")

        if not job_id:
            raise ValueError("Job ID is required")

        # Initialize crawler session
        mongo_client = MongoSession(context)
        crawler = CrawlerSession(mongo_client, context)

        # Process the job
        result = crawler.process_with_timeout(
            job_id=job_id,
            max_depth=request_data.get("maxDepth", 2),
            max_pages=request_data.get("maxPages", 20),
            time_limit=request_data.get("timeLimit", 30),
        )

        context.log(f"Execution time: {time.time() - start_time} seconds")
        return context.res.json(result)

    except Exception as e:
        context.error(f"Error occurred: {str(e)}")
        return context.res.json({"success": False, "message": str(e)}, 500)
