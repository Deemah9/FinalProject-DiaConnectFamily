import firebase_admin
from firebase_admin import credentials, firestore
import os

# --------------------------------------------------
# This file is responsible for initializing
# Firebase Admin SDK and providing a Firestore client
# for the backend application.
# --------------------------------------------------


# Get the absolute path of the "app" directory
# This allows us to build paths dynamically and
# avoid hardcoded file locations.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Build the full path to the Firebase service account key
# The service account key identifies this backend
# as a trusted server with admin privileges.
SERVICE_ACCOUNT_PATH = os.path.join(
    BASE_DIR,
    "config",
    "service-account-key.json"
)

# Initialize Firebase Admin SDK only once
# This check prevents errors when the app reloads
# or when multiple modules import this file.
if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)

# Create a Firestore client
# This object will be used throughout the backend
# to read and write data from/to Firestore.
db = firestore.client()
