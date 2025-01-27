from selenium.webdriver.support.ui import WebDriverWait
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support import expected_conditions as EC
from goose3 import Goose
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

url = "https://english.webdunia.com/article/deutsche-welle-news/top-10-most-dangerous-viruses-in-the-world-124022700019_1.html"
# url = "https://timesofindia.indiatimes.com/india/collective-failure-of-system-rahul-gandhi-on-death-of-3-upsc-aspirants-in-delhi/articleshow/112079124.cms"

driver.get(url)

# Wait for a specific element to load
try:
    if "webdunia" in url:
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, 'div.article_in_content')))
        time.sleep(2)  # Additional sleep if needed for content to fully load
        html = driver.page_source
    else:
        html = driver.page_source
finally:
    driver.quit()

# Use Goose for content extraction
g = Goose()
article = g.extract(raw_html=html)

print("Title:", article.title)
print("Cleaned Text:", article.cleaned_text)
