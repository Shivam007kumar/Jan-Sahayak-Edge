import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "jan_sahayak.db")

def get_db_connection():
    """Returns a connected SQLite DB connection with dictionary row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the SQLite schema."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS schemes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT,
            target_audience TEXT,
            description TEXT,
            benefits TEXT,
            required_docs_json TEXT,
            eligibility_rules_json TEXT,
            application_mode TEXT
        )
    ''')
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("✅ Database initialized at", DB_PATH)
