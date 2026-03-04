"""
Session History Manager for Jan-Sahayak.
Stores and retrieves chat history from DynamoDB, keyed by user_id.
"""

import os
import time
import logging
from typing import List, Dict
from decimal import Decimal

import boto3

logger = logging.getLogger("jan-sahayak")

# ── DynamoDB Setup ──
SESSION_TABLE_NAME = "JanSahayakSessions"
_session_table = None


def _get_session_table():
    """Lazy-initialize the DynamoDB session table."""
    global _session_table
    if _session_table is not None:
        return _session_table

    try:
        dynamodb = boto3.resource(
            "dynamodb",
            region_name=os.getenv("AWS_DEFAULT_REGION", "ap-south-1"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        table = dynamodb.Table(SESSION_TABLE_NAME)
        table.load()  # Verify table exists
        _session_table = table
        logger.info(f"✅ DynamoDB session table '{SESSION_TABLE_NAME}' connected.")
        return _session_table
    except Exception as e:
        logger.warning(f"⚠️  Session table not available: {e}. History will be in-memory only.")
        return None


# ── In-memory fallback (for dev / when DynamoDB isn't set up) ──
_memory_store: Dict[str, List[dict]] = {}


def get_history(user_id: str, limit: int = 5) -> List[dict]:
    """
    Fetch the last N messages for a user.
    Returns list of { role: 'user'|'assistant', content: str, timestamp: int }
    """
    table = _get_session_table()

    if table:
        try:
            response = table.query(
                KeyConditionExpression=boto3.dynamodb.conditions.Key("user_id").eq(user_id),
                ScanIndexForward=False,  # Newest first
                Limit=limit,
            )
            items = response.get("Items", [])
            # Reverse so they're in chronological order
            items.reverse()
            return [
                {"role": item["role"], "content": item["content"], "timestamp": int(item["timestamp"])}
                for item in items
            ]
        except Exception as e:
            logger.warning(f"Failed to fetch session history: {e}")

    # Fallback to in-memory
    msgs = _memory_store.get(user_id, [])
    return msgs[-limit:]


def save_message(user_id: str, role: str, content: str) -> None:
    """
    Save a single message to the session history.
    role: 'user' or 'assistant'
    """
    timestamp = int(time.time() * 1000)  # epoch ms

    table = _get_session_table()
    if table:
        try:
            table.put_item(
                Item={
                    "user_id": user_id,
                    "timestamp": str(timestamp),  # DynamoDB table has timestamp as String (S) sort key
                    "role": role,
                    "content": content,
                }
            )
            return
        except Exception as e:
            logger.warning(f"Failed to save message to DynamoDB: {e}")

    # Fallback to in-memory
    if user_id not in _memory_store:
        _memory_store[user_id] = []
    _memory_store[user_id].append({
        "role": role,
        "content": content,
        "timestamp": timestamp,
    })


def get_full_history(user_id: str) -> List[dict]:
    """
    Fetch ALL messages for a user (for the /api/history endpoint).
    """
    table = _get_session_table()

    if table:
        try:
            response = table.query(
                KeyConditionExpression=boto3.dynamodb.conditions.Key("user_id").eq(user_id),
                ScanIndexForward=True,  # Oldest first (chronological)
            )
            items = response.get("Items", [])
            return [
                {"role": item["role"], "content": item["content"], "timestamp": int(item["timestamp"])}
                for item in items
            ]
        except Exception as e:
            logger.warning(f"Failed to fetch full history: {e}")

    return _memory_store.get(user_id, [])
