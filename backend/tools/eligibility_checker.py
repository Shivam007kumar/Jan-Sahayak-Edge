"""
EligibilityCheckerTool - Deterministic vault comparison.
Compares user's vault_docs against scheme's required_docs.
Maps plain-english document names to local vault keys securely.
"""

def check_eligibility(scheme: dict, vault_docs: list[str]) -> dict:
    """
    Deterministic eligibility check, distinguishing between core vault docs and manual docs.
    """
    required_docs_raw = scheme.get("required_docs", [])
    
    vault_missing = []
    has_docs = []
    manual_required = []
    
    for req_doc in required_docs_raw:
        d = req_doc.lower()
        vault_key = None
        
        # Map human-readable doc names to local vault keys
        if "aadhaar" in d or "kyc" in d or ("identity" in d and "aadhaar" in d):
            vault_key = "aadhar_card"
        elif "pan" in d:
            vault_key = "pan_card"
        elif "land" in d or "7/12" in d or "khasra" in d or "lpc" in d:
            vault_key = "land_record_7_12"
        elif "bank" in d:
            vault_key = "bank_passbook"
        elif "ration" in d or "family id" in d:
            vault_key = "ration_card"
        elif "caste" in d or "sc/st" in d:
            vault_key = "caste_certificate"
            
        if vault_key:
            if vault_key in vault_docs:
                has_docs.append(req_doc)
            else:
                vault_missing.append(req_doc)
        elif "marksheet" in d:
            if "10th_marksheet" in vault_docs or "12th_marksheet" in vault_docs:
                has_docs.append(req_doc)
            else:
                vault_missing.append(req_doc)
        else:
            # E.g. Project Report, Sowing Certificate (cannot be verified via standard vault keys)
            manual_required.append(req_doc)
            
    is_vault_eligible = len(vault_missing) == 0

    return {
        "scheme_id": scheme["id"],
        "scheme_name": scheme["name"],
        "eligible": is_vault_eligible,
        "vault_missing": vault_missing,
        "manual_required": manual_required,
        "missing_docs": vault_missing + manual_required,
        "has_docs": has_docs,
        "total_required": len(required_docs_raw)
    }
