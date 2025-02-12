from newspaper import Article
from datetime import datetime
import nltk
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Dict, Any, Set, List
from bson import ObjectId


class ArticleProcessor:
    def __init__(self, db_session, context=None):
        self.db = db_session
        self.context = context

        # Ensure NLTK data is downloaded
        nltk.download("punkt", quiet=True)
        nltk.download("punkt_tab", quiet=True)

    def log(self, message: str) -> None:
        """Unified logging method"""
        if self.context:
            self.context.log(message)
        else:
            print(message)

    def is_article_exists(self, url: str) -> bool:
        """Check if article already exists in the articles collection"""
        return self.db.articles_collection.find_one({"url": url}) is not None

    def get_links(self, url: str, domain: str) -> Set[str]:
        """Extract all links from the given URL that belong to the same domain"""
        try:
            response = requests.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            links = set()

            for a_tag in soup.find_all("a", href=True):
                link = urljoin(url, a_tag["href"])
                if domain in link and not self.is_article_exists(link):
                    links.add(link)

            self.log(f"Found {len(links)} new links on {url}")
            return links

        except Exception as e:
            self.log(f"Error fetching links from {url}: {str(e)}")
            return set()

    def process_single_article(
        self, url: str, job_execution: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Process a single article URL"""
        try:
            if self.is_article_exists(url):
                self.log(f"Article already exists: {url}")
                return None

            article = Article(url, language="en")
            article.download()
            article.parse()
            article.nlp()

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

            # Insert article into database
            result = self.db.articles_collection.insert_one(article_data)
            article_data["_id"] = str(result.inserted_id)

            self.log(f"Successfully processed article: {url}")
            return article_data

        except Exception as e:
            self.log(f"Error processing article {url}: {str(e)}")
            return None

    def crawl_and_process(
        self,
        job_execution: Dict[str, Any],
        max_pages: int = 20,
        max_depth: int = 2,
        max_workers: int = 5,
    ) -> List[Dict[str, Any]]:
        """Crawl and process articles starting from the source URL"""
        start_url = job_execution["sourceUrl"]
        parsed_url = urlparse(start_url)
        domain = parsed_url.netloc
        self.context.log(f"Starting crawl from: {start_url}")
        visited = set()
        to_visit = [(start_url, 0)]  # (URL, current_depth)
        processed_articles = []

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            while to_visit and len(processed_articles) < max_pages:
                current_depth = to_visit[0][1]
                current_batch = []

                # Collect URLs at the same depth
                while (
                    to_visit
                    and to_visit[0][1] == current_depth
                    and len(current_batch) < max_workers
                ):
                    url, depth = to_visit.pop(0)
                    if url not in visited and not self.is_article_exists(url):
                        visited.add(url)
                        current_batch.append((url, depth))

                if not current_batch:
                    continue

                # Process batch in parallel
                future_to_url = {
                    executor.submit(self.process_single_article, url, job_execution): (
                        url,
                        depth,
                    )
                    for url, depth in current_batch
                }

                for future in as_completed(future_to_url):
                    url, depth = future_to_url[future]
                    article_data = future.result()

                    if article_data:
                        processed_articles.append(article_data)
                        self.log(f"Successfully extracted data from: {url}")

                        # Get new links for next depth
                        if depth < max_depth:
                            new_links = self.get_links(url, domain)
                            for link in new_links:
                                if link not in visited:
                                    to_visit.append((link, depth + 1))

        return processed_articles

    def update_job_execution(self, job_id: str, updates: Dict[str, Any]) -> None:
        """Update job execution status and metadata"""
        self.db.job_executions_collection.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {**updates, "updatedAt": datetime.utcnow().isoformat()}},
        )
