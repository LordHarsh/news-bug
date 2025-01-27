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
    # url = "https://edition.cnn.com/2024/07/17/health/long-covid-risk/index.html"
    # url = 'https://indianexpress.com/article/health-wellness/first-bird-flu-case-india-2024-all-you-need-to-know-9387525/'
    # url = 'https://www.downtoearth.org.in/health/bird-flu-outbreak-in-andhra-could-h5n1-spark-next-pandemic-new-paper-warns-of-risks-94527'
    # url = 'https://www.who.int/emergencies/disease-outbreak-news/item/2024-DON523'
    # url = 'https://english.webdunia.com/article/deutsche-welle-news/japan-flesh-eating-bacteria-infections-that-can-kill-in-48-hours-on-the-rise-know-why-is-it-so-deadly-124062000005_1.html'
    url = 'https://edition.cnn.com/health'
    print(extract_using_newspaper3k(url, 'CNN'))
