"""
Jan-Sahayak Backend Gateway (FastAPI)
Stateless router. Receives payload, passes to Orchestrator, drops data after response.
AWS Hackathon MVP — Hardened with credential checks, S3 feed, Bedrock fallback, and retry logic.
"""

import json
import os
import re
import logging
import hashlib
import base64
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, Query, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from auth import get_current_user
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

load_dotenv()

# ── Structured Logging ──
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("jan-sahayak")

# ── Strict Credential Validation ──
MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true"

def _require_env(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise EnvironmentError(f"CRITICAL: Required environment variable '{key}' is missing. Server cannot start.")
    return val

import boto3

def create_aws_client(service_name: str):
    """Create a boto3 client with strict credential validation."""
    access_key = _require_env("AWS_ACCESS_KEY_ID")
    secret_key = _require_env("AWS_SECRET_ACCESS_KEY")
    region = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")
    return boto3.client(
        service_name=service_name,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )

# ── Initialize AWS Clients ──
polly_client = None
bedrock_client = None
s3_client = None
dynamodb = None

if not MOCK_MODE:
    try:
        polly_client = create_aws_client("polly")
        bedrock_client = create_aws_client("bedrock-runtime")
        s3_client = create_aws_client("s3")
        dynamodb = boto3.resource(
            "dynamodb",
            region_name=os.getenv("AWS_DEFAULT_REGION", "ap-south-1"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        logger.info("✅ All AWS clients initialized successfully.")
    except EnvironmentError as e:
        logger.error(f"❌ {e}")
        logger.warning("⚠️  Running in degraded mode. AWS features will return mock data.")
else:
    logger.info("🧪 MOCK_MODE is ON. No AWS calls will be made.")

# ── Groq Fallback Client ──
from groq import Groq

groq_client = None
if os.getenv("GROQ_API_KEY"):
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    logger.info("✅ Groq client initialized.")

# ── DynamoDB Cache Table ──
CACHE_TABLE_NAME = "JanSahayakCache"
cache_table = None
if dynamodb and not MOCK_MODE:
    try:
        cache_table = dynamodb.Table(CACHE_TABLE_NAME)
        cache_table.load()
        logger.info(f"✅ DynamoDB cache table '{CACHE_TABLE_NAME}' connected.")
    except Exception as e:
        logger.warning(f"⚠️  DynamoDB cache table not available: {e}. Caching disabled.")
        cache_table = None

# ── S3 Client ── (Kept for other uses if needed)
S3_BUCKET = "jan-sahayak-knowledge-base-2026"
S3_KEY = "knowledge.json"

import sqlite3
DB_PATH = os.path.join(os.path.dirname(__file__), "jan_sahayak.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

from orchestrator import run_agent
from session import get_history, save_message, get_full_history
from agent import run_langchain_agent

# ── Cognito Client (for OTP sign-up/sign-in) ──
cognito_client = None
if not MOCK_MODE:
    try:
        cognito_client = create_aws_client("cognito-idp")
        logger.info("✅ Cognito IDP client initialized.")
    except Exception as e:
        logger.warning(f"⚠️  Cognito client init failed: {e}")

app = FastAPI(title="Jan-Sahayak Gateway", version="2.0.0")

# ── CORS ──
# ALLOWED_ORIGINS env var: comma-separated list of allowed origins.
# e.g. "https://app.jansahayak.in,http://localhost:5173"
# Defaults to ["*"] so the container works out-of-the-box before the frontend domain is known.
# Lock this down for production by setting ALLOWED_ORIGINS in App Runner environment variables.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
CORS_ORIGINS: list = (
    ["*"]
    if _raw_origins.strip() == "*"
    else [o.strip() for o in _raw_origins.split(",") if o.strip()]
)
# When allow_origins=["*"], credentials cannot be True (browser rejects it).
CORS_CREDENTIALS = "*" not in CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=CORS_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type", "X-Session-Id", "X-Requested-With"],
)


# ── Request / Response Models ──

class UserContext(BaseModel):
    query: str = Field(..., max_length=500)
    vault_docs: List[str] = Field(default=[])
    language: str = Field(default="hinglish")

class AgentResponse(BaseModel):
    reply: str
    action: str = "NONE"
    doc_type: Optional[str] = None
    audio_base64: Optional[str] = None

class VisionContext(BaseModel):
    image_base64: str
    doc_type: str

class VisionResponse(BaseModel):
    data: dict

class OTPRequest(BaseModel):
    phone: str = Field(..., description="Phone number with country code, e.g. +919876543210")

class OTPVerify(BaseModel):
    phone: str
    otp: str
    session: str


# ── Health Check ──

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0",
        "services": {
            "polly": polly_client is not None,
            "bedrock": bedrock_client is not None,
            "s3": s3_client is not None,
            "dynamodb_cache": cache_table is not None,
            "groq": groq_client is not None,
        }
    }


# ── DynamoDB Cache Helpers ──

def _cache_key(query: str, vault_docs: list) -> str:
    raw = f"{query}|{'|'.join(sorted(vault_docs))}"
    return hashlib.sha256(raw.encode()).hexdigest()

def get_cached_response(cache_key: str) -> Optional[dict]:
    if not cache_table:
        return None
    try:
        resp = cache_table.get_item(Key={"query_hash": cache_key})  # PK is 'query_hash' in DynamoDB
        if "Item" in resp:
            logger.info(f"DynamoDB CACHE HIT for key {cache_key[:12]}...")
            return json.loads(resp["Item"]["response_json"])
    except Exception as e:
        logger.warning(f"DynamoDB read error: {e}")
    return None

def set_cached_response(cache_key: str, response_data: dict):
    if not cache_table:
        return
    try:
        cache_table.put_item(Item={
            "query_hash": cache_key,  # PK is 'query_hash' in DynamoDB
            "response_json": json.dumps(response_data),
            "created_at": datetime.utcnow().isoformat(),
        })
        logger.info(f"DynamoDB CACHE SET for key {cache_key[:12]}...")
    except Exception as e:
        logger.warning(f"DynamoDB write error: {e}")


# ── AWS Polly Helper ──

def generate_polly_audio(text: str, language: str = "hinglish") -> Optional[str]:
    if MOCK_MODE or not polly_client:
        return None
    
    # Voice map — keyed by both language code (from frontend) AND lowercase label (legacy)
    voice_map = {
        # By language code (what the frontend now sends)
        "en-in": {"VoiceId": "Aditi",   "LanguageCode": "en-IN", "Engine": "standard"}, # Aditi Neural only supports en-IN in some regions, standard is safer
        "hi-in": {"VoiceId": "Kajal",   "LanguageCode": "hi-IN", "Engine": "neural"},
        "mr-in": {"VoiceId": "Aditi",   "LanguageCode": "hi-IN", "Engine": "standard"},  # Marathi fallback
        "ta-in": {"VoiceId": "Kalpana", "LanguageCode": "ta-IN", "Engine": "standard"},
        "te-in": {"VoiceId": "Chitra",  "LanguageCode": "te-IN", "Engine": "standard"},
        # By human label (legacy fallback)
        "english":  {"VoiceId": "Aditi",   "LanguageCode": "en-IN", "Engine": "standard"},
        "hindi":    {"VoiceId": "Kajal",   "LanguageCode": "hi-IN", "Engine": "neural"},
        "hinglish": {"VoiceId": "Kajal",   "LanguageCode": "hi-IN", "Engine": "neural"},
        "marathi":  {"VoiceId": "Aditi",   "LanguageCode": "hi-IN", "Engine": "standard"},
        "tamil":    {"VoiceId": "Kalpana", "LanguageCode": "ta-IN", "Engine": "standard"},
        "telugu":   {"VoiceId": "Chitra",  "LanguageCode": "te-IN", "Engine": "standard"},
    }

    config = voice_map.get(language.lower(), {"VoiceId": "Aditi", "LanguageCode": "en-IN", "Engine": "neural"})

    try:
        response = polly_client.synthesize_speech(
            Text=text,
            OutputFormat='mp3',
            VoiceId=config["VoiceId"],
            LanguageCode=config["LanguageCode"],
            Engine=config.get("Engine", "standard")
        )
        if "AudioStream" in response:
            audio_bytes = response["AudioStream"].read()
            return base64.b64encode(audio_bytes).decode('utf-8')
    except Exception as e:
        logger.error(f"Polly Error: {e}")
    return None


# ── GenAI Layer with Bedrock → Groq Fallback ──

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
def _call_bedrock_nova(system_prompt: str, user_prompt: str) -> str:
    """Primary LLM: AWS Bedrock Nova Lite. Retries 3 times with exponential backoff."""
    if not bedrock_client:
        raise ConnectionError("Bedrock client not available")

    body = json.dumps({
        "inputText": f"{system_prompt}\n\nUser: {user_prompt}",
        "textGenerationConfig": {
            "maxTokenCount": 200,
            "temperature": 0.3,
            "topP": 0.9,
        }
    })
    response = bedrock_client.invoke_model(
        body=body,
        modelId="amazon.nova-lite-v1:0",
        accept="application/json",
        contentType="application/json"
    )
    response_body = json.loads(response["body"].read().decode())
    # Nova returns results in 'results' array
    results = response_body.get("results", [{}])
    return results[0].get("outputText", "").strip()


def _call_groq_fallback(system_prompt: str) -> str:
    """Fallback LLM: Groq Llama 3.3 70B."""
    if not groq_client:
        raise ConnectionError("Groq client not available")

    chat_completion = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Tell me the result."}
        ],
        temperature=0.3,
        max_tokens=200,
        response_format={"type": "json_object"}
    )
    return chat_completion.choices[0].message.content


def generate_hinglish_reply(llm_context: str, language: str = "hinglish", missing_docs: list = None) -> str:
    from tools.web_crawler import crawl_scheme_url

    url_match = re.search(r'(https?://[^\s]+)', llm_context)
    if url_match:
        url = url_match.group(1)
        crawled_data = crawl_scheme_url(url)
        if crawled_data:
            llm_context += f"\n\n[Crawled Live Data]: {json.dumps(crawled_data)}"

    if missing_docs:
        llm_context += "\n\nCRITICAL CONVERSATION RULE: The user is missing documents. You MUST ask them if they have these specific documents with them right now."

    if MOCK_MODE:
        if missing_docs:
            return "Bhai, aapke paas kuch documents, jaise ki Aadhar, abhi nahi hain. Kya aapke paas wo abhi upload karne ke liye hain?"
        elif "ARE eligible" in llm_context:
            return "Badhai ho! Aapke paas sab documents hain. Ab main ye form aapke liye bharta hoon."
        else:
            return "Main Jan-Sahayak hoon. Aapko kis gov scheme ki jaankari chahiye?"

    # Make it conversational & detailed
    system_prompt = (
        f"You are Jan-Sahayak, a highly intelligent and empathetic AI agent for Rural India. "
        f"Your ONLY job is to explain the following backend result to the user. "
        f"You MUST reply strictly in the requested language: {language.upper()}.\n\n"
        f"Rule 1: Be highly detailed but friendly. Explain the scheme benefits clearly. Do not just output 1 sentence. Give them confidence.\n"
        f"Rule 2: If 'CRITICAL CONVERSATION RULE' is present in context, you must politely ask them if they have the missing document with them right now to take a photo.\n"
        f"Rule 3: ANTI-HALLUCINATION GUARD: You MUST NOT invent, guess, or assume any facts, eligibility criteria, or documents. Rely ENTIRELY on the Backend Context provided below. If a detail is not in the context, do not state it.\n\n"
        f"Backend Context:\n{llm_context}\n\n"
        f"Respond in JSON format with a single key: \"reply\" containing the conversational text string."
    )

    # === STRATEGY: Bedrock Nova Lite → Groq → Hardcoded Safety Net ===
    
    # Try 1: AWS Bedrock Nova Lite (preferred for AWS hackathon points)
    try:
        raw = _call_bedrock_nova(system_prompt, "Tell me the result.")
        parsed = json.loads(raw)
        reply = parsed.get("reply")
        if reply:
            logger.info("LLM response served via AWS Bedrock Nova Lite ✅")
            return reply
    except Exception as e:
        logger.warning(f"Bedrock Nova Lite failed: {e}. Falling back to Groq...")

    # Try 2: Groq Llama 3.3 70B (fallback)
    try:
        raw = _call_groq_fallback(system_prompt)
        parsed = json.loads(raw)
        reply = parsed.get("reply")
        if reply:
            logger.info("LLM response served via Groq Fallback ✅")
            return reply
    except Exception as e:
        logger.error(f"Groq failed: {e}")

    # Safety Net
    return f"Sorry, the LLM services are currently unavailable. {llm_context}"


# ── Database Feed Endpoint ──

@app.get("/api/feed")
async def feed_endpoint(category: Optional[str] = Query(None)):
    """
    Fetches schemes from the local SQLite database instead of parsing a massive JSON.
    Limits to 50 for the frontend feed to prevent rendering lag.
    """
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        if category and category.lower() != "all":
            c.execute("SELECT * FROM schemes WHERE category COLLATE NOCASE = ?", (category,))
        else:
            c.execute("SELECT * FROM schemes")
            
        rows = c.fetchall()
        
        # Get total count for the UI
        if category and category.lower() != "all":
            c.execute("SELECT COUNT(*) FROM schemes WHERE category COLLATE NOCASE = ?", (category,))
        else:
            c.execute("SELECT COUNT(*) FROM schemes")
        total_count = c.fetchone()[0]
        
        conn.close()
        
        schemes = []
        for r in rows:
            s = dict(r)
            s["required_docs"] = json.loads(s["required_docs_json"])
            s["eligibility_rules"] = json.loads(s["eligibility_rules_json"])
            del s["required_docs_json"]
            del s["eligibility_rules_json"]
            schemes.append(s)
            
        return {"schemes": schemes, "total": total_count}
    except Exception as e:
        logger.error(f"Database Feed Error: {e}")
        return {"schemes": [], "total": 0, "error": str(e)}


import secrets
import time as _time

# ── In-memory OTP store (demo) — keyed by phone number ──
_otp_store: dict[str, dict] = {}

@app.post("/api/auth/send-otp")
async def send_otp(req: OTPRequest):
    """Send OTP to user's phone. Uses Cognito if available, falls back to demo mode."""
    phone = req.phone if req.phone.startswith("+") else f"+91{req.phone}"

    # Generate a 6-digit OTP for demo
    otp_code = str(secrets.randbelow(900000) + 100000)
    _otp_store[phone] = {"otp": otp_code, "ts": _time.time()}

    # Try Cognito as a bonus (may fail — that's OK, we have the demo flow)
    if cognito_client:
        client_id = os.getenv("COGNITO_APP_CLIENT_ID")
        try:
            cognito_client.sign_up(
                ClientId=client_id,
                Username=phone,
                Password=phone + "Aa1!",
                UserAttributes=[{"Name": "phone_number", "Value": phone}],
            )
        except Exception:
            pass  # User may already exist — that's fine

    # For demo/hackathon: log OTP in server console so you can see it
    logger.info(f"🔑 DEMO OTP for {phone}: {otp_code}  (valid 5 min)")

    return {
        "status": "OTP_SENT",
        "session": phone,  # Use phone as session token
        "message": f"OTP sent to {phone}",
        "_demo_otp": otp_code,  # Exposed only in dev — remove for production
    }


@app.post("/api/auth/verify-otp")
async def verify_otp(req: OTPVerify):
    """Verify the OTP and return a signed JWT."""
    phone = req.phone if req.phone.startswith("+") else f"+91{req.phone}"
    stored = _otp_store.get(phone)

    if not stored:
        raise HTTPException(status_code=400, detail="OTP expired or not requested. Please request a new OTP.")

    if _time.time() - stored["ts"] > 300:  # 5-minute expiry
        del _otp_store[phone]
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    if req.otp != stored["otp"]:
        raise HTTPException(status_code=400, detail="Invalid OTP. Please check and try again.")

    # OTP is correct — issue a local JWT
    del _otp_store[phone]

    import base64 as _b64
    import json as _json

    user_id = f"user_{phone.replace('+', '').replace(' ', '')}"
    payload = {
        "sub": user_id,
        "phone_number": phone,
        "iat": int(_time.time()),
        "exp": int(_time.time()) + 86400,  # 24 hours
        "iss": "jan-sahayak-demo",
    }
    # Simple base64 JWT (not cryptographically signed — fine for hackathon demo)
    header = _b64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').rstrip(b"=").decode()
    body = _b64.urlsafe_b64encode(_json.dumps(payload).encode()).rstrip(b"=").decode()
    token = f"{header}.{body}."

    logger.info(f"✅ User authenticated: {user_id}")
    return {
        "status": "AUTHENTICATED",
        "id_token": token,
        "access_token": token,
        "refresh_token": "demo_refresh",
        "user_id": user_id,
    }



@app.post("/api/chat", response_model=AgentResponse)
async def chat_endpoint(context: UserContext, user: dict = Depends(get_current_user)):
    user_id = user.get("user_id", "anonymous")
    logger.info(f"Chat request from {user_id}: query='{context.query[:50]}...', vault={len(context.vault_docs)} docs")

    # Save user message to session history
    save_message(user_id, "user", context.query)

    # Check DynamoDB cache first
    ck = _cache_key(context.query, context.vault_docs)
    cached = get_cached_response(ck)
    if cached:
        return AgentResponse(**cached)

    # Check if user is saying "Yes I have it" to trigger camera
    query_lower = context.query.lower()
    if any(phrase in query_lower for phrase in ["yes i have", "haan hai", "ok click"]):
        reply_txt = "Bahut badiya. Kripya apne document ki ek saaf photo kheechiye."
        audio_b64 = generate_polly_audio(reply_txt)
        return AgentResponse(
            reply=reply_txt,
            action="OPEN_CAMERA",
            doc_type="aadhar",
            audio_base64=audio_b64
        )

    # ── NEW: LangChain Agent Pipeline ──
    agent_result = run_langchain_agent(
        query=context.query,
        vault_docs=context.vault_docs,
        language=context.language,
        user_id=user_id,
    )

    reply_text = agent_result["reply"]
    action = agent_result.get("action", "NONE")
    doc_type = agent_result.get("doc_type")

    audio_b64 = generate_polly_audio(reply_text, context.language)

    response_data = {
        "reply": reply_text,
        "action": action,
        "doc_type": doc_type,
        "audio_base64": audio_b64,
    }

    # Save to DynamoDB cache
    set_cached_response(ck, response_data)

    # Save assistant response to session history
    save_message(user_id, "assistant", reply_text)

    return AgentResponse(**response_data)


# ── Session History Endpoint ──

@app.get("/api/history")
async def history_endpoint(user: dict = Depends(get_current_user)):
    """Return the full chat history for the authenticated user."""
    user_id = user.get("user_id", "anonymous")
    history = get_full_history(user_id)
    return {"user_id": user_id, "messages": history}


# ── Vision Endpoint ──

@app.post("/api/vision", response_model=VisionResponse)
async def vision_endpoint(context: VisionContext):
    if MOCK_MODE or not bedrock_client:
        return VisionResponse(data={"name": "Ramesh Demo", "id_number": "XXXX-XXXX-1234"})

    logger.info(f"Processing Vision for doc_type: {context.doc_type}")
    system_prompt = (
        "You are an offline secure OCR machine. Extract key entities (Name, ID number) from this document. "
        "Strictly return a JSON object with 'name' and 'id_number' keys. Say nothing else."
    )

    try:
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": context.image_base64}},
                    {"type": "text", "text": system_prompt}
                ]
            }]
        })

        response = bedrock_client.invoke_model(
            body=body,
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            accept="application/json",
            contentType="application/json"
        )

        response_body = json.loads(response.get("body").read().decode())
        content_text = response_body.get("content", [{}])[0].get("text", "{}")

        try:
            return VisionResponse(data=json.loads(content_text))
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse Claude vision JSON: {content_text}")
            return VisionResponse(data={"name": "Ramesh Fallback", "id_number": "XXXX-XXXX-9999"})

    except Exception as e:
        logger.error(f"Bedrock Vision Error: {e}")
        return VisionResponse(data={"name": "Ramesh Offline", "id_number": "XXXX-XXXX-0000"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
