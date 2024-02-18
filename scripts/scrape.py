from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import codecs
import re
from webdriver_manager.chrome import ChromeDriverManager
import spacy
nlp = spacy.load("en_core_web_trf")

driver=webdriver.Chrome(service=Service(ChromeDriverManager().install()))


val = input("Enter a url: ")
wait = WebDriverWait(driver, 10)
driver.get(val)

get_url = driver.current_url
wait.until(EC.url_to_be(val))

if get_url == val:
    page_source = driver.page_source

soup = BeautifulSoup(page_source,features="html.parser")


# Find all elements with a class of "article-header"
article_headers = soup.find_all(class_="article-header")

# Extract article titles and links
for header in article_headers:
    title = header.find("h2").text.strip()
    link = header.find("a")["href"]
    print("Title:", title)
    print("Link:", link)

# Find article content elements
article_content = soup.find_all(["div"])
article_text = ""
# Extract text content
for content in article_content:
    text =  content.get_text(strip=True, separator="\n")
    text = text.split("\n")
    for line in text:
        article_text += line+"\n" if len(line) > 40 else ""
print("Article Text:\n", article_text)

title = soup.title.text

doc = nlp(article_text)
 


file=codecs.open('article_scraping.txt', 'w')
file.write(title+'\n')
file.write("The following are all instances of your keyword:\n")
file.write(article_text)
file.write('\n\n\n\n')
file.write("The following are all entities in the article:\n")
for ent in doc.ents:
    print(ent.text, ent.start_char, ent.end_char, ent.label_)
    file.write(ent.text+' '+ent.label_+'\n')
file.close()
    
driver.quit()