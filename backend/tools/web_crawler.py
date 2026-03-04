import requests
from bs4 import BeautifulSoup
import json
import os
from typing import Dict, Any, Optional

from groq import Groq

# We'll use Groq to process the scraped text, mimicking Bedrock's processing flow.
MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true"
groq_client = None
if not MOCK_MODE:
    try:
        groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    except Exception:
        pass

def crawl_scheme_url(url: str) -> Optional[Dict[str, Any]]:
    """
    Crawls the provided URL, extracts text content, and uses an LLM
    to parse out the Scheme Name, Benefits, and Required Documents as JSON.
    """
    print(f"Crawler active: Fetching {url}")
    try:
        # 1. Fetch the raw HTML
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        # 2. Parse text with BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.extract()
            
        text = soup.get_text(separator=' ', strip=True)
        # Limiting text to avoid massive token usage
        truncated_text = text[:8000]

        # 3. LLM Extraction
        if MOCK_MODE or not groq_client:
            print("Running in MOCK_MODE / no groq client. Returning mock crawler data.")
            return {
                "scheme_name": "Mock Extracted Scheme",
                "benefits": "Rs. 10,000 yearly benefit.",
                "required_docs": ["aadhar_card", "bank_passbook"]
            }

        print("Processing crawled text with LLM...")
        system_prompt = (
            "You are an expert data extractor. Given the following text from a government website, "
            "extract the Scheme Name, Benefits, and Required Documents as a JSON object.\n"
            "The JSON must have this strict structure:\n"
            "{\n"
            "  \"scheme_name\": \"...\",\n"
            "  \"benefits\": \"...\",\n"
            "  \"required_docs\": [\"doc_slug_1\", \"doc_slug_2\"]\n"
            "}\n"
            "Normalize document names into technical slugs like 'aadhar_card', 'ration_card', 'caste_certificate', etc."
        )

        chat_completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Website Text:\n\n{truncated_text}"}
            ],
            temperature=0.1,
            max_tokens=500,
            response_format={"type": "json_object"}
        )

        response_text = chat_completion.choices[0].message.content
        parsed = json.loads(response_text)
        print(f"Crawler successfully extracted: {parsed['scheme_name']}")
        return parsed

    except Exception as e:
        print(f"Crawler failed on {url}: {e}")
        return None

if __name__ == "__main__":
    # Test execution
    res = crawl_scheme_url("https://pmkisan.gov.in/")
    print(json.dumps(res, indent=2))
