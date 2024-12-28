import requests
from beautiful_soup import BeautifulSoupScraper
from langchain_text_splitters import RecursiveCharacterTextSplitter

chunk_size = 5000
chunk_overlap = 0
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=chunk_size, chunk_overlap=chunk_overlap
)


def lambda_handler(event, context):
    """
    AWS Lambda handler function that processes an event containing a list of URLs,
    scrapes content from each URL, and returns the scraped contents.

    Args:
        event (dict): The event dictionary containing the input data. Expected to have the structure:
                      {
                          "node": {
                              "inputs": [
                                  {
                                      "value": [list of URLs]
                                  }
                              ]
                          }
                      }
        context (object): The context in which the Lambda function is called. Provides runtime information.

    Returns:
        list: A list of scraped contents from the provided URLs.
    """
    print(event)

    value: list = event["node"]["inputs"][0]["value"]

    session = requests.Session()

    contents = []

    for link in value:
        content, image_urls, title = BeautifulSoupScraper(
            link=link, session=session
        ).scrape()
        content = text_splitter.split_text(content)
        contents.extend(content[:1])

    return contents
