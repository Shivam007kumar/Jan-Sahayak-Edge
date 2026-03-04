"""
Live Search Tool for finding official government portals/links.
Strategy:
  1. First try to find application_url from Knowledge Base (via OpenSearch / SQLite).
  2. If not found, fall back to DuckDuckGo web search, filtering for .gov.in/.nic.in links.
  3. If both fail, return "URL_NOT_FOUND".
Uses tenacity for resilience on the DDG call.
"""

import logging
from tenacity import retry, stop_after_attempt, wait_fixed
from langchain_core.tools import tool

logger = logging.getLogger("jan-sahayak")


def _check_knowledge_base(scheme_name: str) -> str | None:
    """Check OpenSearch (or SQLite fallback) if there's a stored application URL."""
    try:
        from tools.opensearch_retriever import search_schemes_opensearch
        results = search_schemes_opensearch(scheme_name, top_k=1)
        if results:
            scheme = results[0]
            # Check common URL field names used in our knowledge base
            for field in ("application_url", "portal_url", "portal", "application_mode"):
                val = scheme.get(field, "")
                if val and val not in ("N/A", "null", "none", "", "Online / Offline", "Offline"):
                    # Only return if the value looks like an actual URL
                    if "http" in val.lower() or ".gov.in" in val.lower() or ".nic.in" in val.lower():
                        logger.info(f"🗄️  Found URL in Knowledge Base for '{scheme_name}': {val}")
                        return val
    except Exception as e:
        logger.warning(f"KB URL check failed: {e}")
    return None


import time

@retry(stop=stop_after_attempt(3), wait=wait_fixed(2))
def _search_ddg(query: str, max_results: int = 10) -> list[dict]:
    """Helper to perform the DuckDuckGo search with retry logic."""
    from duckduckgo_search import DDGS
    import time
    
    results = []
    try:
        # DDG is aggressively blocking the default DDGS() call right now.
        # Adding a minor sleep and using the 'lite' backend usually bypasses this.
        time.sleep(1)
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results, backend="lite"):
                results.append(r)
    except Exception as e:
        logger.warning(f"DuckDuckGo 'lite' backend failed: {e}. Trying 'html' backend.")
        time.sleep(2)
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results, backend="html"):
                results.append(r)
                
    return results


@tool
def find_official_link(scheme_name: str) -> str:
    """Find the official application link or portal for a given government scheme.
    Call this ONLY if the scheme details lack a valid application URL.
    Returns the official .gov.in or .nic.in URL, or 'URL_NOT_FOUND' if none exists."""

    # Step 1: Check Knowledge Base first (fast, no web call)
    kb_url = _check_knowledge_base(scheme_name)
    if kb_url:
        return kb_url

    # Step 2: Fall back to DuckDuckGo web search
    query = f"{scheme_name} official website application"
    logger.info(f"🔍 DDG live search for: {query}")

    try:
        results = _search_ddg(query, max_results=10)
    except Exception as e:
        logger.error(f"Live search completely failed: {e}")
        return "URL_NOT_FOUND"

    if not results:
        logger.warning(f"DDG returned 0 results for '{scheme_name}'")
        return "URL_NOT_FOUND"

    # Step 3: Filter strictly for government domains
    for result in results:
        url = result.get("href", "").lower()
        if ".gov.in" in url or ".nic.in" in url:
            logger.info(f"✅ DDG found gov link for '{scheme_name}': {url}")
            return url

    logger.warning(f"❌ No .gov.in/.nic.in link found for '{scheme_name}'")
    return "URL_NOT_FOUND"

