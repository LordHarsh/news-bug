from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from .article_processor import ArticleResponse
import requests


class GeoDiseaseAnalysis(BaseModel):
    """Enhanced disease analysis with geographical coordinates."""

    keyword: str
    location: str
    case_count: int
    latitude: float
    longitude: float


class GeoProcessedArticle(BaseModel):
    """Enhanced article data with geographical coordinates."""

    article_id: str
    is_valid_article: bool
    data: List[GeoDiseaseAnalysis]


class GeoLocation:
    """Geographical coordinates data."""

    def __init__(self, latitude: float = 0.0, longitude: float = 0.0):
        self.latitude = latitude
        self.longitude = longitude

    def __str__(self):
        return f"({self.latitude}, {self.longitude})"

    def to_dict(self):
        return {"latitude": self.latitude, "longitude": self.longitude}


class GeocodingService:
    """Service for geocoding location names to coordinates."""

    def __init__(self, api_key: str = None):
        """
        Initialize the geocoding service.

        Args:
            api_key: API key for the geocoding service (if required)
        """
        self.api_key = api_key

    def geocode(self, location: str) -> GeoLocation:
        """
        Convert a location name to geographical coordinates.

        Args:
            location: Name of the location to geocode

        Returns:
            GeoLocation object with latitude and longitude
        """
        # Skip geocoding for unknown locations
        if location.lower() == "unknown":
            return GeoLocation(0.0, 0.0)

        try:
            # Option 1: Using Nominatim (OpenStreetMap) - no API key required but rate limited
            response = requests.get(
                f"https://api.mapbox.com/geocoding/v5/mapbox.places/{location}.json",
                params={
                    "access_token": self.api_key,  # You'll need a Mapbox access token
                    "limit": 1,
                },
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("features"):
                    coordinates = data["features"][0]["center"]
                    return GeoLocation(
                        latitude=coordinates[1],  # Mapbox returns [lng, lat]
                        longitude=coordinates[0],
                    )

        except Exception as e:
            print(f"Geocoding error for {location}: {e}")
            return GeoLocation(0.0, 0.0)

    def batch_geocode(self, articles: List[ArticleResponse]) -> Dict[str, GeoLocation]:
        """
        Geocode multiple locations at once.

        Args:
            locations: List of location names to geocode

        Returns:
            Dictionary mapping location names to GeoLocation objects
        """
        results = {}

        # Create a unique set of locations to avoid redundant API calls
        unique_locations = set(
            [keyword.location for article in articles for keyword in article.data]
        )

        for location in unique_locations:
            results[location] = self.geocode(location)

        # Create a classes of GeoProcessedArticle for each article
        geo_processed_articles = []

        for article in articles:
            geo_disease_analysis = []
            for keyword in article.data:
                location = results[keyword.location]
                geo_disease_analysis.append(
                    GeoDiseaseAnalysis(
                        keyword=keyword.keyword,
                        location=keyword.location,
                        case_count=keyword.case_count,
                        latitude=location.latitude,
                        longitude=location.longitude,
                    )
                )
            geo_processed_articles.append(
                GeoProcessedArticle(
                    article_id=article.article_id,
                    is_valid_article=article.is_valid_article,
                    data=geo_disease_analysis,
                )
            )

        return geo_processed_articles
