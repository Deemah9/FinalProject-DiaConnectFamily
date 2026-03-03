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
- **Firebase Authentication** — User management
- **Pydantic** — Data validation
- **JWT (python-jose)** — Token-based authentication
- **bcrypt (passlib)** — Password hashing

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                    ← FastAPI app + CORS + routers
│   ├── config/
│   │   └── firebase.py            ← Firebase Admin SDK initialization
│   ├── models/
│   │   ├── user.py                ← User models (register, profile, medical, lifestyle)
│   │   ├── glucose_reading.py     ← Glucose models (create, response, stats)
│   │   ├── daily_log.py           ← Daily log models (meal, activity, sleep)
│   │   └── base_event.py          ← Shared timestamp validator
│   ├── routes/
│   │   ├── auth.py                ← POST /auth/register, POST /auth/login
│   │   ├── user_routes.py         ← GET/PUT /users/me
│   │   ├── glucose.py             ← Glucose CRUD APIs
│   │   └── daily_logs.py          ← Daily log APIs
│   ├── services/
│   │   ├── glucose_service.py     ← Glucose business logic
│   │   └── daily_log_service.py   ← Daily log business logic
│   ├── middleware/
│   │   └── dependencies.py        ← get_current_user, require_role
│   └── utils/
│       └── security.py            ← JWT creation & verification
├── docs/
│   ├── API_DOCUMENTATION.md       ← Full API reference
│   └── DATABASE_SCHEMA.md         ← Firestore schema
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
- Save the file as `serviceAccountKey.json` in the `backend/` directory

> ⚠️ Never commit `serviceAccountKey.json` to Git — it's in `.gitignore`

### 5. Environment Variables

Create a `.env` file in `backend/`:

```env
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

### 6. Run the server

```bash
uvicorn app.main:app --reload
```

Server runs at: `http://127.0.0.1:8000`  
API Docs (Swagger): `http://127.0.0.1:8000/docs`

---

## API Overview

| Method | Endpoint               | Description         | Role    |
| ------ | ---------------------- | ------------------- | ------- |
| POST   | /auth/register         | Register new user   | Public  |
| POST   | /auth/login            | Login & get token   | Public  |
| GET    | /users/me              | Get profile         | All     |
| PUT    | /users/me              | Update profile      | All     |
| PUT    | /users/me/medical      | Update medical info | Patient |
| PUT    | /users/me/lifestyle    | Update lifestyle    | All     |
| POST   | /glucose/              | Add glucose reading | Patient |
| GET    | /glucose/              | Get all readings    | All     |
| GET    | /glucose/latest        | Get latest reading  | All     |
| GET    | /glucose/stats         | Get statistics      | All     |
| POST   | /daily-logs/meals      | Log a meal          | All     |
| POST   | /daily-logs/activities | Log an activity     | All     |
| POST   | /daily-logs/sleep      | Log sleep event     | All     |
| GET    | /daily-logs/today      | Get last 24 hours   | All     |

Full documentation: [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)

---

## Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <token>
```

Token is obtained from `POST /auth/login`.

**Token expiry:** 1440 minutes (24 hours) in development.

---

## Important Notes for Frontend

- Always send `timestamp` with explicit timezone: `"2026-03-01T08:00:00+02:00"`
- Never send naive timestamps without timezone — server assumes UTC
- CORS is configured for: `localhost:3000`, `localhost:8081`, `exp://localhost:8081`

---

## Firestore Indexes Required

The following composite indexes must be created in Firebase Console:

| Collection       | Fields                 | Order     |
| ---------------- | ---------------------- | --------- |
| glucose_readings | userId ↑, measuredAt ↓ | Composite |
| meals            | userId ↑, timestamp ↑  | Composite |
| activities       | userId ↑, timestamp ↑  | Composite |
| sleep_logs       | userId ↑, timestamp ↑  | Composite |

> Indexes are auto-created on first query — follow the link in the terminal error.

---

## Git Workflow

```bash
# Deema's branch
git checkout deema-work

# After changes
git add .
git commit -m "feat: description"
git push origin deema-work
```

---

## Week 2 Status

- ✅ Auth APIs (Register + Login + JWT + Role)
- ✅ User Profile APIs (GET/PUT + Medical + Lifestyle)
- ✅ Glucose Readings APIs (CRUD + Stats)
- ✅ Daily Logs APIs (Meals + Activities + Sleep)
- ✅ CORS Configuration
- ✅ Role-based Access Control
- 🔜 Week 3: Family Connection APIs + LibreView Integration + ML Models
