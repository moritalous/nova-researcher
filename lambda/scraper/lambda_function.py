# from scraper import Scraper
import requests
from beautiful_soup import BeautifulSoupScraper


def lambda_handler(event, context):
    print(event)

    value: list = event["node"]["inputs"][0]["value"]

    session = requests.Session()

    contents = []

    for link in value:
        content, image_urls, title = BeautifulSoupScraper(
            link=link, session=session).scrape()
        contents.append(content)

    return contents
