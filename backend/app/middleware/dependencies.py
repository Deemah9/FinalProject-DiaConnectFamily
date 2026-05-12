from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.utils.security import verify_token

# Tells FastAPI to expect a Bearer token in the request header
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Extracts and validates the JWT token from the request header.
    Raises 401 if token is invalid or expired.
    No Firestore read — all needed claims are embedded in the JWT.
    """
    token = credentials.credentials
    payload = verify_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def require_role(role: str):
    """
    Returns a dependency function that checks if the current user has the required role.
    Raises 403 if the user's role does not match the required role.
    Usage: Depends(require_role("patient")) or Depends(require_role("family_member"))
    """
    def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to {role} only"
            )
        return current_user
    return role_checker
