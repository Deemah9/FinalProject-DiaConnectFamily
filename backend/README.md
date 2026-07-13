# DiaConnect Family - Backend

FastAPI backend for diabetes management. See [README2.md](README2.md) for the full project structure, API overview, and design notes.

## Setup

1. `python -m venv venv`
2. `venv\Scripts\Activate.ps1`
3. `pip install -r requirements.txt`
4. Place your Firebase service account key at `app/config/service-account-key.json` (see README2.md → Firebase Setup)
5. Create `backend/.env` (see README2.md → Environment Variables)
6. `uvicorn app.main:app --reload`

## Tests

```bash
pip install pytest pytest-asyncio
pytest
```

Tests mock Firestore (`tests/conftest.py`) — no live database or `.env` needed to run them.
