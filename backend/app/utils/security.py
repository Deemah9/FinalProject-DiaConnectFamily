from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

# ==========================================
# Configuration
# ==========================================

# Secret key for JWT signing
# In production, this should be stored in environment variables (.env)
# Generate with: openssl rand -hex 32
SECRET_KEY = "f926236257f57ceab0e9449fc3e58ef84fd4e5659878c8083383adc18368cf4e"

# JWT algorithm
ALGORITHM = "HS256"

# Token expiration time in minutes
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# ==========================================
# Password Hashing Configuration
# ==========================================

# Password context using bcrypt algorithm
# bcrypt is a secure and industry-standard hashing algorithm
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ==========================================
# Password Hashing Functions
# ==========================================

def hash_password(password: str) -> str:
    """
    Hash a plain text password using bcrypt.

    Args:
        password: Plain text password

    Returns:
        Hashed password string

    Note:
        - Passwords are never stored in plain text
        - bcrypt adds a random salt to each password
        - The same password will produce different hashes each time
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        plain_password: Password entered by user
        hashed_password: Hashed password from database

    Returns:
        True if password matches, False otherwise

    Process:
        - Extracts salt from the stored hash
        - Hashes the input password with the same salt
        - Compares the results
    """
    return pwd_context.verify(plain_password, hashed_password)


# ==========================================
# JWT Token Functions
# ==========================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Dictionary containing user data (e.g., userId)
        expires_delta: Optional custom token expiration time

    Returns:
        Encoded JWT token as string

    Token Structure:
        - Contains user identifier (sub)
        - Contains expiration timestamp (exp)
        - Digitally signed to prevent tampering
    """
    # Copy data to avoid modifying original
    to_encode = data.copy()

    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        # Use default expiration time (30 minutes)
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    # Add expiration to token payload
    to_encode.update({"exp": expire})

    # Encode and sign the token
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt


def verify_token(token: str) -> Optional[str]:
    """
    Verify JWT token and extract userId.

    Args:
        token: JWT token string

    Returns:
        userId if token is valid, None if invalid or expired

    Validation fails when:
        - Token is expired
        - Token signature is invalid (tampered)
        - Token format is incorrect
    """
    try:
        # Decode and verify token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Extract userId from payload
        user_id: str = payload.get("sub")

        # Return None if userId is missing
        if user_id is None:
            return None

        return user_id

    except JWTError:
        # Any JWT error (expired, invalid signature, etc.)
        return None
