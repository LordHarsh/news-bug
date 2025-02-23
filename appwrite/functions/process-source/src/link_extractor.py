import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from typing import Set
from .logger import Logger

class LinkExtractor:
    def __init__(self, logger: Logger):
        self.logger = logger
    
    def get_domain_links(self, url: str, domain: str) -> Set[str]:
        """Extract links from page that match the domain"""
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            links = set()
            for a_tag in soup.find_all("a", href=True):
                link = urljoin(url, a_tag["href"])
                if domain in link:
                    links.add(link)

            return links
        except Exception as e:
            self.logger.error(f"Error extracting links from {url}: {str(e)}")
            return set()
