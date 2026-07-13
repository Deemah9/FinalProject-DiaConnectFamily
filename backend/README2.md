# DiaConnect Family — Backend API

**Project:** Type 2 Diabetes Monitoring & Prediction Platform
**Framework:** FastAPI (Python)
**Database:** Firebase Firestore
**Authors:** Deema Dweyyat + Wajdi Alfarawna
**Supervisor:** Dr. Roger Cohen
**Institution:** Azrieli College of Engineering, Jerusalem

---

## Tech Stack

- **Python 3.11+**
- **FastAPI** — REST API framework
- **Firebase Firestore** — NoSQL database
- **Firebase Admin SDK** — service-account access to Firestore (no separate Firebase Auth — passwords are hashed and checked by this backend, JWTs are issued directly)
- **Pydantic v2** — request/response validation
- **JWT (python-jose)** — token-based authentication
- **bcrypt (passlib)** — password hashing
- **TensorFlow (CPU) + scikit-learn** — per-user LSTM glucose prediction, fine-tuned from a cached base model
- **Groq API (`llama-3.3-70b-versatile`)** — natural-language prediction advice
- **APScheduler** — in-process background jobs (glucose reminders, hourly auto-predictions)

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                        ← FastAPI app, CORS, routers, background scheduler
│   ├── config/
│   │   ├── firebase.py                ← Firebase Admin SDK init + Firestore client
│   │   └── service-account-key.json   ← Firebase service account key (not committed)
│   ├── models/                        ← Pydantic request/response models
│   │   ├── user.py                    ← User (hand-rolled class, not Pydantic)
│   │   ├── glucose_reading.py
│   │   ├── daily_log.py               ← meal / activity / sleep
│   │   ├── base_event.py              ← shared timestamp validator
│   │   ├── alert.py
│   │   ├── family_link.py
│   │   ├── health.py                  ← conditions / basal insulin / insulin doses
│   │   ├── libreview.py
│   │   ├── password_reset_token.py
│   │   └── prediction.py
│   ├── routes/                        ← one router per feature area
│   │   ├── auth.py, user_routes.py, glucose.py, daily_logs.py,
│   │   ├── alerts.py, family.py, prediction.py, libreview.py,
│   │   └── health.py, notifications.py
│   ├── services/                      ← business logic + Firestore access
│   │   ├── glucose_service.py, daily_log_service.py, alert_service.py,
│   │   ├── family_service.py, health_service.py, libreview_service.py,
│   │   └── notification_service.py, prediction_service.py, reminder_service.py, email_service.py
│   ├── middleware/
│   │   └── dependencies.py            ← get_current_user, require_role
│   └── utils/
│       └── security.py                ← JWT creation/verification, password hashing
├── models/                            ← cached base LSTM model (base_model.keras) for prediction fine-tuning
├── scripts/                           ← LSTM pretraining + offline evaluation scripts (see Scripts section)
├── tests/                             ← pytest suite (Firestore mocked, no live DB needed)
├── docs/  (see repo-level ../docs/)
│   ├── API_DOCUMENTATION.md           ← full API reference
│   └── DATABASE_SCHEMA.md             ← Firestore schema
├── requirements.txt
└── README.md
```

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-repo/FinalProject-DiaConnectFamily.git
cd FinalProject-DiaConnectFamily/backend
```

### 2. Create virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Firebase Setup

- Go to [Firebase Console](https://console.firebase.google.com)
- Open project: `diaconnect-family`
- Go to **Project Settings → Service Accounts → Generate new private key**
- Save the file as **`service-account-key.json`** (exact filename — see `app/config/firebase.py`) in `backend/app/config/`

> ⚠️ Never commit `service-account-key.json` to Git — it's in `.gitignore`

### 5. Environment Variables

Create a `.env` file in `backend/`:

```env
# JWT — SECRET_KEY has a hardcoded dev fallback in app/utils/security.py,
# but always set your own before anything resembling production.
SECRET_KEY=your-secret-key-here

# AI prediction advice (Groq). If unset, predictions still work — advice text is just omitted.
GROQ_API_KEY=your-groq-api-key

# Password-reset emails (Gmail SMTP by default). If unset, forgot-password
# requests still return 200 but no email is actually sent.
SMTP_USER=your-gmail-address
SMTP_PASSWORD=your-gmail-app-password
BACKEND_URL=http://localhost:8000
```

### 6. Run the server

```bash
uvicorn app.main:app --reload
```

Server runs at: `http://127.0.0.1:8000`
API Docs (Swagger): `http://127.0.0.1:8000/docs`

### 7. Run tests

```bash
pip install pytest pytest-asyncio
pytest
```

`tests/conftest.py` mocks Firestore and generates real JWTs against `app.utils.security` — no `.env` or live Firebase project required to run the suite.

---

## API Overview

10 routers, 60+ endpoints. Full reference: [`../docs/API_DOCUMENTATION.md`](../docs/API_DOCUMENTATION.md).

| Router | Prefix | Covers |
|---|---|---|
| `auth.py` | `/auth` | register, login, `/me`, password reset/change, account deletion |
| `user_routes.py` | `/users` | profile, medical, lifestyle, preferences, reminders, emergency contacts, push token |
| `glucose.py` | `/glucose` | CRUD, stats, eA1C, CSV import (edits/deletes restricted to manual readings) |
| `prediction.py` | `/glucose` | LSTM prediction (`/predict`, `/predict/family`), accuracy tracking |
| `daily_logs.py` | `/daily-logs` | meals, activities, sleep — event-based, timestamp-driven |
| `alerts.py` | `/alerts` | high/low glucose alert feed (own + linked-patient view) |
| `family.py` | `/family` | pairing-code generation/join, linked patient/family-member listing |
| `libreview.py` | `/libreview` | LibreView/LibreLinkUp CGM sync |
| `health.py` | `/health` | chronic conditions, basal insulin profile, insulin dose log |
| `notifications.py` | `/notifications` | notification inbox |

---

## Background Jobs

`main.py` starts an in-process APScheduler on app startup:

- **Glucose reminders** — periodic push to patients without a recent reading and no custom reminder schedule (`reminder_service.py`).
- **Auto-prediction** — every 60 minutes, runs the LSTM prediction for every patient with a reading under 6h old, and sends an alert/notification if it's out of range. This is why a patient can get a prediction alert without opening the app.

Both are in-memory jobs tied to the running process — they don't persist or replay across restarts.

---

## Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <token>
```

Token is obtained from `POST /auth/register` or `POST /auth/login` (both return one immediately).

**Token expiry:** 1440 minutes (24 hours).

---

## Important Notes for Frontend

- Always send timestamps with an explicit timezone offset: `"2026-07-03T08:00:00+03:00"`.
- Never send naive timestamps without timezone — the server assumes UTC.
- CORS currently allows all origins (`allow_origins=["*"]`) — no whitelist to keep in sync with, but expect this to be tightened before production.

---

## Firestore Indexes Required

| Collection | Fields | Used by |
|---|---|---|
| `glucose_readings` | `userId` ↑, `measuredAt` ↓ | Family member viewing a linked patient's readings |
| `predictions` | `userId` ↑, `createdAt` ↑ | Prediction write rate-limit + accuracy backfill |
| `notifications` | `userId` ↑, `createdAt` ↓ | Notification inbox listing |
| `notifications` | `userId` ↑, `isRead` ↑ | Unread count / mark-all-read |
| `meals`, `activities`, `sleep_logs` | `userId` ↑, `timestamp` ↑ | Family member viewing a linked patient's daily logs |

Most own-user reads deliberately avoid composite indexes by filtering/sorting in Python. Indexes are auto-created on first query — follow the link Firestore prints in the terminal error.

---

## Scripts (`backend/scripts/`)

- `pretrain_lstm.py` — trains/refreshes the cached base LSTM model (`models/base_model.keras`) that `prediction_service` fine-tunes per user.
- `evaluate_csv_patient.py`, `evaluate_pattern_mode.py`, `evaluate_real_patient.py` — offline evaluation against exported CSVs / real patient data; output plots land in `scripts/eval_output/`.

---

## Git Workflow

```bash
git checkout -b your-branch
# after changes
git add <files>
git commit -m "feat: description"
git push origin your-branch
```

---

## Status

- ✅ Auth (register/login/JWT/roles, password reset/change, account deletion)
- ✅ User profile, medical, lifestyle, preferences, reminders, emergency contacts, push token
- ✅ Glucose CRUD + stats + eA1C + CSV import
- ✅ Daily logs (meals/activities/sleep), event-based
- ✅ Insulin logging + health profile
- ✅ Family pairing/linking + linked-patient views
- ✅ Alerts feed + emergency push notifications
- ✅ Notification inbox
- ✅ LibreView CGM sync
- ✅ Per-user LSTM glucose prediction (real-time + pattern fallback) with AI-generated advice, plus accuracy tracking
- ✅ Background reminders + hourly auto-prediction
- ✅ Unit test suite (Firestore mocked)
- 🔜 Known gaps: `unit` field on glucose readings, `meal_type` persistence, `family_member_name` persistence, unified alert-threshold system — see `../docs/DATABASE_SCHEMA.md` → "Known Data-Model Discrepancies"
