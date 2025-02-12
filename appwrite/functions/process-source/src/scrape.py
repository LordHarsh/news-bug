from newspaper import Article
from datetime import datetime
import nltk
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from .mongo import MongoSession

nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)

# MongoDB connection
client = MongoSession()
sources_collection = client.sources_collection
articles_collection = client.articles_collection
job_executions_collection = client.job_executions_collection
categories_collection = client.categories_collection


def is_url_processed(url):
    """
    Check if URL has been processed before
    """
    return sources_collection.find_one({"url": url}) is not None


def mark_url_processed(url, success=True):
    """
    Mark URL as processed in MongoDB
    """
    sources_collection.update_one(
        {"url": url},
        {"$set": {"url": url, "processed_date": datetime.now(), "success": success}},
        upsert=True,
    )


def extract_using_newspaper3k(url, platform):
    """
    Extract article content using newspaper3k.
    Returns a dictionary with article details.
    """
    try:
        print(f"Extracting article from URL: {url}")
        article = Article(url, language="en")
        article.download()
        article.parse()
        article.nlp()  # Perform NLP for keywords and summary

        article_data = {
            "title": article.title,
            "platform": platform,
            "publish_date": article.publish_date,
            "upload_date": datetime.now(),
            "text": article.text,
            "keywords": article.keywords,
            "summary": article.summary,
            "url": url,
            "sourceId": sources_collection.find_one({"url": url})["_id"],
        }

        # Store article in MongoDB
        articles_collection.update_one(
            {"url": url}, {"$set": article_data}, upsert=True
        )

        return article_data
    except Exception as e:
        print(f"Error extracting {url}: {e}")
        return None


def get_links(url, domain):
    """
    Extract all links from the given URL that belong to the same domain as start_url.
    """
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        links = set()
        for a_tag in soup.find_all("a", href=True):
            link = urljoin(url, a_tag["href"])
            if domain in link and not is_url_processed(link):
                links.add(link)
        print(f"Found {len(links)} new links on {url}")
        return links
    except Exception as e:
        print(f"Error fetching links from {url}: {e}")
        return set()


def process_url(url, platform, depth):
    """
    Process a single URL - used for parallel execution
    """
    try:
        article_data = extract_using_newspaper3k(url, platform)
        mark_url_processed(url, success=True)
        return article_data, url, depth
    except Exception as e:
        print(f"Error processing {url}: {e}")
        mark_url_processed(url, success=False)
        return None, url, depth


def crawl_and_extract(
    start_url, platform, max_pages=20, max_depth=2, domain=None, max_workers=5
):
    """
    Crawl the web starting from the start_url and extract articles using parallel processing.
    Returns a list of article dictionaries.
    """
    if domain is None:
        parsed_url = urlparse(start_url)
        domain = parsed_url.netloc

    visited = set()
    to_visit = [(start_url, 0)]  # (URL, current_depth)
    articles = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        while to_visit and len(articles) < max_pages:
            # Process URLs at the same depth in parallel
            current_depth = to_visit[0][1]
            current_batch = []

            while (
                to_visit
                and to_visit[0][1] == current_depth
                and len(current_batch) < max_workers
            ):
                url, depth = to_visit.pop(0)
                if url not in visited and not is_url_processed(url):
                    visited.add(url)
                    current_batch.append(url)

            if not current_batch:
                continue

            # Submit batch for parallel processing
            future_to_url = {
                executor.submit(process_url, url, platform, current_depth): url
                for url in current_batch
            }

            for future in as_completed(future_to_url):
                article_data, url, depth = future.result()
                if article_data:
                    articles.append(article_data)
                    print(f"Successfully extracted data from: {url}")

                    # Get new links for the next depth level
                    if depth < max_depth:
                        new_links = get_links(url, domain)
                        for link in new_links:
                            if link not in visited:
                                to_visit.append((link, depth + 1))

    print(f"Crawling complete. Total articles extracted: {len(articles)}")
    return articles


# Example usage
if __name__ == "__main__":
    start_url = "https://edition.cnn.com/health"
    platform = "CNN"
    articles = crawl_and_extract(
        start_url, platform, max_pages=20, max_depth=2, max_workers=5
    )

    # Save articles to a file
    with open("articles.txt", "w", encoding="utf-8") as file:
        for article in articles:
            file.write(f"Title: {article['title']}\n")
            file.write(f"Platform: {article['platform']}\n")
            file.write(f"Publish Date: {article['publish_date']}\n")
            file.write(f"Upload Date: {article['upload_date']}\n")
            file.write(f"Text: {article['text'][:200]}...\n")
            file.write(f"Keywords: {', '.join(article['keywords'])}\n")
            file.write(f"Summary: {article['summary']}\n")
            file.write(f"URL: {article['url']}\n")
            file.write("-" * 80 + "\n")
