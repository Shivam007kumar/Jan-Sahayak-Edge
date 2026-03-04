"""
Orchestrator - The Agent's Brain.
Chains the deterministic tools in sequence and composes
a structured result that the GenAI layer (Bedrock) can 
translate into friendly Hinglish.

Pipeline:
1. SchemeSearchTool  → Find matching scheme(s)
2. (NEW) LLM Repair  → If no match, translate/clean query via LLM and retry
3. EligibilityCheckerTool → Check vault docs vs required docs
4. FormGuidanceTool → Get application steps
5. Compose final deterministic output
"""

import os
import json
import logging
from tools.scheme_search import search_schemes
from tools.eligibility_checker import check_eligibility
from tools.form_guidance import get_form_guidance

logger = logging.getLogger("jan-sahayak")

# Known scheme names for LLM repair prompt
KNOWN_SCHEMES = [
    "PM Kisan Samman Nidhi", "Ayushman Bharat Pradhan Mantri Jan Arogya Yojana",
    "Post Matric Scholarship for SC Students", "Pradhan Mantri MUDRA Yojana (PMMY)",
    "Pradhan Mantri Awas Yojana - Gramin", "Pradhan Mantri Awas Yojana - Urban",
    "Atal Pension Yojana", "Sukanya Samriddhi Yojana", "Stand Up India Scheme",
    "Mahatma Gandhi National Rural Employment Guarantee Act", "Soil Health Card Scheme",
    "Pradhan Mantri Ujjwala Yojana 2.0", "Digital India Internship Scheme",
    "Pradhan Mantri Fasal Bima Yojana", "Pradhan Mantri Matsya Sampada Yojana"
]


def _llm_repair_query(query: str) -> str:
    """
    Use LLM to translate/repair a query that fuzzy search couldn't match.
    Handles: Hindi script, Hinglish, transliterated text, abbreviations.
    """
    from groq import Groq

    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        return query

    try:
        client = Groq(api_key=groq_key)
        repair_prompt = (
            f"The user asked: \"{query}\"\n\n"
            f"This might be in Hindi, Hinglish, transliterated text, or broken English.\n"
            f"Our database contains 1,564 Indian government schemes.\n\n"
            f"Translate/extract the core intent or scheme name into broad English keywords.\n"
            f"If it's about agriculture, output 'Agriculture' or 'Kisan'. If housing, 'Housing' or 'Awas'.\n"
            f"Output ONLY the translated English keywords (e.g. 'matsya sampada', 'kisan samman', 'housing for poor'). Nothing else.\n"
            f"If you cannot identify any intent, output ONLY the word: NONE"
        )

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": repair_prompt}],
            temperature=0.1,
            max_tokens=25,
        )

        cleaned = response.choices[0].message.content.strip().strip('"').strip("'")
        if cleaned and cleaned.upper() != "NONE":
            logger.info(f"🔄 LLM Query Repair: '{query}' → '{cleaned}'")
            return cleaned
    except Exception as e:
        logger.warning(f"LLM repair failed: {e}")

    return query


def run_agent(query: str, vault_docs: list[str], language: str = "hinglish") -> dict:
    """
    Main orchestrator function. Runs the deterministic tool chain.
    Now with LLM-powered search recovery for multilingual queries.
    """

    # ── Step 1: Search for relevant schemes ──
    search_results = search_schemes(query, top_k=1)

    # ── Step 1b: LLM Repair if no results ──
    if not search_results:
        logger.info(f"🔍 No direct match for '{query}'. Attempting LLM repair...")
        repaired_query = _llm_repair_query(query)
        if repaired_query != query:
            search_results = search_schemes(repaired_query, top_k=1)
            if search_results:
                logger.info(f"✅ LLM repair successful! Found: {search_results[0]['scheme']['name']}")

    if not search_results:
        return {
            "scheme_found": False,
            "scheme_id": None,
            "scheme_name": None,
            "eligible": False,
            "missing_docs": [],
            "guidance": None,
            "tool_trace": [
                {"tool": "SchemeSearchTool", "result": "No matching scheme found"},
                {"tool": "LLMRepairTool", "result": "Repair attempted, no match"},
            ],
            "llm_context": f"The user asked: '{query}'. No matching government scheme was found in our database for this query. Politely tell them you could not find a relevant scheme and ask them to rephrase or ask about a specific scheme."
        }

    # Best match
    best_match = search_results[0]
    scheme = best_match["scheme"]
    match_score = best_match["score"]

    # ── Step 2: Check eligibility ──
    eligibility = check_eligibility(scheme, vault_docs)

    # ── Step 3: Get form guidance ──
    guidance = get_form_guidance(scheme)

    # ── Step 4: Compose LLM context ──
    if eligibility["eligible"]:
        llm_context = (
            f"DETERMINISTIC RESULT: The user asked about '{scheme['name']}'. "
            f"The system checked and confirmed: the user HAS all core vault documents ({', '.join(eligibility['has_docs'])}). "
            f"They ARE eligible based on the vault. "
        )
        if eligibility["manual_required"]:
            llm_context += f"However, they will manually need to provide: {', '.join(eligibility['manual_required'])}. "
        
        llm_context += (
            f"Next step: They should apply via {guidance['application_mode']}. "
            f"Tell them they have the main documents and guide them to the next step in {language}."
        )
    else:
        missing_readable = ", ".join(eligibility["vault_missing"])
        llm_context = (
            f"DETERMINISTIC RESULT: The user asked about '{scheme['name']}'. "
            f"The system checked and found: the user is MISSING these core vault documents: {missing_readable}. "
            f"They have {len(eligibility['has_docs'])} out of {eligibility['total_required']} required docs. "
            f"They are NOT yet eligible. "
            f"Tell them which documents are missing and where to get them, in {language}. Keep it under 3 sentences."
        )

    # ── Build full trace ──
    tool_trace = [
        {
            "tool": "SchemeSearchTool",
            "input": {"query": query},
            "result": {"scheme_id": scheme["id"], "scheme_name": scheme["name"], "match_score": match_score}
        },
        {
            "tool": "EligibilityCheckerTool",
            "input": {"scheme_id": scheme["id"], "vault_docs": vault_docs},
            "result": eligibility
        },
        {
            "tool": "FormGuidanceTool",
            "input": {"scheme_id": scheme["id"]},
            "result": guidance
        }
    ]

    return {
        "scheme_found": True,
        "scheme_id": scheme["id"],
        "scheme_name": scheme["name"],
        "eligible": eligibility["eligible"],
        "missing_docs": eligibility["missing_docs"],
        "guidance": guidance,
        "tool_trace": tool_trace,
        "llm_context": llm_context
    }

