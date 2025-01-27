from newspaper import Article
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

def get_links(url):
    """Extract all links from the given URL."""
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    links = set()
    for a_tag in soup.find_all('a', href=True):
        link = urljoin(url, a_tag['href'])
        links.add(link)
    return links

def crawl_and_extract(start_url, platform, max_pages=5):
    """Crawl the web starting from the start_url and extract articles."""
    visited = set()
    to_visit = set([start_url])
    articles = []

    while to_visit and len(articles) < max_pages:
        url = to_visit.pop()
        if url not in visited:
            try:
                article_data = extract_using_newspaper3k(url, platform)
                articles.append(article_data)
                visited.add(url)
                print(f"Successfully extracted data from: {url}")
                
                # Extract links from the current page and add them to the to_visit set
                new_links = get_links(url)
                to_visit.update(new_links - visited)
            except Exception as e:
                print(f"Failed to extract data from: {url}. Error: {e}")
    
    return articles

# Example usage
if __name__ == "__main__":
    start_url = 'https://edition.cnn.com/health'
    platform = 'CNN'
    articles = crawl_and_extract(start_url, platform, max_pages=5)
    
    for article in articles:
        print(f"Title: {article['name']}")
        print(f"Publish Date: {article['date']}")
        print(f"Upload Date: {article['upload_date']}")
        print(f"Text: {article['text'][:200]}...")  # Print first 200 characters of the text
        print("-" * 80)