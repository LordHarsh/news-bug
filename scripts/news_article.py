from newspaper import Article
from datetime import datetime
import nltk

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

# Example usage
if __name__ == "__main__":
    # url = "https://timesofindia.indiatimes.com/india/collective-failure-of-system-rahul-gandhi-on-death-of-3-upsc-aspirants-in-delhi/articleshow/112079124.cms"
    # url = "https://edition.cnn.com/2024/07/28/middleeast/israel-hezbollah-golan-heights-soccer-strikes-intl/index.html"
    url = "https://edition.cnn.com/2024/07/17/health/long-covid-risk/index.html"
    extract_using_newspaper3k(url)
