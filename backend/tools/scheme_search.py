"""
SchemeSearchTool - Deterministic fuzzy text matching against AIKosh SQLite DB.
Zero hallucination. Matches user query keywords against scheme name/description via SQL.
"""

import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "jan_sahayak.db")

def _get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def search_schemes(query: str, top_k: int = 3) -> list[dict]:
    """
    Searches the SQLite database for schemes matching the query using LIKE. 
    Limits returned results to top_k to avoid blowing up the LLM context.
    """
    conn = _get_db_connection()
    c = conn.cursor()
    
    # We clean the query for a basic SQL LIKE search. 
    # For a production app at scale, this would be an FTS5 or pg_trgm index search.
    # Allow keywords >= 2 chars to keep short terms like 'PM', and take up to 5 keywords
    keywords = [k.strip() for k in query.split() if len(k) >= 2][:5]
    
    if not keywords:
        # Fallback if query is too short: return nothing so LLM politely says it doesn't know
        return []
        
    sql = "SELECT * FROM schemes WHERE "
    conditions = []
    params = []
    
    for kw in keywords:
        search_term = f"%{kw}%"
        conditions.append("(name LIKE ? OR description LIKE ? OR category LIKE ?)")
        params.extend([search_term, search_term, search_term])
        
    sql += " OR ".join(conditions) + f" LIMIT {top_k}"
    
    c.execute(sql, params)
    rows = c.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        scheme_dict = dict(r)
        # Parse the JSON fields back into lists/dicts
        scheme_dict["required_docs"] = json.loads(scheme_dict["required_docs_json"])
        scheme_dict["eligibility_rules"] = json.loads(scheme_dict["eligibility_rules_json"])
        # Remove raw json strings from output
        del scheme_dict["required_docs_json"]
        del scheme_dict["eligibility_rules_json"]
        
        # We assign an arbitrary score for compatibility with orchestrator.py
        results.append({"scheme": scheme_dict, "score": 1.0})
        
    return results

