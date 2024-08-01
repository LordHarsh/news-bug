from news_article import extract_using_newspaper3k
def extract_from_web(platform, url):
    if platform == 'CNN':
        if "cnn.com" not in url.lower():
            raise ValueError("The URL provided is not from CNN")
        data = extract_using_newspaper3k(url, platform)
    if platform == 'Times of India':
        if "timesofindia" not in url:
            raise ValueError("The URL provided is not from Times of India")
        data = extract_using_newspaper3k(url)
    # Extract article from URL
    return data


if __name__ == "__main__":
    url = "https://edition.cnn.com/2024/07/17/health/long-covid-risk/index.html"
    # url = "https://timesofindia.indiatimes.com/india/collective-failure-of-system-rahul-gandhi-on-death-of-3-upsc-aspirants-in-delhi/articleshow/112079124.cms"
    data = extract_from_web("CNN", url)
    print(data)