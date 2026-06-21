from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore
from app.middleware.dependencies import get_current_user, require_role

router = APIRouter(prefix="/users", tags=["User Profile"])
db = firestore.client()


# ==========================================
# Helper Function
# ==========================================

def get_user_doc(user_id: str) -> dict:
    """
    Retrieve a user document from Firestore by user_id.
    Raises 404 if the user does not exist.
    Returns user data as a dictionary with uid included.
    """
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    data = doc.to_dict()
    data["uid"] = user_id
    data.setdefault("lifestyle", {})
    data.setdefault("medical", {})
    return data


# ==========================================
# GET /users/me
# ==========================================

@router.get("/me")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """
    Returns the profile of the currently authenticated user.
    Extracts the user_id from the JWT token and fetches
    the corresponding document from Firestore.
    Requires a valid Bearer token.
    """
    return get_user_doc(current_user["sub"])


# ==========================================
# PUT /users/me
# ==========================================

@router.put("/me")
async def update_my_profile(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates the basic profile information of the current user.
    Only allows updating specific fields: firstName, lastName,
    phone, dateOfBirth, and gender.
    Ignores any fields that are not in the allowed list.
    Raises 400 if no valid fields are provided.
    Requires a valid Bearer token.
    """
    user_id = current_user["sub"]
    allowed_fields = {"firstName", "lastName",
                      "phone", "dateOfBirth", "gender", "language"}
    update_data = {k: v for k, v in request.items() if k in allowed_fields}

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields provided"
        )

    update_data["updatedAt"] = firestore.SERVER_TIMESTAMP
    db.collection("users").document(user_id).update(update_data)
    return get_user_doc(user_id)


# ==========================================
# PUT /users/me/medical
# ==========================================

@router.put("/me/medical")
async def update_medical_info(
    request: dict,
    current_user: dict = Depends(require_role("patient"))
):
    """
    Updates the medical information of the current user.
    Restricted to patients only - family members will receive 403.
    Stores the entire medical object under the 'medical' field in Firestore.
    Requires a valid Bearer token with role 'patient'.
    """
    user_id = current_user["sub"]
    db.collection("users").document(user_id).update({
        "medical": request,
        "updatedAt": firestore.SERVER_TIMESTAMP
    })
    return get_user_doc(user_id)


# ==========================================
# PUT /users/me/lifestyle
# ==========================================

@router.put("/me/lifestyle")
async def update_lifestyle_info(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates the lifestyle information of the current user.
    Available to both patients and family members.
    Stores the entire lifestyle object under the 'lifestyle' field
    in Firestore.
    Requires a valid Bearer token.
    """
    user_id = current_user["sub"]
    db.collection("users").document(user_id).update({
        "lifestyle": request,
        "updatedAt": firestore.SERVER_TIMESTAMP
    })
    return get_user_doc(user_id)


# ==========================================
# GET /users/me/preferences
# ==========================================

@router.get("/me/preferences")
async def get_preferences(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        return {}
    return doc.to_dict().get("preferences", {})


# ==========================================
# PUT /users/me/preferences
# ==========================================

@router.put("/me/preferences")
async def update_preferences(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["sub"]
    allowed = {"theme", "fontScale", "highContrast", "hapticEnabled"}
    prefs = {k: v for k, v in request.items() if k in allowed}
    if not prefs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid preference fields provided"
        )
    update_data = {f"preferences.{k}": v for k, v in prefs.items()}
    update_data["updatedAt"] = firestore.SERVER_TIMESTAMP
    db.collection("users").document(user_id).update(update_data)
    return prefs


# ==========================================
# GET /users/me/reminders
# ==========================================

@router.get("/me/reminders")
async def get_reminder_settings(
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["sub"]
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        return {"enabled": True, "reminders": []}
    data = doc.to_dict()
    settings = data.get("reminderSettings", {})
    # Backward compat: old format used "times" array, new format uses "reminders"
    if "times" in settings and "reminders" not in settings:
        settings["reminders"] = [{"name": "", "time": t} for t in settings["times"]]
    settings.setdefault("enabled", True)
    settings.setdefault("reminders", [])
    return settings


# ==========================================
# PUT /users/me/reminders
# ==========================================

@router.put("/me/reminders")
async def update_reminder_settings(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Saves reminder settings for the current user.
    Expects: { "enabled": bool, "reminders": [{"name": str, "time": "HH:MM"}, ...] }
    """
    user_id = current_user["sub"]
    settings = {
        "enabled": request.get("enabled", True),
        "reminders": request.get("reminders", []),
    }
    db.collection("users").document(user_id).update({
        "reminderSettings": settings,
        "updatedAt": firestore.SERVER_TIMESTAMP
    })
    return settings


# ==========================================
# GET /users/me/emergency-contacts
# ==========================================

@router.get("/me/emergency-contacts")
async def get_emergency_contacts(
    current_user: dict = Depends(get_current_user)
):
    """
    Returns the emergency contacts list for the current user.
    Stored as an array under 'emergencyContacts' in the user document.
    """
    user_id = current_user["sub"]
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    data = doc.to_dict()
    return {"contacts": data.get("emergencyContacts", [])}


# ==========================================
# PUT /users/me/emergency-contacts
# ==========================================

@router.put("/me/emergency-contacts")
async def update_emergency_contacts(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Saves the emergency contacts list for the current user.
    Expects: { "contacts": [ { "id": "...", "name": "...", "phone": "..." } ] }
    Replaces the entire list in Firestore.
    """
    user_id = current_user["sub"]
    contacts = request.get("contacts", [])
    db.collection("users").document(user_id).update({
        "emergencyContacts": contacts,
        "updatedAt": firestore.SERVER_TIMESTAMP
    })
    return {"contacts": contacts}


# ==========================================
# PUT /users/me/push-token
# ==========================================

@router.put("/me/push-token")
async def update_push_token(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Save the Expo push notification token for the current user.
    Used to send emergency glucose alerts to family members.
    """
    token = request.get("token", "").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="token is required"
        )
    user_id = current_user["sub"]
    db.collection("users").document(user_id).update({
        "pushToken": token,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    return {"message": "Push token saved"}
