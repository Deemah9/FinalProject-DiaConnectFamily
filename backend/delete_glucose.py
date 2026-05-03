"""
One-time script: delete all glucose readings from Firestore.
Run from the backend directory with the venv active:
    python delete_glucose.py
Or to delete only a specific user's readings:
    python delete_glucose.py <user_id>
"""

import sys
import os

# Add app to path so we can reuse the Firebase config
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config.firebase import db


def delete_all_glucose(user_id: str | None = None):
    collection = db.collection("glucose_readings")

    if user_id:
        query = collection.where("userId", "==", user_id)
        label = f"user {user_id}"
    else:
        query = collection
        label = "ALL users"

    docs = list(query.stream())
    total = len(docs)

    if total == 0:
        print(f"No glucose readings found for {label}.")
        return

    confirm = input(f"Delete {total} glucose readings for {label}? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("Cancelled.")
        return

    BATCH_SIZE = 400
    deleted = 0
    for i in range(0, total, BATCH_SIZE):
        batch = db.batch()
        for doc in docs[i : i + BATCH_SIZE]:
            batch.delete(doc.reference)
        batch.commit()
        deleted += min(BATCH_SIZE, total - i)
        print(f"  Deleted {deleted}/{total}...")

    print(f"✅ Done. {deleted} readings deleted.")


if __name__ == "__main__":
    uid = sys.argv[1] if len(sys.argv) > 1 else None
    delete_all_glucose(uid)
