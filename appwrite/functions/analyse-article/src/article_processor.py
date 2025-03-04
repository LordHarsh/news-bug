import google.generativeai as genai
import json
from typing import List, Dict, Any
from .logger import Logger
from pydantic import BaseModel


class DiseaseAnalysis(BaseModel):
    """Data model for disease outbreak information extracted from articles."""

    keyword: str
    location: str
    case_count: int


class ArticleAnalysisResult(BaseModel):
    """Result of analyzing a single article."""

    is_valid_article: bool
    data: list[DiseaseAnalysis]


class ArticleRequest(BaseModel):
    """Request model for article processing."""

    article_id: str
    content: str
    count: int = -1


class ArticleResponse(BaseModel):
    """Response model for processed article."""

    article_id: str
    is_valid_article: bool
    data: list[DiseaseAnalysis]


class BatchResponseSchema(BaseModel):
    """Schema for batch processing response."""

    results: List[ArticleResponse]


class ProcessingResult:
    """Container for processing results with helper methods."""

    def __init__(self):
        self.results: List[ArticleResponse] = []
        self.failed_articles: List[ArticleRequest] = []

    def add_success(self, responses: List[ArticleResponse]):
        """Add successful processing results."""
        self.results.extend(responses)

    def add_failure(self, articles: List[ArticleRequest]):
        """Add failed articles and create empty responses for them."""
        self.failed_articles.extend(articles)

        # Create empty responses for failed articles
        for article in articles:
            self.results.append(
                ArticleResponse(
                    article_id=article.article_id,
                    is_valid_article=False,
                    data=[],
                )
            )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format for response."""
        return {"results": self.results, "failed_articles": self.failed_articles}


class ArticleProcessor:
    """Processes news articles to extract disease outbreak information using Gemini API."""

    def __init__(
        self,
        context: Any,
        logger: Logger,
        api_key: str,
        model_name: str = "gemini-2.0-flash-lite",
    ):
        """
        Initialize the ArticleProcessor with API credentials and configuration.

        Args:
            context: Execution context (for cloud functions or similar environments)
            logger: Logger instance for recording execution information
            api_key: Gemini API key
            model_name: Name of the Gemini model to use
        """
        self.context = context
        self.logger = logger
        self.api_key = api_key
        self.model_name = model_name
        self.keywords: List[str] = []

        # Configure Gemini
        self._setup_gemini()

    def _setup_gemini(self):
        """Configure Gemini API with simplified response schema."""
        try:
            genai.configure(api_key=self.api_key)

            # Using basic schema definition compatible with Gemini
            response_schema = {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "article_count": {"type": "integer"},
                        "is_valid_article": {"type": "boolean"},
                        "data": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "keyword": {"type": "string"},
                                    "location": {"type": "string"},
                                    "case_count": {"type": "integer"},
                                },
                                "required": ["keyword", "location", "case_count"],
                            },
                        },
                    },
                    "required": ["is_valid_article", "data"],
                },
            }

            self.model = genai.GenerativeModel(
                self.model_name,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=response_schema,
                ),
            )
            self.logger.info(f"Successfully configured Gemini model {self.model_name}")
        except Exception as e:
            self.logger.error(f"Failed to configure Gemini: {e}")
            raise RuntimeError(f"Failed to initialize Gemini client: {e}")

    def set_keywords(self, keywords: List[str]) -> None:
        """
        Set the disease keywords to look for in articles.

        Args:
            keywords: List of disease names to search for
        """
        if not keywords or not all(isinstance(k, str) for k in keywords):
            raise ValueError("Keywords must be a non-empty list of strings")

        self.keywords = keywords
        self.logger.info(f"Set {len(keywords)} keywords for disease monitoring")

    def _create_batch_prompt(self, articles: List[ArticleRequest]) -> str:
        """
        Create a prompt for processing multiple articles.

        Args:
            articles: List of articles to analyze

        Returns:
            Formatted prompt for Gemini
        """
        keyword_string = ", ".join(self.keywords)

        articles_text = "\n\n".join(
            [
                f"\n\n----------Article Count: {article.count}----------\n{article.content.strip()}\n\n\n"
                for article in articles
            ]
        )

        return f"""
Analyze the following news articles to detect if they report new cases of diseases from this list: {keyword_string}.

Articles:
{articles_text}

Instructions:
1. For each article, determine if it's a valid news article (not an advertisement or irrelevant content)
2. Identify any mentions of active cases or outbreaks of the listed diseases
3. Extract the following for each disease mention:
   - Disease name (keyword)
   - Location of the outbreak (use 'unknown' if not specified)
   - Number of cases (use exact number when stated, assume 1 for unspecified cases)
4. Return the count of the article for better tracking and the extracted data for each disease mention.

Format requirements:
- Return a JSON array where each object represents an article analysis
- Each object must include:
  - article_count: integer (the original article ID)
  - is_valid_article: boolean value
  - data: array of disease mentions (empty array if none found)
- Each disease mention in data must include:
  - keyword: string (the disease name)
  - location: string (the outbreak location, 'unknown' if not mentioned)
  - case_count: integer (number of cases)
- Include an analysis for every article, even if no diseases are mentioned
- If the article is invalid, still include it with an empty data array
"""

    def _validate_gemini_response(
        self, response_text: str, articles: list[ArticleRequest]
    ) -> List[ArticleResponse]:
        """
        Validate and parse the Gemini API response.

        Args:
            response_text: Raw JSON response from Gemini
            articles: Original article requests for ID matching

        Returns:
            Validated and parsed response objects
        """
        try:
            # Parse JSON response
            parsed_response = json.loads(response_text)

            if not isinstance(parsed_response, list):
                self.logger.error(
                    f"Expected list response, got: {type(parsed_response)}"
                )
                return []

            # Create a lookup dictionary for articles by their temporary ID
            article_lookup = {i: article for i, article in enumerate(articles)}

            # Create response objects with article IDs
            results = []
            processed_articles = set()

            for item in parsed_response:
                # Extract article_count to map back to original article
                article_count = item.get("article_count")

                # Skip items with invalid article_count
                if article_count is None or article_count not in article_lookup:
                    self.logger.warning(
                        f"Invalid article_count in response: {article_count}"
                    )
                    continue

                # Get the original article
                article = article_lookup[article_count]
                processed_articles.add(article_count)

                # Extract and validate fields
                is_valid_article = item.get("is_valid_article", False)
                raw_data = item.get("data", [])

                # Process disease data
                processed_data = []
                for entry in raw_data:
                    if all(k in entry for k in ["keyword", "location", "case_count"]):
                        # Ensure case_count is an integer
                        case_count = entry["case_count"]
                        if not isinstance(case_count, int):
                            try:
                                case_count = int(case_count)
                            except (ValueError, TypeError):
                                case_count = 1

                        processed_data.append(
                            DiseaseAnalysis(
                                keyword=entry["keyword"],
                                location=entry["location"],
                                case_count=case_count,
                            )
                        )

                results.append(
                    ArticleResponse(
                        article_id=article.article_id,
                        is_valid_article=is_valid_article,
                        data=processed_data,
                    )
                )

            # Add empty results for any articles not included in the response
            for idx, article in article_lookup.items():
                if idx not in processed_articles:
                    self.logger.warning(
                        f"No response received for article {article.article_id}"
                    )
                    results.append(
                        ArticleResponse(
                            article_id=article.article_id,
                            is_valid_article=False,
                            data=[],
                        )
                    )

            return results

        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON response: {e}")
            return []
        except Exception as e:
            self.logger.error(f"Unexpected error validating response: {e}")
            return []

    def process_articles(self, articles: List[ArticleRequest]) -> Dict[str, Any]:
        """
        Process all articles in a single batch.

        Args:
            articles: List of articles to process

        Returns:
            Dictionary containing processing results and any failed articles
        """
        if not articles:
            self.logger.info("No articles provided for processing")
            return {"results": [], "failed_articles": []}

        if not self.keywords:
            raise ValueError("Keywords not set. Call set_keywords() first.")

        result = ProcessingResult()

        try:
            # Create prompt and send to Gemini
            for count, article in enumerate(articles):
                self.logger.info(f"Processing article {str(article)}, count: {count}")
                article.count = count
            prompt = self._create_batch_prompt(articles)
            self.logger.info(f"Sending batch of {len(articles)} articles to Gemini")

            # Use the simplified schema format
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                ),
            )

            # Process successful response
            if response and hasattr(response, "text"):
                self.logger.info(f"Received response from Gemini: {response.text}")
                article_results = self._validate_gemini_response(
                    response.text, articles
                )

                if article_results:
                    result.add_success(article_results)
                    self.logger.info(
                        f"Successfully processed {len(article_results)} articles"
                    )
                else:
                    # Response validation failed
                    result.add_failure(articles)
                    self.logger.error("Failed to validate Gemini response")
            else:
                # Empty or invalid response
                result.add_failure(articles)
                self.logger.error("Received empty or invalid response from Gemini")

        except Exception as e:
            # Handle any exceptions during processing
            result.add_failure(articles)
            self.logger.error(f"Error processing articles: {str(e)}")

        # Return results
        return result.to_dict()


def main():
    """Example usage of the ArticleProcessor"""
    import logging

    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    logger = logging.getLogger("article_processor")

    # API key should be kept in environment variables in production
    api_key = "YOUR_API_KEY_HERE"

    # Initialize processor
    processor = ArticleProcessor(context=None, logger=logger, api_key=api_key)

    # Set disease keywords
    processor.set_keywords(["Measles", "Flu", "Mumps", "Chickenpox", "COVID-19"])

    # Example articles
    articles = [
        ArticleRequest(
            article_id="news-001",
            content="""
            SPRINGFIELD HEALTH ALERT: Reports from County Health Services indicate a confirmed case of Measles in Springfield.
            The patient, a 34-year-old adult, is currently isolated at home and recovering.
            Health officials are tracing contacts to prevent further spread. This is the first case in the county this year.
            """,
        ),
        ArticleRequest(
            article_id="school-alert-002",
            content="""
            Three suspected cases of Mumps at Jefferson High School, pending lab confirmation.
            School officials have notified all parents and implemented additional sanitation protocols.
            Health officials are monitoring the situation closely and recommend vaccination checks.
            """,
        ),
        ArticleRequest(
            article_id="ad-content-003",
            content="""
            SPECIAL OFFER: Immune Boost Vitamins - 50% OFF!
            Protect your family this season with our specially formulated immune support supplement.
            Order now and receive free shipping on orders over $30. Use code HEALTHY at checkout.
            """,
        ),
    ]

    # Process articles
    response = processor.process_articles(articles)

    # Print results in a readable format
    print("\n--- PROCESSING RESULTS ---")
    for result in response["results"]:
        print(f"\nArticle ID: {result.article_id}")
        print(f"Valid Article: {'Yes' if result.is_valid_article else 'No'}")

        if result.data:
            print("Disease Mentions:")
            for item in result.data:
                print(
                    f"  - {item.keyword}: {item.case_count} case(s) in {item.location}"
                )
        else:
            print("No disease mentions found")

    # Report failures
    if response["failed_articles"]:
        print(f"\nFailed to process {len(response['failed_articles'])} articles")


if __name__ == "__main__":
    main()
