import spacy
from spacy.matcher import Matcher
import geopy.distance
from geopy.geocoders import Nominatim
import re

geolocator = Nominatim(user_agent="Disease-Location-Extraction")

nlp = spacy.load("en_core_web_trf")

matcher = Matcher(nlp.vocab)


disease_keyword = "dengue fever"

# Define patterns for locations (adjust based on needs)
location_patterns = [
    [{"POS": "PROPN"}],  # Single proper noun
    [{"POS": "NOUN"}, {"POS": "PROPN"}],  # Noun followed by proper noun
]

matcher.add("LOCATION", location_patterns)

def find_disease_location(text):
  doc = nlp(text)

  # Find disease mentions
  # Use regex to find disease mentions
  disease_matches = [(m.start(), m.end()) for m in re.finditer(disease_keyword, text, re.IGNORECASE)]
  # Find locations near disease mentions
  locations = []
  sentences = list(doc.sents)
  for disease_start, disease_end in disease_matches:
    matches = matcher(doc)
    for match_id, start, end in matches:
      # Check if location is within a sentence of the disease
      if abs(start - disease_start) <= sentences[disease_start].end - disease_start:
        location_text = doc[start:end].text
        locations.append(location_text)

  return locations
        

#   Add geocoding if desired
#   for location_text in locations:
#     location = geolocator.geocode(location_text)
#     if location:
#       print(f"  - {location.address}: {location.latitude}, {location.longitude}")

  return locations

# Example usage



# news_text = """The World Health Organization (WHO) has issued a warning about the increasing number of dengue fever cases in Southeast Asia. The Philippines, Vietnam, and Thailand have all reported a significant rise in infections in recent months. Dengue fever is a mosquito-borne viral disease that can cause a severe illness, including fever, headache, muscle and joint pain, and rash. In severe cases, it can lead to internal bleeding, shock, and death.

# The increase in dengue fever cases is attributed to several factors, including the rainy season, which creates ideal breeding grounds for mosquitoes, and the lack of access to clean water and sanitation in some areas. Additionally, the virus has become more resistant to insecticides, making it more difficult to control.

# WHO is urging countries in the region to take steps to prevent the spread of dengue fever, such as promoting mosquito control measures, improving access to clean water and sanitation, and raising awareness of the disease among the public."""
# locations = find_disease_location(news_text)


# if locations:
#   print(f"Disease: {disease_keyword}")
#   print(f"Locations: {', '.join(locations)}")
# else:
#   print(f"No mention of {disease_keyword} found.")





disease_keywords = ['covid', 'cancer', 'malaria']  # add more diseases as needed

# Your text
text = """
The global health community was taken aback last week when a new case of covid was reported in New York. 
This comes after several months of no reported cases in the city. Health officials are working tirelessly to trace the source of the infection and contain its spread.

In other news, cancer rates are on the rise in London. The city has seen a 20% increase in cancer cases over the past year. 
Health experts attribute this increase to a variety of factors, including lifestyle changes and environmental factors.

Meanwhile, in Sydney, there is good news. Malaria, which was once a major health concern in the city, has been eradicated. 
This is a major victory for public health in Sydney and sets a precedent for other cities to follow.

However, the situation is not so rosy in Delhi. The city has been grappling with a surge in dengue cases. 
Health officials are urging residents to take precautions to prevent the spread of the disease.

In Tokyo, a rare case of bird flu has been reported. The patient is in stable condition and health officials are monitoring the situation closely.

Lastly, in Johannesburg, there has been a significant increase in tuberculosis cases. 
The city's health department is working on a comprehensive plan to tackle the disease.
"""

# Tokenize the text into sentences
def find_disease_locations(text, disease_keywords):
    # Load the Spacy model

    # Split the text into paragraphs
    paragraphs = text.split('\n\n')

    # List to store the disease and its location
    disease_locations = []

    for paragraph in paragraphs:
        # Process the paragraph
        doc = nlp(paragraph)

        # Check if any disease keyword is in the paragraph
        if any(disease in doc.text.lower() for disease in disease_keywords):
            # Use Spacy's NER to find any GPE in the paragraph
            for ent in doc.ents:
                if ent.label_ == 'GPE':
                    # Store the disease and its location
                    disease_locations.append((doc.text, ent.text))

    return disease_locations

for disease_location in find_disease_locations(text, disease_keywords):
    print(f"Disease Mention: {disease_location[0]} \nLocation: {disease_location[1]}\n")