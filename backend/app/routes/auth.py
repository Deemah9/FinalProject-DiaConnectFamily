from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# Import our utilities
from app.config.firebase import db
from app.utils.security import hash_password, verify_password, create_access_token
from app.models.user import User

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
        fullName: User full name
        role: User role (patient or family_member)
        phone: Optional phone number
    """
    email: EmailStr
    password: str
    fullName: str
    role: str  # "patient" or "family_member"
    phone: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "yourpassword123",
                "fullName": "John Doe",
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

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
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
        full_name=request.fullName,
        role=request.role,
        phone=request.phone
    )

    # Save to Firestore
    users_ref = db.collection('users')
    doc_ref = users_ref.add(user.to_dict())
    user_id = doc_ref[1].id

    # Generate JWT token
    access_token = create_access_token(data={"sub": user_id})

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
    access_token = create_access_token(data={"sub": user_data['userId']})

    # Return response
    return AuthResponse(
        message="Login successful",
        userId=user_data['userId'],
        email=user_data['email'],
        role=user_data['role'],
        accessToken=access_token
    )
