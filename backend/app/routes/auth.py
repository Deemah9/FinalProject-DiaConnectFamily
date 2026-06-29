import os
import re
import secrets
import socket
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr
from typing import Optional

# Import our utilities
from app.config.firebase import db
from app.utils.security import (
    hash_password, verify_password, create_access_token
)
from app.models.user import User
from app.models.password_reset_token import PasswordResetToken
from app.services.email_service import send_password_reset_email, send_verification_email
from app.middleware.dependencies import get_current_user

_PASSWORD_RE = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$'
)

def _validate_password(password: str) -> None:
    if not _PASSWORD_RE.match(password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character (!@#$%)"
        )


# ==========================================
# Router Configuration
# ==========================================

# Create router for authentication endpoints
router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# ==========================================
# Request/Response Models
# ==========================================

class RegisterRequest(BaseModel):
    """
    Request model for user registration.

    Fields:
        email: User email address
        password: User password (min 6 characters)
        firstName: User first name
        lastName: User last name
        role: User role (patient or family_member)
        phone: Optional phone number
    """
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str  # "patient" or "family_member"
    phone: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "yourpassword123",
                "first_name": "John",
                "last_name": "Doe",
                "role": "patient",
                "phone": "+970599000000"
            }
        }


class LoginRequest(BaseModel):
    """
    Request model for user login.

    Fields:
        email: User email address
        password: User password
    """
    email: EmailStr
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "yourpassword123"
            }
        }


class AuthResponse(BaseModel):
    """
    Response model for authentication endpoints.

    Fields:
        message: Success message
        userId: User ID
        email: User email
        role: User role
        accessToken: JWT access token
        emailVerified: Whether the email has been verified
    """
    message: str
    userId: str
    email: str
    role: str
    accessToken: str
    emailVerified: bool = True


class ResendVerificationRequest(BaseModel):
    email: EmailStr


# ==========================================
# Helper Functions
# ==========================================

def get_user_by_email(email: str) -> Optional[dict]:
    """
    Retrieve user from Firestore by email.

    Args:
        email: User email address

    Returns:
        User document as dict if found, None otherwise
    """
    users_ref = db.collection('users')
    query = users_ref.where('email', '==', email).limit(1).get()

    if len(query) > 0:
        user_doc = query[0]
        user_data = user_doc.to_dict()
        user_data['userId'] = user_doc.id
        return user_data

    return None


# ==========================================
# Authentication Endpoints
# ==========================================

@router.post(
    "/register", response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED
)
async def register(request: RegisterRequest, http_request: Request):
    """
    Register a new user and send an email verification link.

    Process:
        1. Validate input data
        2. Check if email already exists
        3. Hash password
        4. Create user in Firestore with emailVerified=False
        5. Generate JWT token (for onboarding profile setup)
        6. Generate verification token and send email
        7. Return user info + token

    Raises:
        400: If email already exists
        400: If password is too short
        400: If role is invalid
    """

    _validate_password(request.password)

    # Validate role
    if request.role not in ["patient", "family_member"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'patient' or 'family_member'"
        )

    # Check if user already exists
    existing_user = get_user_by_email(request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash password
    hashed_password = hash_password(request.password)

    # Create user object
    user = User(
        email=request.email,
        password=hashed_password,
        first_name=request.first_name,
        last_name=request.last_name,
        role=request.role,
        phone=request.phone
    )

    user_dict = user.to_dict()
    user_dict["emailVerified"] = False
    user_dict["accountStatus"] = "pending"

    # Save to Firestore
    users_ref = db.collection('users')
    doc_ref = users_ref.add(user_dict)
    user_id = doc_ref[1].id

    # Generate email verification token (24 h expiry)
    verification_token = secrets.token_urlsafe(32)
    expiry = datetime.now(timezone.utc) + timedelta(hours=24)
    db.collection("users").document(user_id).update({
        "verificationToken": verification_token,
        "verificationTokenExpiry": expiry,
    })

    # Send verification email (non-blocking failure)
    base_url = _build_base_url(http_request)
    try:
        send_verification_email(
            to_email=request.email,
            token=verification_token,
            base_url=base_url,
        )
    except Exception as e:
        print(f"[email error] Could not send verification email: {e}")

    # Generate JWT token (for profile setup during onboarding)
    access_token = create_access_token(
        data={"sub": user_id, "role": user.role})

    # Return response
    return AuthResponse(
        message="Registration successful. Please check your email to verify your account.",
        userId=user_id,
        email=user.email,
        role=user.role,
        accessToken=access_token,
        emailVerified=False,
    )


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """
    Authenticate user and return JWT token.

    Process:
        1. Find user by email
        2. Verify password
        3. Generate JWT token
        4. Return user info + token

    Raises:
        401: If email not found
        401: If password is incorrect
    """

    # Find user by email
    user_data = get_user_by_email(request.email)

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Verify password
    if not verify_password(request.password, user_data['password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Block login for unverified accounts
    # Default True for existing accounts that pre-date email verification
    if not user_data.get('emailVerified', True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="EMAIL_NOT_VERIFIED",
        )

    # Generate JWT token
    access_token = create_access_token(data={
        "sub": user_data['userId'],
        "role": user_data['role']
    })

    # Return response
    return AuthResponse(
        message="Login successful",
        userId=user_data['userId'],
        email=user_data['email'],
        role=user_data['role'],
        accessToken=access_token,
        emailVerified=True,
    )


# ==========================================
# GET /auth/me
# ==========================================

class MeResponse(BaseModel):
    """
    Response model for GET /auth/me.
    Returns basic identity fields derived from the JWT token + Firestore.
    Excludes sensitive fields like password.
    """
    userId: str
    email: str
    role: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None


@router.get("/me", response_model=MeResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Return the identity of the currently authenticated user.
    Validates the Bearer token and fetches basic info from Firestore.
    Raises 404 if the user document no longer exists.
    """
    user_id = current_user["sub"]

    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    data = doc.to_dict()
    return MeResponse(
        userId=user_id,
        email=data.get("email", ""),
        role=data.get("role", ""),
        firstName=data.get("firstName"),
        lastName=data.get("lastName"),
        phone=data.get("phone"),
    )


# ==========================================
# Forgot Password
# ==========================================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _get_lan_ip() -> str:
    """Detect the machine's LAN IP by opening a UDP socket."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def _build_base_url(http_request: Request) -> str:
    """
    Return the best available base URL for the reset link.
    Priority:
      1. BACKEND_URL from .env — if it is a publicly reachable URL.
      2. Machine's LAN IP (auto-detected) — works for any device on
         the same WiFi without any manual configuration.
    """
    env_url = os.getenv("BACKEND_URL", "").rstrip("/")
    is_public = env_url.startswith("https://") or (
        env_url.startswith("http://")
        and "localhost" not in env_url
        and "127.0.0.1" not in env_url
        and "10.0.2.2" not in env_url
    )
    if is_public:
        return env_url

    port = http_request.url.port or 8000
    lan_ip = _get_lan_ip()
    return f"http://{lan_ip}:{port}"


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    request: ForgotPasswordRequest,
    http_request: Request,
):
    """
    Send a password reset email if the account exists.
    Always returns 200 so we don't reveal whether an email is registered.
    """
    user_data = get_user_by_email(request.email)

    if user_data:
        token = PasswordResetToken.create(
            user_id=user_data["userId"],
            email=request.email,
        )
        base_url = _build_base_url(http_request)
        try:
            send_password_reset_email(
                to_email=request.email,
                token=token,
                base_url=base_url,
            )
        except Exception as e:
            print(f"[email error] {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send reset email. Check SMTP configuration."
            )

    return {
        "message": "If that email is registered, a reset link has been sent."
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(request: ResetPasswordRequest):
    """
    Verify the reset token and update the user's password.
    """
    _validate_password(request.new_password)

    token_data = PasswordResetToken.find_valid(request.token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one."
        )

    hashed = hash_password(request.new_password)
    db.collection("users").document(token_data["userId"]).update({
        "password": hashed
    })

    PasswordResetToken.mark_used(token_data["docId"])

    return {"message": "Password updated successfully. You can now log in."}


# ==========================================
# Change Password (authenticated)
# ==========================================

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Change password for the currently authenticated user.
    Verifies current password before applying the update.
    """
    _validate_password(request.new_password)

    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation do not match."
        )

    user_id = current_user["sub"]
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    user_data = doc.to_dict()
    if not verify_password(request.current_password, user_data["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect."
        )

    hashed = hash_password(request.new_password)
    db.collection("users").document(user_id).update({"password": hashed})

    return {"message": "Password updated successfully."}


# ==========================================
# DELETE /auth/account
# ==========================================

class DeleteAccountRequest(BaseModel):
    password: str

@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    request: DeleteAccountRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Permanently delete the authenticated user's account and all associated data.
    Requires password confirmation before deletion.
    - Patient: removes user doc, glucose readings, family links, pairing codes,
               meals, activities, sleep logs.
    - Family member: removes user doc and family links.
    """
    user_id = current_user["sub"]

    user_doc = db.collection("users").document(user_id).get()
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if not verify_password(request.password, user_doc.to_dict().get("password", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password.")
    role    = current_user.get("role", "")

    def _delete_collection_where(collection: str, field: str, value: str):
        docs = db.collection(collection).where(field, "==", value).stream()
        for doc in docs:
            doc.reference.delete()

    if role == "patient":
        _delete_collection_where("glucose_readings",     "userId",     user_id)
        _delete_collection_where("family_patient_links", "patient_id", user_id)
        _delete_collection_where("pairing_codes",        "patient_id", user_id)
        _delete_collection_where("meals",                "userId",     user_id)
        _delete_collection_where("activities",           "userId",     user_id)
        _delete_collection_where("sleep_logs",           "userId",     user_id)
    elif role == "family_member":
        _delete_collection_where("family_patient_links", "family_member_id", user_id)

    db.collection("users").document(user_id).delete()


# ==========================================
# Email Verification
# ==========================================

@router.get("/verify-email", response_class=HTMLResponse)
async def verify_email(token: str):
    """
    Verify a user's email address using the token sent by email.
    Returns an HTML page showing success or failure.
    """
    def _html_page(title: str, message: str, success: bool) -> str:
        color = "#166534" if success else "#991B1B"
        bg = "#DCFCE7" if success else "#FEE2E2"
        icon = "&#10003;" if success else "&#10007;"
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>DiaConnect — Email Verification</title>
  <style>
    body {{
      font-family: Arial, sans-serif;
      background: #1A6FA8;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }}
    .card {{
      background: #fff;
      border-radius: 20px;
      padding: 40px 32px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    }}
    .icon {{
      font-size: 48px;
      color: {color};
      margin-bottom: 16px;
    }}
    h1 {{ color: #1A6FA8; font-size: 22px; margin-bottom: 8px; }}
    .badge {{
      display: inline-block;
      background: {bg};
      color: {color};
      border-radius: 10px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      margin: 16px 0;
    }}
    p {{ color: #555; font-size: 14px; line-height: 1.6; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">{icon}</div>
    <h1>DiaConnect Family</h1>
    <div class="badge">{title}</div>
    <p>{message}</p>
  </div>
</body>
</html>"""

    # Find user by verification token
    query = db.collection("users").where(
        "verificationToken", "==", token
    ).limit(1).get()

    if not query:
        return HTMLResponse(content=_html_page(
            "Invalid Link",
            "This verification link is invalid or has already been used. "
            "Please request a new verification email from the app.",
            success=False,
        ))

    user_doc = query[0]
    user_data = user_doc.to_dict()

    # Check if already verified
    if user_data.get("emailVerified", False):
        return HTMLResponse(content=_html_page(
            "Already Verified",
            "Your email has already been verified. You can log in to the app.",
            success=True,
        ))

    # Check token expiry
    expiry = user_data.get("verificationTokenExpiry")
    if expiry is None or datetime.now(timezone.utc) > expiry:
        return HTMLResponse(content=_html_page(
            "Link Expired",
            "This verification link has expired (links are valid for 24 hours). "
            "Please request a new verification email from the app.",
            success=False,
        ))

    # Mark as verified
    db.collection("users").document(user_doc.id).update({
        "emailVerified": True,
        "accountStatus": "active",
        "verificationToken": None,
        "verificationTokenExpiry": None,
    })

    return HTMLResponse(content=_html_page(
        "Email Verified!",
        "Your email has been successfully verified. "
        "You can now open the DiaConnect Family app and log in.",
        success=True,
    ))


@router.get("/check-verification", status_code=status.HTTP_200_OK)
async def check_verification(email: str):
    """
    Poll endpoint: returns whether the given email address has been verified.
    """
    query = db.collection("users").where("email", "==", email).limit(1).get()
    if not query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user_data = query[0].to_dict()
    return {"verified": user_data.get("emailVerified", False)}


@router.post("/resend-verification", status_code=status.HTTP_200_OK)
async def resend_verification(
    request: ResendVerificationRequest,
    http_request: Request,
):
    """
    Resend the email verification link for an unverified account.
    Always returns 200 to avoid revealing account existence.
    """
    user_data = get_user_by_email(request.email)

    if user_data and not user_data.get("emailVerified", True):
        verification_token = secrets.token_urlsafe(32)
        expiry = datetime.now(timezone.utc) + timedelta(hours=24)
        db.collection("users").document(user_data["userId"]).update({
            "verificationToken": verification_token,
            "verificationTokenExpiry": expiry,
        })
        base_url = _build_base_url(http_request)
        try:
            send_verification_email(
                to_email=request.email,
                token=verification_token,
                base_url=base_url,
            )
        except Exception as e:
            print(f"[email error] Resend verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send email. Please try again.",
            )

    return {"message": "If that account exists and is unverified, a new link has been sent."}


# ==========================================
# Reset Redirect — universal HTML bridge
# ==========================================

@router.get("/reset-redirect", response_class=HTMLResponse)
async def reset_redirect(token: str):
    """
    Serves a full password reset form in the browser.
    Works from any device without needing the app.
    """
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>DiaConnect — Reset Password</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: #1A6FA8;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }}
    .card {{
      background: #fff;
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 12px 40px rgba(0,0,0,0.18);
    }}
    .brand {{
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 28px;
    }}
    .brand-icon {{ font-size: 32px; }}
    .brand-name {{ line-height: 1.2; }}
    .brand-name strong {{ display: block; color: #1A6FA8; font-size: 20px; font-weight: 700; }}
    .brand-name span {{ color: #1A6FA8; font-size: 20px; font-weight: 300; }}
    .section-title {{
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 4px;
    }}
    .section-sub {{
      font-size: 13px;
      color: #888;
      margin-bottom: 24px;
    }}
    .field {{ margin-bottom: 16px; }}
    label {{
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #555;
      margin-bottom: 6px;
    }}
    input {{
      width: 100%;
      padding: 14px 16px;
      border: 1.5px solid #E5E7EB;
      border-radius: 14px;
      font-size: 15px;
      outline: none;
      transition: border 0.2s;
      background: #F9FAFB;
      color: #1a1a1a;
    }}
    input:focus {{ border-color: #1A6FA8; background: #fff; }}
    input.err {{ border-color: #DC2626; }}
    .rules {{
      background: #F0F6FF;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }}
    .rule {{
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #888;
      padding: 3px 0;
      transition: color 0.2s;
    }}
    .rule.ok {{ color: #166534; }}
    .rule .dot {{
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #D1D5DB;
      flex-shrink: 0;
      transition: background 0.2s;
    }}
    .rule.ok .dot {{ background: #22C55E; }}
    .btn {{
      width: 100%;
      padding: 16px;
      background: #1A6FA8;
      color: #fff;
      border: none;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 4px;
      transition: opacity 0.2s;
    }}
    .btn:disabled {{ opacity: 0.55; cursor: not-allowed; }}
    .error-box {{
      background: #FEE2E2;
      color: #DC2626;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 13px;
      margin-bottom: 16px;
      display: none;
    }}
    .success-box {{
      text-align: center;
      padding: 16px 0;
      display: none;
    }}
    .success-icon {{
      font-size: 56px;
      color: #22C55E;
      margin-bottom: 12px;
    }}
    .success-title {{
      font-size: 20px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 8px;
    }}
    .success-msg {{
      font-size: 14px;
      color: #666;
      line-height: 1.6;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <span class="brand-icon">&#10084;&#65039;</span>
      <div class="brand-name">
        <strong>DiaConnect</strong>
        <span>Family</span>
      </div>
    </div>

    <div id="success-box" class="success-box">
      <div class="success-icon">&#10003;</div>
      <div class="success-title">Password Updated!</div>
      <p class="success-msg">Your password has been changed successfully.<br/>You can now log in to the app.</p>
    </div>

    <div id="form-area">
      <p class="section-title">Reset Password</p>
      <p class="section-sub">Enter your new password below</p>

      <div id="error-box" class="error-box"></div>

      <div class="field">
        <label>New Password</label>
        <input type="password" id="pw1" placeholder="••••••••" oninput="checkRules()"/>
      </div>

      <div class="rules">
        <div class="rule" id="r-len"><span class="dot"></span>At least 8 characters</div>
        <div class="rule" id="r-upper"><span class="dot"></span>One uppercase letter (A–Z)</div>
        <div class="rule" id="r-lower"><span class="dot"></span>One lowercase letter (a–z)</div>
        <div class="rule" id="r-num"><span class="dot"></span>One number (0–9)</div>
        <div class="rule" id="r-special"><span class="dot"></span>One special character (!@#$%^&amp;*)</div>
      </div>

      <div class="field">
        <label>Confirm Password</label>
        <input type="password" id="pw2" placeholder="••••••••"/>
      </div>

      <button class="btn" id="submit-btn" onclick="submitReset()">
        Reset Password
      </button>
    </div>
  </div>

  <script>
    function checkRules() {{
      const v = document.getElementById('pw1').value;
      toggle('r-len',     v.length >= 8);
      toggle('r-upper',   /[A-Z]/.test(v));
      toggle('r-lower',   /[a-z]/.test(v));
      toggle('r-num',     /[0-9]/.test(v));
      toggle('r-special', /[!@#$%^&*]/.test(v));
    }}
    function toggle(id, ok) {{
      document.getElementById(id).classList.toggle('ok', ok);
    }}

    async function submitReset() {{
      const pw1 = document.getElementById('pw1').value;
      const pw2 = document.getElementById('pw2').value;
      const errBox = document.getElementById('error-box');
      const btn = document.getElementById('submit-btn');

      errBox.style.display = 'none';
      document.getElementById('pw1').classList.remove('err');
      document.getElementById('pw2').classList.remove('err');

      const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{{8,}}$/.test(pw1);
      if (!strong) {{
        errBox.textContent = 'Password does not meet the requirements above.';
        errBox.style.display = 'block';
        document.getElementById('pw1').classList.add('err');
        return;
      }}
      if (pw1 !== pw2) {{
        errBox.textContent = 'Passwords do not match.';
        errBox.style.display = 'block';
        document.getElementById('pw2').classList.add('err');
        return;
      }}

      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {{
        const res = await fetch('/auth/reset-password', {{
          method: 'POST',
          headers: {{'Content-Type': 'application/json'}},
          body: JSON.stringify({{ token: '{token}', new_password: pw1 }})
        }});
        const data = await res.json();
        if (res.ok) {{
          document.getElementById('form-area').style.display = 'none';
          document.getElementById('success-box').style.display = 'block';
        }} else {{
          errBox.textContent = data.detail || 'Something went wrong.';
          errBox.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Reset Password';
        }}
      }} catch (e) {{
        errBox.textContent = 'Network error. Please try again.';
        errBox.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Reset Password';
      }}
    }}
  </script>
</body>
</html>"""
    return HTMLResponse(content=html)
