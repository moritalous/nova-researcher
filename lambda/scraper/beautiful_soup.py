# https://github.com/assafelovic/gpt-researcher/blob/master/gpt_researcher/scraper/beautiful_soup/beautiful_soup.py
from bs4 import BeautifulSoup


def extract_title(soup: BeautifulSoup) -> str:
    """Extract the title from the BeautifulSoup object"""
    return soup.title.string if soup.title else ""


class BeautifulSoupScraper:

    def __init__(self, link, session=None):
        self.link = link
        self.session = session

    def scrape(self):
        """
        This function scrapes content from a webpage by making a GET request, parsing the HTML using
        BeautifulSoup, and extracting script and style elements before returning the cleaned content.

        Returns:
          The `scrape` method is returning the cleaned and extracted content from the webpage specified
        by the `self.link` attribute. The method fetches the webpage content, removes script and style
        tags, extracts the text content, and returns the cleaned content as a string. If any exception
        occurs during the process, an error message is printed and an empty string is returned.
        """
        try:
            response = self.session.get(self.link, timeout=4)
            soup = BeautifulSoup(
                response.content, "html.parser" #, from_encoding=response.encoding
            )

            for script_or_style in soup(["script", "style"]):
                script_or_style.extract()

            raw_content = self.get_content_from_url(soup)
            lines = (line.strip() for line in raw_content.splitlines())
            chunks = (phrase.strip()
                      for line in lines for phrase in line.split("  "))
            content = "\n".join(chunk for chunk in chunks if chunk)

            # Extract the title using the utility function
            title = extract_title(soup)

            return content, None, title

        except Exception as e:
            print("Error! : " + str(e))
            return "", [], ""

    def get_content_from_url(self, soup: BeautifulSoup) -> str:
        """Get the relevant text from the soup with improved filtering"""
        text_elements = []
        tags = ["h1", "h2", "h3", "h4", "h5", "p", "li", "div", "span"]

        for element in soup.find_all(tags):
            # Skip empty elements
            if not element.text.strip():
                continue

            # Skip elements with very short text (likely buttons or links)
            if len(element.text.split()) < 3:
                continue

            # Check if the element is likely to be navigation or a menu
            parent_classes = element.parent.get('class', [])
            if any(cls in ['nav', 'menu', 'sidebar', 'footer'] for cls in parent_classes):
                continue

            # Remove excess whitespace and join lines
            cleaned_text = ' '.join(element.text.split())

            # Add the cleaned text to our list of elements
            text_elements.append(cleaned_text)

        # Join all text elements with newlines
        return '\n\n'.join(text_elements)
