import requests
from beautiful_soup import BeautifulSoupScraper


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
            link=link, session=session).scrape()
        contents.append(content)

    return contents
