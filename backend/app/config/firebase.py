"""
Firebase Admin SDK initialization and Firestore client.
"""

import firebase_admin
from firebase_admin import credentials, firestore
import os
import sys


# Base directory (app/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Service account key path
SERVICE_ACCOUNT_PATH = os.path.join(
    BASE_DIR,
    "config",
    "service-account-key.json"
)


def initialize_firebase():
    """
    Initialize Firebase Admin SDK.

    Raises:
        FileNotFoundError: If service account key is missing
        Exception: If initialization fails
    """
    # Check if file exists
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        raise FileNotFoundError(
            f"❌ Service account key not found at: {SERVICE_ACCOUNT_PATH}\n"
            f"Please download it from Firebase Console:\n"
            f"Project Settings → Service Accounts → Generate new private key"
        )

    # Initialize Firebase Admin SDK (only once)
    if not firebase_admin._apps:
        try:
            cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase Admin SDK initialized")
        except Exception as e:
            print(f"❌ Firebase initialization failed: {e}")
            raise


def get_db():
    """
    Get Firestore database client.

    Returns:
        firestore.Client: Firestore client instance
    """
    try:
        return firestore.client()
    except Exception as e:
        print(f"❌ Failed to get Firestore client: {e}")
        raise


def test_connection():
    """
    Test Firestore connection.

    Returns:
        bool: True if connection successful, False otherwise
    """
    try:
        db = get_db()
        # Try to list collections
        collections = list(db.collections())
        print(f"✅ Firestore connected! Found {len(collections)} collections")
        return True
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False


# Initialize on import
initialize_firebase()

# Export db client
db = get_db()
