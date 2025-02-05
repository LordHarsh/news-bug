from newspaper import Article, Source
from datetime import datetime
import nltk
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# Download the necessary NLTK data for text processing
nltk.download('punkt')

def extract_using_newspaper3k(url, platform):
    print("Extracting article from URL:", url)
    article = Article(url, language="en")    
    article.download()
    
    # Parse the article
    article.parse()
    
    # Perform natural language processing (NLP)
    return {
        "name": article.title + " - " + platform,
        "date": article.publish_date,
        "upload_date": datetime.now(),
        "text": article.text
    }

def crawl_and_extract(start_url, platform, max_pages=20):
    """Crawl the web starting from the start_url and extract articles."""
    visited = set()
    to_visit = set([start_url])
    articles = []

    while to_visit and len(articles) < max_pages:
        url = to_visit.pop()
        if url not in visited:
            try:
                # Use Source to extract articles from the URL
                source = Source(url, language="en")
                source.download()
                source.parse()
                source.build()

                # Extract articles from the source
                for article in source.articles:
                    article.download()
                    article.parse()
                    articles.append({
                        "name": article.title + " - " + platform,
                        "date": article.publish_date,
                        "upload_date": datetime.now(),
                        "text": article.text
                    })
                    print(f"Successfully extracted data from: {article.url}")

                visited.add(url)
                print(f"To visit: {len(to_visit)}; Visited: {len(visited)}")
            except Exception as e:
                print(f"Failed to extract data from: {url}. Error: {e}")
    
    print(visited)
    return articles

# Example usage
if __name__ == "__main__":
    start_url = 'https://edition.cnn.com/health'
    platform = 'CNN'
    articles = crawl_and_extract(start_url, platform)
    file = open("articles.txt", "w")
    file.write(str(articles))
    for article in articles:
        print(f"Title: {article['name']}")
        print(f"Publish Date: {article['date']}")
        print(f"Upload Date: {article['upload_date']}")
        print(f"Text: {article['text'][:200]}...")  # Print first 200 characters of the text
        print("-" * 80)