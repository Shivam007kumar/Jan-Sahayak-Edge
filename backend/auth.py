"""
AWS Cognito JWT Authentication for Jan-Sahayak.
Decodes the ID token sent by the frontend, validates it against
Cognito's JWKS, and extracts the user_id (sub claim).
"""

import os
import json
import logging
import time
from typing import Optional
from functools import lru_cache

import requests
from jose import jwt, jwk, JWTError
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger("jan-sahayak")

# ── Config ──
COGNITO_REGION = os.getenv("COGNITO_REGION", os.getenv("AWS_DEFAULT_REGION", "ap-south-1"))
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID", "")

JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
ISSUER = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"

# FastAPI security scheme
security = HTTPBearer(auto_error=False)


# ── JWKS Cache ──
_jwks_cache = None
_jwks_cache_time = 0
JWKS_CACHE_TTL = 3600  # 1 hour


def _get_jwks() -> dict:
    """Fetch and cache the Cognito JWKS (JSON Web Key Set)."""
    global _jwks_cache, _jwks_cache_time

    if _jwks_cache and (time.time() - _jwks_cache_time) < JWKS_CACHE_TTL:
        return _jwks_cache

    try:
        response = requests.get(JWKS_URL, timeout=5)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cache_time = time.time()
        logger.info("✅ Cognito JWKS fetched and cached.")
        return _jwks_cache
    except Exception as e:
        logger.error(f"❌ Failed to fetch Cognito JWKS: {e}")
        if _jwks_cache:
            return _jwks_cache  # Return stale cache rather than crashing
        raise HTTPException(status_code=500, detail="Authentication service unavailable")


def _decode_token(token: str) -> dict:
    """Decode and validate a Cognito JWT ID token."""
    try:
        # Get the kid from the token header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        if not kid:
            raise JWTError("Token header missing 'kid'")

        # Find the matching key in JWKS
        jwks = _get_jwks()
        key = None
        for k in jwks.get("keys", []):
            if k["kid"] == kid:
                key = k
                break

        if not key:
            raise JWTError(f"Public key not found for kid: {kid}")

        # Decode and validate
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=COGNITO_APP_CLIENT_ID,
            issuer=ISSUER,
        )

        return payload

    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    """
    FastAPI dependency that extracts the user from the JWT.
    Returns guest session if no token is provided.
    """
    if not credentials:
        # Read the guest session ID from headers
        session_id = request.headers.get("X-Session-Id", "anonymous")
        return {"user_id": f"guest_{session_id[-8:]}", "phone": None}

    token = credentials.credentials
    payload = _decode_token(token)

    return {
        "user_id": payload.get("sub", "unknown"),
        "phone": payload.get("phone_number"),
        "email": payload.get("email"),
        "token_use": payload.get("token_use"),
    }


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Strict version — raises 401 if no token is provided.
    Use this for endpoints that absolutely need a logged-in user.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )

    token = credentials.credentials
    payload = _decode_token(token)

    return {
        "user_id": payload.get("sub", "unknown"),
        "phone": payload.get("phone_number"),
        "email": payload.get("email"),
    }
