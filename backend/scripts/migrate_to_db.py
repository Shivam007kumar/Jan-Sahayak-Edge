import sqlite3
import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import init_db, get_db_connection

def migrate_json_to_db(json_path: str):
    print(f"Loading data from {json_path}...")
    with open(json_path, 'r', encoding='utf-8') as f:
        raw = json.load(f)
        
    schemes = raw.get("schemes", []) if isinstance(raw, dict) else raw
    count = len(schemes)
    print(f"Found {count} schemes to migrate.")
    
    init_db()
    conn = get_db_connection()
    c = conn.cursor()
    
    inserted = 0
    for s in schemes:
        try:
            req_docs = json.dumps(s.get("required_docs", []))
            elig_rules = json.dumps(s.get("eligibility_rules", {}))
            
            c.execute('''
                INSERT OR REPLACE INTO schemes 
                (id, name, category, target_audience, description, benefits, required_docs_json, eligibility_rules_json, application_mode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                s.get("id"),
                s.get("name"),
                s.get("category", "Uncategorized"),
                s.get("target_audience", "General Public"),
                s.get("description", ""),
                s.get("benefits", ""),
                req_docs,
                elig_rules,
                s.get("application_mode", "Online/Offline")
            ))
            inserted += 1
        except Exception as e:
            print(f"Error inserting scheme {s.get('id')}: {e}")
            
    conn.commit()
    conn.close()
    print(f"✅ Successfully inserted/updated {inserted} schemes into the database.")

if __name__ == "__main__":
    target_json = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "knowledge.json")
    migrate_json_to_db(target_json)
