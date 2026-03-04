"""
FormGuidanceTool - Fetches application process steps for a scheme.
Returns online/offline steps deterministically from the knowledge base.
"""


def get_form_guidance(scheme: dict) -> dict:
    """
    Returns the application process guidance for a given scheme.
    """
    app_mode = scheme.get("application_mode", "Online / Offline")

    return {
        "scheme_id": scheme["id"],
        "scheme_name": scheme["name"],
        "application_mode": app_mode,
        "guidance_summary": f"Application Mode: {app_mode}"
    }
