"""
Jan-Sahayak LangChain Agent — The Brain.
Uses LangChain v1.2+ create_agent API (LangGraph-based)
with tools (OpenSearch retriever, Eligibility checker, Form guidance)
and conversational memory from DynamoDB session history.
"""

import os
import json
import logging
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.prebuilt import create_react_agent as create_agent

from tools.opensearch_retriever import search_schemes_opensearch
from tools.eligibility_checker import check_eligibility
from tools.form_guidance import get_form_guidance
from tools.live_search import find_official_link
from session import get_history

logger = logging.getLogger("jan-sahayak")


# ── LangChain Tools ──

@tool
def scheme_search(query: str) -> str:
    """Search for Indian government schemes matching the user's query.
    Use this tool when the user asks about a specific scheme
    or wants to know which schemes they are eligible for.
    Returns scheme details including name, category, benefits, and required documents."""

    results = search_schemes_opensearch(query, top_k=3)

    if not results:
        return "No matching government schemes found for this query."

    output = []
    for i, scheme in enumerate(results, 1):
        docs = scheme.get("required_docs", [])
        if isinstance(docs, str):
            try:
                docs = json.loads(docs)
            except:
                docs = [docs]

        benefits = scheme.get("benefits", [])
        if isinstance(benefits, str):
            try:
                benefits = json.loads(benefits)
            except:
                benefits = [benefits]

        output.append(
            f"--- Scheme {i} ---\n"
            f"Name: {scheme.get('name', 'N/A')}\n"
            f"Category: {scheme.get('category', 'N/A')}\n"
            f"Description: {scheme.get('description', 'N/A')}\n"
            f"Benefits: {', '.join(benefits) if isinstance(benefits, list) else str(benefits)}\n"
            f"Required Documents: {', '.join(docs) if isinstance(docs, list) else str(docs)}\n"
            f"Application Mode: {scheme.get('application_mode', 'N/A')}\n"
        )

    return "\n".join(output)


@tool
def check_documents(scheme_name: str, user_vault_docs: str) -> str:
    """ALWAYS call this tool when the user asks about eligibility, documents, or 'Am I eligible?'.
    NEVER ask the user if they are eligible — compute it yourself using this tool.
    Pass the scheme name and a comma-separated list of document keys the user has.
    Returns a decisive ELIGIBLE or NOT ELIGIBLE conclusion."""

    vault_list = [d.strip() for d in user_vault_docs.split(",") if d.strip()]

    results = search_schemes_opensearch(scheme_name, top_k=1)
    if not results:
        return f"RESULT: SCHEME NOT FOUND for '{scheme_name}'. Try a broader scheme name."

    scheme = results[0]
    eligibility = check_eligibility(scheme, vault_list)

    if eligibility["eligible"]:
        conclusion = f"RESULT: ELIGIBLE. User has all required documents for {scheme['name']}."
        if eligibility.get("manual_required"):
            conclusion += f" However, they must also provide: {', '.join(eligibility['manual_required'])} (not in vault, must be arranged)."
    else:
        missing = eligibility.get("vault_missing", [])
        has_count = len(eligibility.get("has_docs", []))
        total = eligibility.get("total_required", 0)
        conclusion = (
            f"RESULT: NOT ELIGIBLE. Missing documents for {scheme['name']}: {', '.join(missing)}. "
            f"User has {has_count}/{total} required documents."
        )

    return conclusion


@tool
def get_application_steps(scheme_name: str) -> str:
    """Get the step-by-step application process for a government scheme.
    Returns how to apply (online/offline), required steps, and official portal info."""

    results = search_schemes_opensearch(scheme_name, top_k=1)
    if not results:
        return f"Could not find scheme: {scheme_name}"

    scheme = results[0]
    guidance = get_form_guidance(scheme)

    return (
        f"Application Mode: {guidance.get('application_mode', 'N/A')}\n"
        f"Steps: {json.dumps(guidance.get('steps', []), ensure_ascii=False)}\n"
        f"Portal: {guidance.get('portal', 'N/A')}"
    )


# ── System Prompt ──

SYSTEM_PROMPT = """You are Jan-Sahayak (जन-सहायक), an empathetic AI assistant helping Indians apply for government welfare schemes.

┌─ RULE 1: LANGUAGE MIRRORING (MANDATORY) ─────────────────────────────────┐
You MUST reply in the SAME LANGUAGE as the user's last message.
  - English message   → Reply in professional English ONLY.
  - Hindi/Hinglish    → Reply in friendly Hinglish ONLY.
  - Marathi           → Reply in Marathi ONLY.
If the [SYSTEM] tag says "Language: english" → DO NOT use Hindi words. Zero Hindi.
Do not mix languages unless the user mixes them first.
└────────────────────────────────────────────────────────────┘

┌─ RULE 2: CONTEXT LOCK ───────────────────────────────────────┐
Read the FULL Chat History before responding.
Identify the LAST SCHEME that was discussed. Call it the "Active Scheme".
When the user says 'it', 'this', 'the link', 'apply for it', 'am I eligible', 'give me the link':
  → They are referring to the Active Scheme. DO NOT ask "Which scheme?".
  → Use the Active Scheme name directly in your tool calls.
Only reset the Active Scheme if the user explicitly names a DIFFERENT scheme.
└────────────────────────────────────────────────────────────┘

┌─ RULE 3: ELIGIBILITY ──────────────────────────────────────┐
NEVER ask the user "Are you eligible?" or "Do you have the documents?".
Always call `check_documents(scheme_name, vault_docs)` yourself and report the RESULT.
Then give a direct answer: "You ARE eligible" or "You need: [X, Y, Z]".
└────────────────────────────────────────────────────────────┘

┌─ RULE 4: LINK / APPLY ──────────────────────────────────────┐
When the user asks for a link / "apply karo" / "give me the link":
  1. Identify Active Scheme from context (Rule 2).
  2. Call `get_application_steps(scheme_name)`. Check the Portal field.
  3. If Portal is valid (has http / .gov.in): use it.
  4. If Portal is missing / N/A: call `find_official_link(scheme_name)`.
  5. If link found: format your ENTIRE reply as ONLY this JSON (no extra text):
     {"action": "GUIDE_MODE", "scheme_url": "<url>", "reply": "<short friendly reply in user’s language>"}
  6. If link not found: apologize in 1 sentence and suggest searching on india.gov.in.
NEVER invent a URL.
└────────────────────────────────────────────────────────────┘

┌─ RULE 5: GENERAL BEHAVIOR ─────────────────────────────────┐
- ONLY cite information returned by tools. Never invent scheme details.
- Be direct and concise (max 4 sentences). Do not repeat what the user said.
- End every response with ONE follow-up question.
- If asked about a form field (e.g., 'What is gross income?'), explain it simply without tools.
└────────────────────────────────────────────────────────────┘"""


# ── Build & Run Agent ──

_agent_graph = None


def _get_agent():
    """Lazy-build and cache the LangGraph agent."""
    global _agent_graph
    if _agent_graph is not None:
        return _agent_graph

    llm = ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model="llama-3.3-70b-versatile",
        temperature=0.3,
        max_tokens=300,
    )

    tools = [scheme_search, check_documents, get_application_steps, find_official_link]

    _agent_graph = create_agent(
        model=llm,
        tools=tools,
        state_modifier=SYSTEM_PROMPT,
    )

    logger.info("✅ LangChain Agent (LangGraph) built successfully.")
    return _agent_graph


def run_langchain_agent(
    query: str,
    vault_docs: list[str],
    language: str = "hinglish",
    user_id: str = "anonymous",
) -> dict:
    """
    Main entry point — replaces the old orchestrator's run_agent() + generate_hinglish_reply().
    Returns a dict with 'reply', 'action', 'doc_type'.
    """

    try:
        agent = _get_agent()

        # Load conversation history from DynamoDB / in-memory
        history_records = get_history(user_id, limit=5)
        messages = []
        for msg in history_records:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                messages.append(AIMessage(content=msg["content"]))

        # Add current query with vault context — language label is AUTHORITATIVE
        lang_label = language.lower()  # e.g. 'english', 'hindi', 'hinglish'
        vault_str = ", ".join(vault_docs) if vault_docs else "none"
        enhanced_query = (
            f"{query}\n"
            f"[SYSTEM CONTEXT: Language={lang_label}. "
            f"Vault documents user has: {vault_str}. "
            f"Reply ONLY in {lang_label}. Do not use any other language.]"
        )
        messages.append(HumanMessage(content=enhanced_query))

        # Invoke the LangGraph agent
        result = agent.invoke({"messages": messages})

        # Extract the final AI message
        output_messages = result.get("messages", [])
        raw_reply = "I couldn't process that. Please try again."
        for msg in reversed(output_messages):
            if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
                raw_reply = msg.content
                break

        action = "NONE"
        doc_type = None
        scheme_url = None
        reply = raw_reply

        # ── TASK 3: Parse JSON if agent returned GUIDE_MODE block ──
        if "{" in raw_reply and "}" in raw_reply:
            try:
                json_str = raw_reply[raw_reply.find("{"):raw_reply.rfind("}")+1]
                data = json.loads(json_str)
                if data.get("action") == "GUIDE_MODE":
                    action = "GUIDE_MODE"
                    scheme_url = data.get("scheme_url")
                    reply = data.get("reply", raw_reply)
            except Exception as parse_err:
                logger.warning(f"JSON parse failed (fallback to text): {parse_err}")

        # ── Detect WAITING_FOR_CONFIRMATION if no GUIDE_MODE ──
        reply_lower = reply.lower()
        if action == "NONE" and "missing" in reply_lower and ("document" in reply_lower or "aadhaar" in reply_lower):
            action = "WAITING_FOR_CONFIRMATION"
            if "aadhaar" in reply_lower or "aadhar" in reply_lower:
                doc_type = "aadhar"

        result_dict = {"reply": reply, "action": action, "doc_type": doc_type}
        if scheme_url:
            result_dict["scheme_url"] = scheme_url

        return result_dict

    except Exception as e:
        logger.error(f"LangChain agent error: {e}", exc_info=True)
        # Fallback to old orchestrator + direct Groq
        try:
            from orchestrator import run_agent
            from groq import Groq

            agent_result = run_agent(query, vault_docs, language)
            llm_context = agent_result.get("llm_context", "")

            # Use Groq directly as fallback for Hinglish reply
            groq_key = os.getenv("GROQ_API_KEY")
            if groq_key and llm_context:
                client = Groq(api_key=groq_key)
                resp = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": f"You are Jan-Sahayak. Reply in {language}. Be warm and concise."},
                        {"role": "user", "content": llm_context},
                    ],
                    temperature=0.4,
                    max_tokens=250,
                )
                reply = resp.choices[0].message.content.strip()
            else:
                reply = llm_context or "Sorry, I couldn't process that."

            action = "NONE"
            if agent_result.get("scheme_found") and not agent_result.get("eligible"):
                action = "WAITING_FOR_CONFIRMATION"

            return {
                "reply": reply,
                "action": action,
                "doc_type": None,
            }
        except Exception as e2:
            logger.error(f"Fallback orchestrator also failed: {e2}")
            return {
                "reply": "I'm experiencing technical difficulties. Please try again shortly.",
                "action": "NONE",
                "doc_type": None,
            }
