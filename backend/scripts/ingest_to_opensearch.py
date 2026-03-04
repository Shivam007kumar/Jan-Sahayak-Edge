"""
Ingest 1,564 schemes from knowledge.json into AWS OpenSearch Serverless.
Creates an index 'schemes' and bulk-indexes all scheme documents.

Usage:
    cd backend && source venv/bin/activate
    python scripts/ingest_to_opensearch.py
"""

import os
import json
import sys
from dotenv import load_dotenv

load_dotenv()

from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth
import boto3

# ── Config ──
OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "")
REGION = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")
INDEX_NAME = "schemes"

# Path to knowledge.json (project root)
KNOWLEDGE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "knowledge.json")


def get_opensearch_client():
    """Create an OpenSearch client with AWS SigV4 auth for Serverless."""
    credentials = boto3.Session(
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=REGION,
    ).get_credentials()

    auth = AWSV4SignerAuth(credentials, REGION, "aoss")

    host = OPENSEARCH_URL.replace("https://", "").replace("http://", "")

    client = OpenSearch(
        hosts=[{"host": host, "port": 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        pool_maxsize=20,
    )
    return client


def create_index(client):
    """Create the schemes index if it doesn't exist."""
    index_body = {
        "settings": {
            "index": {
                "number_of_shards": 2,
                "number_of_replicas": 0,
            }
        },
        "mappings": {
            "properties": {
                "name": {"type": "text", "analyzer": "standard"},
                "category": {"type": "keyword"},
                "description": {"type": "text", "analyzer": "standard"},
                "benefits": {"type": "text"},
                "required_docs": {"type": "text"},
                "eligibility_rules": {"type": "text"},
                "application_mode": {"type": "text"},
                "scheme_id": {"type": "keyword"},
            }
        }
    }

    if client.indices.exists(index=INDEX_NAME):
        print(f"⚠️  Index '{INDEX_NAME}' already exists. Deleting and recreating...")
        client.indices.delete(index=INDEX_NAME)

    client.indices.create(index=INDEX_NAME, body=index_body)
    print(f"✅ Index '{INDEX_NAME}' created.")


from opensearchpy import helpers

def ingest_schemes(client):
    """Bulk-index schemes using the bulk helper API."""
    with open(KNOWLEDGE_PATH, "r") as f:
        data = json.load(f)

    schemes = data if isinstance(data, list) else data.get("schemes", data.get("data", []))
    print(f"📦 Found {len(schemes)} schemes to bulk index.")

    actions = []
    for i, scheme in enumerate(schemes):
        doc = {
            "scheme_id": scheme.get("id", str(i)),
            "name": scheme.get("name", ""),
            "category": scheme.get("category", "General"),
            "description": scheme.get("description", ""),
            "benefits": json.dumps(scheme.get("benefits", []), ensure_ascii=False) if isinstance(scheme.get("benefits"), list) else str(scheme.get("benefits", "")),
            "required_docs": json.dumps(scheme.get("required_docs", []), ensure_ascii=False) if isinstance(scheme.get("required_docs"), list) else str(scheme.get("required_docs", "")),
            "eligibility_rules": json.dumps(scheme.get("eligibility_rules", {}), ensure_ascii=False) if isinstance(scheme.get("eligibility_rules"), dict) else str(scheme.get("eligibility_rules", "")),
            "application_mode": scheme.get("application_mode", "N/A"),
        }
        actions.append({
            "_index": INDEX_NAME,
            "_source": doc,
        })

    print("🚀 Sending bulk request...")
    try:
        success, failed = helpers.bulk(client, actions, request_timeout=60)
        print(f"✅ Bulk Ingestion complete: {success} indexed.")
    except Exception as e:
        print(f"❌ Bulk indexing failed: {e}")


if __name__ == "__main__":
    print(f"🔗 Connecting to OpenSearch: {OPENSEARCH_URL}")
    client = get_opensearch_client()

    create_index(client)
    ingest_schemes(client)
