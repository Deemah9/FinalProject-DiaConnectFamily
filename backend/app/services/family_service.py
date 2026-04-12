import json as json_lib
import random
import string
import urllib.request
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
    """
    Patient generates a new pairing code.
    Deletes all previous unused codes for this patient before creating a new one.
    Returns code and expiry info.
    """
    # Delete all existing unused codes for this patient
    old_codes = db.collection(PAIRING_CODES_COLLECTION)\
        .where("patient_id", "==", patient_id)\
        .where("used", "==", False)\
        .stream()
    for doc in old_codes:
        doc.reference.delete()

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
    Each code is single-use — marked as used after one successful join.
    The patient must generate a new code for each additional family member.
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

    # Mark code as used — one code per family member
    db.collection(PAIRING_CODES_COLLECTION).document(doc.id).update({"used": True})

    return {
        "message": "Linked successfully",
        "patient_name": patient_name,
        "patient_id": patient_id,
    }


def get_family_members(patient_id: str) -> list:
    """Return all family members linked to this patient."""
    results = db.collection(FAMILY_LINKS_COLLECTION)\
        .where("patient_id", "==", patient_id)\
        .stream()

    members = []
    for doc in results:
        d = doc.to_dict()
        family_member_id = d.get("family_member_id")
        linked_at = d.get("linked_at")

        # Fetch family member name from users collection
        name = d.get("family_member_name", "")
        if not name and family_member_id:
            user_doc = db.collection(USERS_COLLECTION).document(family_member_id).get()
            if user_doc.exists:
                udata = user_doc.to_dict()
                first = udata.get("firstName", "")
                last = udata.get("lastName", "")
                name = f"{first} {last}".strip() or udata.get("email", "Unknown")

        members.append({
            "link_id": doc.id,
            "family_member_id": family_member_id,
            "family_member_name": name,
            "linked_at": linked_at.isoformat() if linked_at else None,
        })

    return members


def remove_family_member(patient_id: str, link_id: str) -> bool:
    """
    Remove a family member link.
    Only the patient who owns the link can delete it.
    Returns True if deleted, False if not found or unauthorized.
    """
    doc_ref = db.collection(FAMILY_LINKS_COLLECTION).document(link_id)
    doc = doc_ref.get()

    if not doc.exists:
        return False

    if doc.to_dict().get("patient_id") != patient_id:
        return False

    doc_ref.delete()
    return True


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


def get_patient_daily_logs(family_member_id: str, patient_id: str, days: int = 7) -> dict | None:
    """
    Return daily logs (meals, activities, sleep) for a patient.
    Only accessible if family member is linked to the patient.
    """
    links = db.collection(FAMILY_LINKS_COLLECTION)\
        .where("family_member_id", "==", family_member_id)\
        .where("patient_id", "==", patient_id)\
        .limit(1).stream()

    if not any(True for _ in links):
        return None

    since = datetime.now(timezone.utc) - timedelta(days=days)

    def _serialize(d: dict) -> dict:
        for k in ("timestamp", "createdAt"):
            if k in d and hasattr(d[k], "isoformat"):
                d[k] = d[k].isoformat()
        return d

    def _fetch(collection: str) -> list:
        result = []
        for doc in db.collection(collection)\
                .where("userId", "==", patient_id)\
                .where("timestamp", ">=", since)\
                .stream():
            data = doc.to_dict()
            data["id"] = doc.id
            result.append(_serialize(data))
        return result

    return {
        "meals": _fetch("meals"),
        "activities": _fetch("activities"),
        "sleep": _fetch("sleep_logs"),
    }


def send_emergency_notification(patient_id: str, patient_name: str, glucose_value: int) -> None:
    """
    Send Expo push notifications to all family members linked to a patient
    when a dangerous glucose level is recorded (< 70 or > 300 mg/dL).
    """
    links = db.collection(FAMILY_LINKS_COLLECTION)\
        .where("patient_id", "==", patient_id)\
        .stream()

    family_ids = [doc.to_dict().get("family_member_id") for doc in links if doc.to_dict().get("family_member_id")]
    if not family_ids:
        return

    if glucose_value < 70:
        title = f"\u26a0\ufe0f {patient_name} - Low Glucose Alert"
        body = f"Glucose is dangerously LOW: {glucose_value} mg/dL. Please check immediately."
    else:
        title = f"\u26a0\ufe0f {patient_name} - High Glucose Alert"
        body = f"Glucose is dangerously HIGH: {glucose_value} mg/dL. Please check immediately."

    tokens = []
    for fid in family_ids:
        doc = db.collection(USERS_COLLECTION).document(fid).get()
        if doc.exists:
            token = doc.to_dict().get("pushToken", "")
            if token and token.startswith("ExponentPushToken["):
                tokens.append(token)

    if not tokens:
        return

    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": {"patient_id": patient_id, "glucose_value": glucose_value, "type": "glucose_alert"},
            "sound": "default",
            "priority": "high",
        }
        for token in tokens
    ]

    try:
        payload = json_lib.dumps(messages).encode("utf-8")
        req = urllib.request.Request(
            "https://exp.host/--/api/v2/push/send",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
            },
            method="POST",
        )
        urllib.request.urlopen(req, timeout=5)
        print(f"✅ Emergency notifications sent for patient {patient_id}: {glucose_value} mg/dL")
    except Exception as e:
        print(f"⚠️ Push notification failed: {e}")


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
