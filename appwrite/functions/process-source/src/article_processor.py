import google.generativeai as genai
import json
from typing import List
from pydantic import BaseModel
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DiseaseAnalysis(BaseModel):
    keyword: str
    location: str
    case_count: int


class ArticleAnalysisResult(BaseModel):
    is_valid_article: bool
    data: list[DiseaseAnalysis]


class ArticleRequest(BaseModel):
    article_id: str
    content: str


class ArticleResponse(BaseModel):
    article_id: str
    is_valid_article: bool
    data: list[DiseaseAnalysis]


class BatchResponseSchema(BaseModel):
    results: List[ArticleResponse]


class ArticleProcessor:
    def __init__(
        self, api_key: str, model_name: str = "gemini-2.0-flash", batch_size: int = 10
    ):
        """
        Initialize the ArticleProcessor with API credentials and configuration.

        Args:
            api_key (str): Gemini API key
            model_name (str): Name of the Gemini model to use
            batch_size (int): Maximum number of articles to process in a single API call
        """
        self.api_key = api_key
        self.model_name = model_name
        self.batch_size = batch_size
        self.keywords: List[str] = []

        # Configure Gemini with response schema
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(
            model_name,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=list[ArticleResponse],
            ),
        )

    def set_keywords(self, keywords: List[str]) -> None:
        """Set the disease keywords to look for in articles."""
        self.keywords = keywords

    def _create_batch_prompt(self, articles: List[ArticleRequest]) -> str:
        """
        Create a prompt for batch processing multiple articles.

        Args:
            articles (List[ArticleRequest]): List of articles to analyze

        Returns:
            str: Formatted prompt for Gemini
        """
        keyword_string = ", ".join(self.keywords)
        articles_text = "\n\n".join(
            [
                f"\n\n----------Article ID: {article.article_id}----------\n{article.content}\n\n\n"
                for article in articles
            ]
        )

        return f"""
Analyze the following news articles to detect if they report new cases of diseases from this list: {keyword_string}.

Articles:
{articles_text}

Notes:
- Includes an entry for each article ID
- Set is_valid_article to false if the article is an advertisement or not a valid article
- For case_count: use explicit numbers when stated, assume 1 for mentioned cases without numbers
- Only include diseases in data array if they are mentioned as active cases/outbreaks
- Must return a data array for each article, even if empty
- Return an empty data array if no relevant disease outbreaks are mentioned
- return the location of the outbreak. Try to extract any location information from the article content. If the location is not mentioned, set it to 'unknown'

Return the results as a JSON object with a 'results' array containing the analysis for each article.
"""

    # For each article, provide an analysis in the following format:
    # {{
    #     "results": [
    #         {{
    #             "is_valid_article": true/false,
    #             "data": [
    #                 {{
    #                     "keyword": "disease name from list",
    #                     "location": "location of outbreak",
    #                     "case_count": number of cases (integer)
    #                 }}
    #             ]
    #         }}
    #     ]
    # }}
    def _validate_gemini_response(
        self, response_text: str, batch: list[ArticleRequest]
    ) -> List[ArticleResponse]:
        """
        Validate and parse the Gemini API response.

        Args:
            response_text (str): Raw response from Gemini

        Returns:
            List[ArticleResponse]: Validated and parsed response
        """
        try:
            parsed_response = json.loads(response_text)

            # Validate against BatchResponseSchema
            validated_response = [
                ArticleAnalysisResult(**item) for item in parsed_response
            ]
            consolidated_response = []
            for i, j in zip(validated_response, batch):
                consolidated_response.append(
                    ArticleResponse(
                        article_id=j.article_id,
                        is_valid_article=i.is_valid_article,
                        data=i.data,
                    )
                )
            return consolidated_response

        except Exception as e:
            logger.error(f"Error validating Gemini response: {e}")
            return []

    def process_articles(self, articles: List[ArticleRequest]):
        """
        Process multiple articles in batches.

        Args:
            articles (List[ArticleRequest]): List of articles to process

        Returns:
            List[ArticleResponse]: Analysis results for all articles
        """
        if not self.keywords:
            raise ValueError("Keywords not set. Call set_keywords() first.")

        results = []
        failed_articles = []
        for i in range(0, len(articles), self.batch_size):
            batch = articles[i : i + self.batch_size]

            try:
                prompt = self._create_batch_prompt(batch)
                response = self.model.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        response_schema=list[ArticleAnalysisResult],
                    ),
                )

                batch_results = self._validate_gemini_response(response.text, batch)
                results.extend(batch_results)

                logger.info(f"Processed batch of {len(batch)} articles successfully")

            except Exception as e:
                logger.error(f"Error processing batch: {e}")
                failed_articles.extend(batch)
                # Add empty results for failed batch
                for article in batch:
                    results.append(
                        ArticleResponse(
                            article_id=article.article_id,
                            analysis=ArticleAnalysisResult(
                                is_valid_article=False, data=[]
                            ),
                        )
                    )

        return {"results": results, "failed_articles": failed_articles}


def main():
    """Example usage of the ArticleProcessor"""
    api_key = "AIzaSyDUkgnO6nZb7icJKsOdpecdPNErwcol8XY"
    processor = ArticleProcessor(api_key)

    # Set disease keywords
    processor.set_keywords(["Measles", "Flu", "Mumps", "Chickenpox"])

    # Example articles
    articles = [
        ArticleRequest(
            article_id="article1",
            content="""
            Reports from County Health Services indicate a confirmed case of Measles in Springfield.
            The patient, a 34-year-old adult, is currently isolated at home and recovering.
            Health officials are tracing contacts to prevent further spread.
            """,
        ),
        ArticleRequest(
            article_id="article2",
            content="""
            Three suspected cases of Mumps at a local high school, pending lab confirmation.
            Health officials are monitoring the situation closely.
            """,
        ),
    ]

    # Process articles
    response = processor.process_articles(articles)

    results = response["results"]
    failed_articles = response["failed_articles"]

    # Print results
    print(json.dumps([result.model_dump() for result in results], indent=2))
    print(f"Failed to process {len(failed_articles)} articles")


if __name__ == "__main__":
    main()
