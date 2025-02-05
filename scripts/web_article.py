import requests
from bs4 import BeautifulSoup

def fetch_words():
    # url = "https://timesofindia.indiatimes.com/city/indore/those-who-had-covid-must-undergo-regular-check-ups/articleshow/107002576.cms"  # Replace with the actual URL

    url = "https://www.hindustantimes.com/cities/mumbai-news/second-covid-19-death-in-city-this-year-101705691011267.html"
    response = requests.get(url)
    print(response.content)
    soup = BeautifulSoup(response.content, "html.parser")
    
    
    
    # title = soup.find("h1").text  # Replace with appropriate selector
    # article_body = soup.find("div").text  # Replace with appropriate selector
    # title = soup.find("h1").text or soup.find("h2").text or soup.find("title").text
    # for paragraph in soup.find_all("p"):
    #     article_body += paragraph.text
    


    # Find all elements with a class of "article-header"
    article_headers = soup.find_all(class_="article-header")

    # Extract article titles and links
    for header in article_headers:
        title = header.find("h2").text.strip()
        link = header.find("a")["href"]
        print("Title:", title)
        print("Link:", link)

    # Find article content elements
    article_content = soup.find_all("p")

    # Extract text content
    for content in article_content:
        article_text = content.get_text(strip=True, separator="\n")
        print("Article Text:\n", article_text)

    
    
    # print("\033[91m {}\033[00m" .format(title))
    # print(article_text)


if __name__ == "__main__":

    fetch_words()