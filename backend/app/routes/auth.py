import os
import socket
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
from app.services.email_service import send_password_reset_email
from app.middleware.dependencies import get_current_user

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
    """
    message: str
    userId: str
    email: str
    role: str
    accessToken: str


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
async def register(request: RegisterRequest):
    """
    Register a new user.

    Process:
        1. Validate input data
        2. Check if email already exists
        3. Hash password
        4. Create user in Firestore
        5. Generate JWT token
        6. Return user info + token

    Raises:
        400: If email already exists
        400: If password is too short
        400: If role is invalid
    """

    # Validate password length
    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )

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

    # Save to Firestore
    users_ref = db.collection('users')
    doc_ref = users_ref.add(user.to_dict())
    user_id = doc_ref[1].id

    # Generate JWT token
    access_token = create_access_token(
        data={"sub": user_id, "role": user.role})

    # Return response
    return AuthResponse(
        message="User registered successfully",
        userId=user_id,
        email=user.email,
        role=user.role,
        accessToken=access_token
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
        accessToken=access_token
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
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )

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
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long."
        )

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
      padding: 36px 28px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    }}
    h1 {{ color: #1A6FA8; font-size: 22px; margin-bottom: 6px; }}
    .subtitle {{
      color: #888; font-size: 13px; margin-bottom: 24px;
    }}
    label {{
      display: block;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #555;
      margin-bottom: 6px;
    }}
    input {{
      width: 100%;
      padding: 14px 16px;
      border: 1.5px solid #ddd;
      border-radius: 12px;
      font-size: 15px;
      margin-bottom: 16px;
      outline: none;
      transition: border 0.2s;
    }}
    input:focus {{ border-color: #1A6FA8; }}
    input.err {{ border-color: #DC2626; }}
    .btn {{
      width: 100%;
      padding: 16px;
      background: #1A6FA8;
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 4px;
    }}
    .btn:disabled {{ opacity: 0.6; cursor: not-allowed; }}
    .error {{
      background: #FEE2E2;
      color: #DC2626;
      border-radius: 10px;
      padding: 12px;
      font-size: 13px;
      margin-bottom: 16px;
      display: none;
    }}
    .success {{
      background: #DCFCE7;
      color: #166534;
      border-radius: 10px;
      padding: 16px;
      font-size: 14px;
      font-weight: 600;
      display: none;
    }}
  </style>
</head>
<body>
  <div class="card">
    <h1>&#10084; DiaConnect Family</h1>
    <p class="subtitle">Enter your new password below</p>

    <div id="error-box" class="error"></div>
    <div id="success-box" class="success">
      &#10003; Password updated! You can now log in to the app.
    </div>

    <div id="form-area">
      <label>New Password</label>
      <input type="password" id="pw1" placeholder="Min 6 characters"/>

      <label>Confirm Password</label>
      <input type="password" id="pw2" placeholder="Repeat password"/>

      <button class="btn" id="submit-btn" onclick="submitReset()">
        Reset Password
      </button>
    </div>

  </div>

  <script>
    async function submitReset() {{
      const pw1 = document.getElementById('pw1').value;
      const pw2 = document.getElementById('pw2').value;
      const errBox = document.getElementById('error-box');
      const btn = document.getElementById('submit-btn');

      errBox.style.display = 'none';
      document.getElementById('pw1').classList.remove('err');
      document.getElementById('pw2').classList.remove('err');

      if (pw1.length < 6) {{
        errBox.textContent = 'Password must be at least 6 characters.';
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
          body: JSON.stringify({{
            token: '{token}',
            new_password: pw1
          }})
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
