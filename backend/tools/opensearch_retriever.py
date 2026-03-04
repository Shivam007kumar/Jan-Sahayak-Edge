"""
OpenSearch Retriever Tool for LangChain.
Searches the 'schemes' index in AWS OpenSearch Serverless
and returns the top matching government schemes.
"""

import os
import json
import logging
from typing import Optional

from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth
import boto3

logger = logging.getLogger("jan-sahayak")

OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "")
REGION = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")
INDEX_NAME = "schemes"

_client: Optional[OpenSearch] = None


def _get_client() -> Optional[OpenSearch]:
    """Lazy-init the OpenSearch client with SigV4 auth."""
    global _client
    if _client is not None:
        return _client

    if not OPENSEARCH_URL:
        logger.warning("⚠️  OPENSEARCH_URL not set. Retriever disabled.")
        return None

    try:
        credentials = boto3.Session(
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=REGION,
        ).get_credentials()

        auth = AWSV4SignerAuth(credentials, REGION, "aoss")
        host = OPENSEARCH_URL.replace("https://", "").replace("http://", "")

        _client = OpenSearch(
            hosts=[{"host": host, "port": 443}],
            http_auth=auth,
            use_ssl=True,
            verify_certs=True,
            connection_class=RequestsHttpConnection,
            pool_maxsize=10,
        )
        logger.info("✅ OpenSearch retriever client initialized.")
        return _client
    except Exception as e:
        logger.error(f"❌ OpenSearch client init failed: {e}")
        return None


def search_schemes_opensearch(query: str, top_k: int = 3) -> list[dict]:
    """
    Search OpenSearch for schemes matching the query.
    Returns a list of scheme dicts with name, category, description, etc.
    Falls back to SQLite if OpenSearch is unavailable.
    """
    client = _get_client()
    if not client:
        # Fallback to existing SQLite search
        from tools.scheme_search import search_schemes
        results = search_schemes(query, top_k=top_k)
        return [r["scheme"] for r in results]

    try:
        body = {
            "size": top_k,
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["name^3", "description^2", "category", "benefits"],
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                }
            }
        }

        response = client.search(index=INDEX_NAME, body=body)
        hits = response.get("hits", {}).get("hits", [])

        results = []
        for hit in hits:
            source = hit["_source"]
            # Parse JSON strings back to lists/dicts
            try:
                source["required_docs"] = json.loads(source.get("required_docs", "[]"))
            except (json.JSONDecodeError, TypeError):
                source["required_docs"] = []
            try:
                source["benefits"] = json.loads(source.get("benefits", "[]"))
            except (json.JSONDecodeError, TypeError):
                pass
            try:
                source["eligibility_rules"] = json.loads(source.get("eligibility_rules", "{}"))
            except (json.JSONDecodeError, TypeError):
                pass

            source["id"] = source.get("scheme_id", hit["_id"])
            source["score"] = hit.get("_score", 0)
            results.append(source)

        logger.info(f"🔍 OpenSearch returned {len(results)} results for '{query}'")
        return results

    except Exception as e:
        logger.warning(f"OpenSearch search failed: {e}. Falling back to SQLite.")
        from tools.scheme_search import search_schemes
        results = search_schemes(query, top_k=top_k)
        return [r["scheme"] for r in results]
