import json
import time
from datetime import datetime
from typing import Dict, Any
from urllib.parse import urlparse
from bson import ObjectId
import croniter
import os

# Modules
from .appwrite import AppwriteClient
from .logger import Logger
from .article_extractor import ArticleExtractor
from .link_extractor import LinkExtractor
from .mongo import MongoSession
from .article_processor import ArticleProcessor, ArticleRequest


class Crawler:
    def __init__(
        self,
        mongo_client: MongoSession,
        context,
        appwrite_client: AppwriteClient,
        article_extractor: ArticleExtractor,
        link_extractor: LinkExtractor,
        logger: Logger,
    ):
        self.db = mongo_client
        self.context = context
        self.appwrite_client = appwrite_client
        self.article_extractor = article_extractor
        self.link_extractor = link_extractor
        self.log = logger.info
        self.error = logger.error

        self.max_depth = 2
        self.max_pages = 1000
        self.time_limit = 600

        self.api_key = os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        self.article_processor = ArticleProcessor(self.api_key)

    def is_article_exists(self, url: str, category_id: str) -> bool:
        """Check if article with same URL and categoryId exists"""
        return self.db.articles_collection.find_one(
            {"url": url, "categoryId": category_id}
        )

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

    def update_job_status(self, job_id: str, updates: Dict[str, Any]) -> None:
        """Update job status in MongoDB"""
        try:
            self.db.job_executions_collection.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {**updates, "updatedAt": datetime.utcnow()}},
            )
        except Exception as e:
            self.error(f"Failed to update job status: {str(e)}", "ERROR")
            raise

    def update_source_status(self, source_id: str, updates: Dict[str, Any]) -> None:
        """Update source status in MongoDB"""
        try:
            self.db.sources_collection.update_one(
                {"_id": ObjectId(source_id)},
                {"$set": {**updates, "updatedAt": datetime.utcnow()}},
            )
        except Exception as e:
            self.error(f"Failed to update source status: {str(e)}")

    def crawl(self, job_id: str) -> Dict[str, Any]:
        """Main processing function with timeout handling"""
        start_time = datetime.utcnow()
        print("Crawling")
        self.log("Processing started")

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
        total_processed = progress.get("total_processed", 0)
        remaining_pages = self.max_pages - total_processed
        unique_processed_count = 0  # Counter for new articles only

        domain = urlparse(job_data["sourceUrl"]).netloc

        try:
            while to_visit and unique_processed_count < remaining_pages:
                if (datetime.utcnow() - start_time).total_seconds() > self.time_limit:
                    self.log("Time limit reached, saving progress")
                    break

                current_url, depth = to_visit.pop(0)
                is_source_url = current_url == job_data["sourceUrl"]

                if current_url not in visited:
                    visited.add(current_url)

                    # Process article if it doesnt exist
                    does_article_exist = self.is_article_exists(
                        current_url, job_data["categoryId"]
                    )
                    if not is_source_url and does_article_exist:
                        self.log(f"Article already exists: {current_url}")
                        continue  # skip to next iteration

                    article_data = self.article_extractor.extract_article(
                        current_url, job_data, is_source_url=is_source_url
                    )

                    if article_data:
                        if not does_article_exist:  # only save non-source articles
                            article_data["_id"] = (
                                self.db.articles_collection.insert_one(
                                    {**article_data, "createdAt": datetime.utcnow()}
                                ).inserted_id
                            )
                            unique_processed_count += 1
                            self.log(
                                f"Processed article: {current_url} with ID {str(article_data['_id'])}"
                            )
                        elif is_source_url:
                            self.db.articles_collection.update_one(
                                {
                                    "url": current_url,
                                    "categoryId": job_data["categoryId"],
                                },
                                {"$set": article_data},
                            )
                            article_data["_id"] = does_article_exist["_id"]
                            self.log(
                                f"Updated source article: {current_url} with ID {article_data['_id']}"
                            )
                        processed_urls.append(str(article_data["_id"]))

                        # Get more links if within depth limit
                        if depth < self.max_depth:
                            new_links = self.link_extractor.get_domain_links(
                                current_url, domain
                            )
                            for link in new_links - visited:
                                to_visit.append((link, depth + 1))

            new_total_processed = total_processed + len(processed_urls)

            # Update progress data
            execution_progress = {
                "visited": list(visited),
                "to_visit": to_visit,
                "total_processed": new_total_processed,
                "is_completed": len(to_visit) == 0
                or new_total_processed >= self.max_pages,
                "max_pages": self.max_pages,  # Store the limit for reference
                "max_depth": self.max_depth,  # Store the depth limit for reference
            }

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
                        "completedAt": datetime.utcnow(),
                        "duration": (datetime.utcnow() - start_time).total_seconds(),
                    }
                )
                base = datetime.now()
                sourceId = job_data.get("sourceId", None)
                cron_schedule = self.db.get_cron_schedule_from_sourceId(sourceId)
                cron = croniter.croniter(cron_schedule, base)
                next_run_at = cron.get_next(datetime)
                self.update_source_status(
                    job_data.get("sourceId"),
                    {
                        "status": "idle",
                        "nextRunAt": next_run_at if next_run_at else None,
                        "updatedAt": datetime.utcnow(),
                    },
                )
                self.log("Processing completed")

                # Trigger article processing function
            #     articles = self.db.articles_collection.find(
            #         {
            #             "_id": {
            #                 "$in": [
            #                     ObjectId(article_id) for article_id in processed_urls
            #                 ]
            #             }
            #         }
            #     ).to_list(length=len(processed_urls))
            #     article_requests = [
            #         ArticleRequest(
            #             article_id=str(article["_id"]), content=article["content"]
            #         )
            #         for article in articles
            #     ]
            #     self.article_processor.set_keywords(job_data["categoryKeywords"])
            #     result = self.article_processor.process_articles(article_requests)
            #     # Update the articles with the analysis results
            #     self.db.update_articles_with_process_data(result["results"])

            #     # Log any failed articles
            #     if result["failed_articles"]:
            #         self.error(
            #             f"Failed to process {len(result['failed_articles'])} articles",
            #         )

            # else:
            #     self.appwrite_client.trigger_function(job_id)

            # self.update_job_status(job_id, status_update)

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
            self.error(f"Processing failed: {str(e)}")
            self.update_job_status(
                job_id,
                {
                    "status": "error",
                    "error": str(e),
                    "completedAt": datetime.utcnow(),
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

        with MongoSession(context) as mongo_client:
            appwrite_client = AppwriteClient(context)
            logger = Logger(context)
            article_extractor = ArticleExtractor(appwrite_client, logger)
            link_extractor = LinkExtractor(logger)
            crawler = Crawler(
                mongo_client,
                context,
                appwrite_client,
                article_extractor,
                link_extractor,
                logger,
            )

            result = crawler.crawl(job_id=job_id)

        context.log(f"Execution time: {time.time() - start_time} seconds")
        return context.res.json(result)

    except Exception as e:
        context.error(f"Error occurred: {str(e)}")
        return context.res.json({"success": False, "message": str(e)}, 500)
