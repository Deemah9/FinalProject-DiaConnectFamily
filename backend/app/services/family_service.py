import random
import string
from datetime import datetime, timezone, timedelta
from app.config.firebase import db


PAIRING_CODES_COLLECTION = "pairing_codes"
FAMILY_LINKS_COLLECTION = "family_patient_links"
USERS_COLLECTION = "users"
GLUCOSE_COLLECTION = "glucose_readings"

CODE_EXPIRY_DAYS = 7


def _generate_unique_code() -> str:
    """Generate a random 6-character uppercase alphanumeric code unique in Firestore."""
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(chars, k=6))
        existing = db.collection(PAIRING_CODES_COLLECTION)\
            .where("code", "==", code)\
            .where("used", "==", False)\
            .limit(1).stream()
        if not any(True for _ in existing):
            return code


def generate_code(patient_id: str) -> dict:
    """Patient generates a new pairing code. Returns code and expiry info."""
    code = _generate_unique_code()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=CODE_EXPIRY_DAYS)

    db.collection(PAIRING_CODES_COLLECTION).add({
        "code": code,
        "patient_id": patient_id,
        "created_at": now,
        "expires_at": expires_at,
        "used": False,
    })

    return {"code": code, "expires_in_days": CODE_EXPIRY_DAYS}


def join_with_code(family_member_id: str, code: str) -> dict:
    """
    Family member joins using a pairing code.
    Validates code exists, not expired, not used.
    Creates a link and marks the code as used.
    """
    code = code.strip().upper()
    now = datetime.now(timezone.utc)

    results = db.collection(PAIRING_CODES_COLLECTION)\
        .where("code", "==", code)\
        .where("used", "==", False)\
        .limit(1).stream()

    doc = next((d for d in results), None)

    if not doc:
        return {"error": "Invalid or already used code"}

    data = doc.to_dict()
    expires_at = data.get("expires_at")

    # Handle both timezone-aware and naive datetimes from Firestore
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now > expires_at:
            return {"error": "Code has expired"}

    patient_id = data.get("patient_id")

    # Check not already linked
    existing = db.collection(FAMILY_LINKS_COLLECTION)\
        .where("family_member_id", "==", family_member_id)\
        .where("patient_id", "==", patient_id)\
        .limit(1).stream()

    if any(True for _ in existing):
        return {"error": "Already linked to this patient"}

    # Fetch patient name
    patient_doc = db.collection(USERS_COLLECTION).document(patient_id).get()
    patient_name = "Unknown"
    if patient_doc.exists:
        pdata = patient_doc.to_dict()
        first = pdata.get("firstName", "")
        last = pdata.get("lastName", "")
        patient_name = f"{first} {last}".strip() or pdata.get("email", "Unknown")

    # Create link
    db.collection(FAMILY_LINKS_COLLECTION).add({
        "family_member_id": family_member_id,
        "patient_id": patient_id,
        "patient_name": patient_name,
        "linked_at": now,
    })

    # Mark code as used
    db.collection(PAIRING_CODES_COLLECTION).document(doc.id).update({"used": True})

    return {
        "message": "Linked successfully",
        "patient_name": patient_name,
        "patient_id": patient_id,
    }


def get_patients(family_member_id: str) -> list:
    """Return all patients linked to this family member."""
    results = db.collection(FAMILY_LINKS_COLLECTION)\
        .where("family_member_id", "==", family_member_id)\
        .stream()

    patients = []
    for doc in results:
        d = doc.to_dict()
        linked_at = d.get("linked_at")
        patients.append({
            "patient_id": d.get("patient_id"),
            "patient_name": d.get("patient_name", ""),
            "linked_at": linked_at.isoformat() if linked_at else None,
        })

    return patients


def view_with_code(code: str, limit: int = 50) -> dict:
    """
    Unauthenticated access: validate code and return patient data.
    Code is reusable within its validity period (not marked as used).
    """
    code = code.strip().upper()
    now = datetime.now(timezone.utc)

    results = db.collection(PAIRING_CODES_COLLECTION)\
        .where("code", "==", code)\
        .where("used", "==", False)\
        .limit(1).stream()

    doc = next((d for d in results), None)
    if not doc:
        return {"error": "Invalid code"}

    data = doc.to_dict()
    expires_at = data.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now > expires_at:
            return {"error": "Code has expired"}

    patient_id = data.get("patient_id")

    # Fetch patient info
    patient_doc = db.collection(USERS_COLLECTION).document(patient_id).get()
    patient_name = "Unknown"
    if patient_doc.exists:
        pdata = patient_doc.to_dict()
        first = pdata.get("firstName", "")
        last = pdata.get("lastName", "")
        patient_name = f"{first} {last}".strip() or pdata.get("email", "Unknown")

    # Fetch glucose readings
    readings_docs = db.collection(GLUCOSE_COLLECTION)\
        .where("userId", "==", patient_id)\
        .order_by("measuredAt", direction="DESCENDING")\
        .limit(limit).stream()

    readings = []
    for r in readings_docs:
        d = r.to_dict()
        measured_at = d.get("measuredAt")
        readings.append({
            "id": r.id,
            "value": d.get("value"),
            "unit": d.get("unit", "mg/dL"),
            "measuredAt": measured_at.isoformat() if measured_at else None,
            "source": d.get("source", "manual"),
        })

    return {
        "patient_id": patient_id,
        "patient_name": patient_name,
        "readings": readings,
    }


def get_patient_glucose(family_member_id: str, patient_id: str, limit: int = 50) -> list:
    """
    Return glucose readings for a patient, only if family member is linked to them.
    """
    # Verify link exists
    links = db.collection(FAMILY_LINKS_COLLECTION)\
        .where("family_member_id", "==", family_member_id)\
        .where("patient_id", "==", patient_id)\
        .limit(1).stream()

    if not any(True for _ in links):
        return None  # Not authorized

    readings = db.collection(GLUCOSE_COLLECTION)\
        .where("userId", "==", patient_id)\
        .order_by("measuredAt", direction="DESCENDING")\
        .limit(limit).stream()

    result = []
    for doc in readings:
        d = doc.to_dict()
        measured_at = d.get("measuredAt")
        result.append({
            "id": doc.id,
            "value": d.get("value"),
            "unit": d.get("unit", "mg/dL"),
            "measuredAt": measured_at.isoformat() if measured_at else None,
            "source": d.get("source", "manual"),
        })

    return result
