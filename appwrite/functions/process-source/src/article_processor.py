from newspaper import Article
from datetime import datetime
import nltk
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import Optional, Dict, Any, Set, List, Tuple
import time
from bson import ObjectId
import json


class ArticleProcessor:
    def __init__(self, db_session, context=None):
        self.db = db_session
        self.context = context

        # Ensure NLTK data is downloaded
        try:
            nltk.download("punkt", quiet=True)
            nltk.download("punkt_tab", quiet=True)
        except Exception as e:
            self.context.log(f"Error downloading NLTK data: {str(e)}")
            raise

    def log(self, message: str, level: str = "INFO", extra: Dict = None) -> None:
        """Enhanced logging method with support for levels and additional context"""
        timestamp = datetime.utcnow().isoformat()
        log_entry = {
            "timestamp": timestamp,
            "level": level,
            "message": message,
        }

        if self.context:
            self.context.log(str(log_entry))
        else:
            print(json.dumps(log_entry))

    def is_article_exists(self, url: str) -> bool:
        """Check if article already exists in the articles collection"""
        self.log("Checking article existence", extra={"url": url})
        exists = self.db.articles_collection.find_one({"url": url}) is not None
        self.log(
            f"Article existence check result: {'exists' if exists else 'not found'}",
            extra={"url": url, "exists": exists},
        )
        return exists

    def update_job_execution(self, job_id: str, updates: Dict[str, Any]) -> None:
        """Update job execution status and metadata"""
        self.log("Updating job execution", extra={"job_id": job_id, "updates": updates})

        try:
            self.db.job_executions_collection.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {**updates, "updatedAt": datetime.utcnow().isoformat()}},
            )
            self.log("Job execution updated successfully", extra={"job_id": job_id})

        except Exception as e:
            self.log(
                "Error updating job execution",
                level="ERROR",
                extra={
                    "job_id": job_id,
                    "error": str(e),
                    "error_type": type(e).__name__,
                },
            )
            raise

    def get_links(self, url: str, domain: str) -> Set[str]:
        """Extract all links from the given URL that belong to the same domain"""
        self.log("Starting link extraction", extra={"url": url, "domain": domain})

        try:
            self.log("Sending HTTP request", extra={"url": url})
            response = requests.get(url)
            response.raise_for_status()

            self.log("Parsing HTML content", extra={"url": url})
            soup = BeautifulSoup(response.text, "html.parser")
            links = set()

            self.log("Extracting links from HTML", extra={"url": url})
            for a_tag in soup.find_all("a", href=True):
                link = urljoin(url, a_tag["href"])
                if domain in link and not self.is_article_exists(link):
                    links.add(link)

            self.log(
                f"Link extraction completed",
                extra={"url": url, "total_links_found": len(links), "domain": domain},
            )
            return links

        except Exception as e:
            self.log(
                f"Error fetching links",
                level="ERROR",
                extra={"url": url, "error": str(e), "error_type": type(e).__name__},
            )
            return set()

    def process_single_article(
        self, url: str, job_execution: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Process a single article URL"""
        self.log("Starting article processing", extra={"url": url})

        try:
            if self.is_article_exists(url):
                self.log("Skipping existing article", extra={"url": url})
                return None

            self.log("Initializing Article object", extra={"url": url})
            article = Article(url, language="en")

            self.log("Downloading article content", extra={"url": url})
            article.download()

            self.log("Parsing article content", extra={"url": url})
            article.parse()

            self.log("Performing NLP analysis", extra={"url": url})
            article.nlp()

            self.log("Preparing article data", extra={"url": url})
            article_data = {
                "title": article.title,
                "sourceId": job_execution["sourceId"],
                "categoryId": job_execution["categoryId"],
                "url": url,
                "publishDate": (
                    article.publish_date.isoformat() if article.publish_date else None
                ),
                "createdAt": datetime.utcnow().isoformat(),
                "updatedAt": datetime.utcnow().isoformat(),
                "content": article.text,
                "keywords": article.keywords,
                "summary": article.summary,
                "metadata": {
                    "authors": article.authors,
                    "topImage": article.top_image,
                    "images": list(article.images),
                    "categoryKeywords": job_execution["categoryKeywords"],
                    "matchedKeywords": [
                        keyword
                        for keyword in job_execution["categoryKeywords"]
                        if keyword.lower() in article.text.lower()
                    ],
                },
            }

            self.log(
                "Inserting article into database",
                extra={
                    "url": url,
                    "title": article.title,
                    "num_keywords": len(article.keywords),
                    "content_length": len(article.text),
                },
            )

            result = self.db.articles_collection.insert_one(article_data)
            article_data["_id"] = str(result.inserted_id)

            self.log(
                "Article processing completed successfully",
                extra={
                    "url": url,
                    "article_id": str(result.inserted_id),
                    "title": article.title,
                },
            )
            return article_data

        except Exception as e:
            self.log(
                "Error processing article",
                level="ERROR",
                extra={
                    "url": url,
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "stack_trace": getattr(e, "__traceback__", None).__str__(),
                },
            )
            return None

    def crawl_and_process_with_timeout(
        self,
        job_execution: Dict[str, Any],
        max_pages: int = 20,
        max_depth: int = 2,
        time_limit: int = 600,  # 10 minutes in seconds
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Crawl and process articles with a time limit, saving progress for next execution"""
        start_time = time.time()

        # Load progress from previous execution if exists
        self.context.log(f"{str(job_execution)}")
        progress = job_execution.get("metadata", {}).get("crawl_progress", {})
        self.context.log(f"Loaded progress: {str(progress)}")
        visited = set(progress.get("visited", []))
        to_visit = progress.get("to_visit", [(job_execution["sourceUrl"], 0)])
        processed_articles = []

        parsed_url = urlparse(job_execution["sourceUrl"])
        domain = parsed_url.netloc

        self.log(
            "Starting time-limited crawl process",
            extra={
                "time_limit": time_limit,
                "visited_count": len(visited),
                "queue_size": len(to_visit),
            },
        )

        while to_visit and len(processed_articles) < max_pages:
            # Check time limit
            if time.time() - start_time > time_limit:
                self.log("Time limit reached, preparing for next execution")
                break

            url, depth = to_visit.pop(0)

            if url not in visited and (
                not self.is_article_exists(url) or url == job_execution["sourceUrl"]
            ):
                visited.add(url)
                self.context.log(f"Processing URL: {url}")
                article_data = self.process_single_article(url, job_execution)
                self.context.log(f"Processed URL: {url}")
                if article_data:
                    processed_articles.append(article_data)

                    if depth < max_depth:
                        new_links = self.get_links(url, domain)
                        for link in new_links:
                            if link not in visited:
                                to_visit.append((link, depth + 1))

        # Prepare progress data for next execution
        execution_progress = {
            "visited": list(visited),
            "to_visit": to_visit,
            "total_processed": progress.get("total_processed", 0)
            + len(processed_articles),
            "last_execution_time": datetime.utcnow().isoformat(),
            "is_completed": len(to_visit) == 0 or len(processed_articles) >= max_pages,
        }

        return processed_articles, execution_progress
