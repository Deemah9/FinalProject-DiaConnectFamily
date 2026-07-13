<div align="center">

# DiaConnect Family

### A Smart Mobile Platform for Type 2 Diabetes Monitoring, Prediction, Alerts, and Family Support

[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Web-blue?style=flat-square)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=flat-square&logo=react)](https://reactnative.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.21-FF6F00?style=flat-square&logo=tensorflow)](https://tensorflow.org)
[![License](https://img.shields.io/badge/License-Academic-lightgrey?style=flat-square)](#license)

**Software Engineering Graduation Project**  
Azrieli College of Engineering, Jerusalem

</div>

---

## Overview

**DiaConnect Family** is a full-stack mobile application designed to help patients with **Type 2 Diabetes** manage their condition through intelligent glucose monitoring, AI-powered prediction, real-time emergency alerts, and family connectivity.

The platform bridges the gap between patients and their families — enabling loved ones to stay informed, receive emergency push notifications, and monitor glucose trends in real time, regardless of where they are.

**The problem it solves:**
- Patients often manage diabetes in isolation without timely support from family
- Standard glucose apps offer no prediction or family-sharing capabilities
- Emergency glucose events (dangerously high/low) go unnoticed by family members

**Target users:**
- Adult patients diagnosed with Type 2 Diabetes
- Family members or caregivers who want to stay informed

---

## Key Features

### For Patients
| Feature | Description |
|---|---|
| **Glucose Monitoring** | Manual entry + LibreView CGM import (CSV and API sync) |
| **AI Glucose Prediction** | LSTM ensemble model predicts glucose 1 hour ahead |
| **Smart Alerts** | Automatic push notification when glucose is dangerous (< 70 or > 180 mg/dL) |
| **A1C Estimation** | Calculated from last 90 days of glucose readings |
| **Daily Log** | Track meals, insulin doses, activity, and sleep in one place |
| **Glucose Statistics** | Charts, trends, time-in-range, average, standard deviation |
| **Reminder System** | Customizable glucose measurement reminders (or auto every 4 hours) |
| **Emergency Contacts** | Store and call emergency contacts directly from the app |
| **Text-to-Speech** | Prediction results read aloud (Hebrew, Arabic, English) |
| **CSV Import** | Import glucose history from LibreView or CGM device exports |

### For Family Members
| Feature | Description |
|---|---|
| **Patient Dashboard** | View linked patient's glucose readings and trends |
| **Emergency Push Notifications** | Instant alert when patient's glucose is dangerously high or low |
| **Prediction Alerts** | Notified when AI predicts a risky glucose trend |
| **Unread Badge** | Red badge on notification bell updated on every screen focus |
| **Mark All as Read** | One-tap to clear all unread notifications |
| **Family Pairing** | Secure invite-code system to link patient and family accounts |

### Platform-wide
| Feature | Description |
|---|---|
| **Multi-language** | Full support for Arabic, Hebrew, and English |
| **RTL Support** | Complete right-to-left layout for Arabic and Hebrew |
| **Dark / Light Mode** | Follows system theme with manual override |
| **Haptic Feedback** | Critical alerts trigger vibration patterns |
| **Accessibility** | Font scale, high contrast mode, and screen reader support |
| **Email Verification** | Accounts require verified email before access |
| **Password Reset** | Secure email-based reset flow |

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React Native | 0.81 | Cross-platform mobile framework |
| Expo | ~54 | Build toolchain and native modules |
| Expo Router | ~6 | File-based navigation |
| TypeScript | ~5.9 | Type safety |
| expo-notifications | ~0.32 | Push and local notifications |
| expo-dev-client | ~6 | Development builds with native modules |
| i18next / react-i18next | latest | Multi-language (AR, HE, EN) |
| expo-speech | ~14 | Text-to-speech for prediction results |
| expo-haptics | ~15 | Haptic feedback for critical alerts |
| react-native-chart-kit | ^6 | Glucose trend charts |
| react-native-svg | ^15 | Custom chart rendering |
| react-native-reanimated | ~4.1 | Smooth animations |
| react-native-gesture-handler | ~2.28 | Touch interactions |
| react-native-calendars | ^1.13 | Calendar view for glucose history |
| AsyncStorage | 2.2 | Local preference persistence |
| expo-document-picker | ~14 | CSV file import |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.115 | REST API framework |
| Python | 3.12 | Server-side language |
| Uvicorn | 0.32 | ASGI server |
| Firebase Admin SDK | 6.6 | Firestore + Auth integration |
| TensorFlow (CPU) | 2.21 | LSTM model inference |
| NumPy | 2.1 | Numerical computations |
| scikit-learn | 1.5 | Data preprocessing |
| APScheduler | 3.10 | Background jobs (reminders + predictions) |
| python-jose | 3.3 | JWT authentication |
| passlib[bcrypt] | 1.7 | Password hashing |
| python-dotenv | 1.0 | Environment variable management |
| httpx | 0.27 | Async HTTP (Expo Push API calls) |

### Infrastructure

| Service | Purpose |
|---|---|
| Firebase Firestore | Primary NoSQL database (me-west1 / Tel Aviv) |
| Firebase Auth (email) | Email verification flow |
| Expo Push Service | Cloud push notification delivery |
| Firebase Cloud Messaging | Android push delivery (FCM V1) |
| EAS Build | Cloud-based Android/iOS build service |

---

## Architecture

```
Mobile App (React Native + Expo)
    |
    |  JWT Bearer token
    v
Backend (FastAPI + Python)
    |-- 10 Route Groups (auth, glucose, prediction, family, ...)
    |-- Service Layer (business logic)
    |-- APScheduler (reminders every 4h, predictions every 60min)
    |-- LSTM Prediction Engine
    |
    |-- Firebase Firestore (NoSQL database, Tel Aviv region)
    |
    |-- Expo Push API --> Firebase Cloud Messaging --> Device
```

### Emergency Alert Request Flow

1. Patient enters glucose reading via mobile app
2. `POST /glucose/` → `glucose_service.create_reading()`
3. `alert_service.evaluate_and_store()` detects dangerous value (< 70 or > 180)
4. `family_service.send_emergency_notification()` fetches all linked family members
5. Expo Push API delivers notification via FCM to each family member's device
6. Notification saved to Firestore `notifications` collection for history

---

## Project Structure

```
FinalProject-DiaConnectFamily/
|
|-- frontend/                          # React Native / Expo app
|   |-- app/
|   |   |-- (tabs)/                    # All tab-based screens
|   |   |   |-- index.tsx              # Patient home (glucose + prediction)
|   |   |   |-- notifications.tsx      # Notification center
|   |   |   |-- family-home.tsx        # Family member dashboard
|   |   |   |-- family-patient-glucose.tsx  # Patient detail view for family
|   |   |   |-- add-glucose.tsx        # Manual glucose entry
|   |   |   |-- glucose-history.tsx    # Historical readings
|   |   |   |-- glucose-stats.tsx      # Statistics & charts
|   |   |   |-- a1c.tsx                # A1C estimation
|   |   |   |-- daily-log.tsx          # Meals, insulin, activity, sleep
|   |   |   |-- reminder-settings.tsx  # Custom reminder configuration
|   |   |   |-- profile.tsx            # User profile
|   |   |   |-- emergency.tsx          # Emergency contacts
|   |   |   +-- ...                    # Other screens
|   |   |-- _layout.tsx                # Root layout + push notification handler
|   |   |-- welcome.tsx                # Landing / language selection
|   |   |-- login.tsx                  # Login screen
|   |   |-- signup.tsx                 # Registration screen
|   |   |-- onboarding.tsx             # Health profile setup (3 steps)
|   |   |-- verify-email.tsx           # Email verification gate
|   |   |-- forgot-password.tsx        # Password reset request
|   |   +-- reset-password.tsx         # Password reset confirmation
|   |-- src/
|   |   |-- components/
|   |   |   |-- AppHeader.tsx          # Header with notification badge
|   |   |   +-- GlucoseTrendChart.tsx  # Smooth Catmull-Rom chart
|   |   +-- i18n/                      # Translation files (AR, HE, EN)
|   |-- services/
|   |   |-- api.js                     # All API calls to backend
|   |   |-- reminderScheduler.ts       # Local notification scheduling
|   |   +-- predictionFlag.ts          # Prediction staleness tracking
|   |-- context/
|   |   |-- AuthContext.tsx            # JWT auth state
|   |   |-- HapticContext.tsx          # Haptic feedback provider
|   |   +-- DrawerContext.tsx          # Side drawer + language switcher
|   |-- constants/                     # Colors, Typography, Spacing
|   |-- hooks/                         # useAppTheme, useHaptic
|   |-- app.json                       # Expo configuration
|   +-- eas.json                       # EAS Build profiles
|
|-- backend/                           # FastAPI Python server
|   |-- app/
|   |   |-- main.py                    # App entry point + scheduler
|   |   |-- config/
|   |   |   +-- firebase.py            # Firebase Admin SDK init
|   |   |-- routes/                    # 10 API routers
|   |   |   |-- auth.py                # Register, login, password reset
|   |   |   |-- user_routes.py         # Profile, push token, reminders
|   |   |   |-- glucose.py             # Glucose CRUD + CSV import
|   |   |   |-- prediction.py          # AI prediction endpoint
|   |   |   |-- family.py              # Family linking (invite/join)
|   |   |   |-- notifications.py       # Notification CRUD
|   |   |   |-- alerts.py              # Alert history
|   |   |   |-- daily_logs.py          # Meals, insulin, activity, sleep
|   |   |   |-- health.py              # Health profile (conditions, ISF)
|   |   |   +-- libreview.py           # LibreView CSV/API import
|   |   |-- services/                  # Business logic layer
|   |   |   |-- prediction_service.py  # LSTM ensemble engine
|   |   |   |-- family_service.py      # Emergency + prediction alerts
|   |   |   |-- notification_service.py # Firestore notification CRUD
|   |   |   |-- glucose_service.py     # Glucose business logic
|   |   |   |-- alert_service.py       # Alert evaluation & storage
|   |   |   |-- reminder_service.py    # Scheduled glucose reminders
|   |   |   |-- email_service.py       # SMTP email (reset, verification)
|   |   |   +-- health_service.py      # Health info service
|   |   |-- models/                    # Pydantic data models
|   |   +-- middleware/
|   |       +-- dependencies.py        # JWT auth middleware
|   |-- models/
|   |   +-- base_model.keras           # Pre-trained LSTM weights
|   |-- tests/                         # pytest test suite
|   +-- requirements.txt
|
+-- docs/
    |-- API_DOCUMENTATION.md           # Full API reference (60+ endpoints)
    +-- DATABASE_SCHEMA.md             # Firestore schema reference
```

---

## Installation

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.12
- **Expo CLI**: `npm install -g expo-cli`
- **EAS CLI**: `npm install -g eas-cli`
- A **Firebase** project with Firestore enabled
- An **Expo** account (for push notifications and EAS Build)

---

### 1. Clone the Repository

```bash
git clone https://github.com/Deemah9/FinalProject-DiaConnectFamily.git
cd FinalProject-DiaConnectFamily
```

---

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
# SMTP (Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Backend public URL (used in email links)
BACKEND_URL=http://your-server-ip:8000

# JWT signing secret — use a random 32+ character string
SECRET_KEY=your-secret-key-min-32-chars
```

Place your Firebase service account key at:
```
backend/app/config/service-account-key.json
```
Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key.

Start the backend:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Place your `google-services.json` (from Firebase Console → Project Settings → Android app) in `frontend/`.

> `google-services.json` is excluded from git (`.gitignore`). It contains an API key and must never be committed. It is required locally for Android push notifications.

---

### 4. Run the Frontend

**Web:**
```bash
npx expo start --web
```

**Android — development build required** (Expo Go does not support push notifications):

Option A — EAS Cloud Build (recommended for Windows):
```bash
npx eas build --profile development --platform android
# Install the resulting APK on your device or emulator
npx expo start --dev-client
```

Option B — Local build (requires Android Studio + SDK with long paths enabled):
```bash
npx expo run:android
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `SMTP_HOST` | Yes | SMTP server hostname |
| `SMTP_PORT` | Yes | SMTP port (587 for TLS) |
| `SMTP_USER` | Yes | Sender email address |
| `SMTP_PASSWORD` | Yes | SMTP app password (not your account password) |
| `BACKEND_URL` | Yes | Public URL used in password-reset email links |
| `SECRET_KEY` | Yes | JWT signing secret (min 32 chars, random) |

### Firebase

`backend/app/config/service-account-key.json` — Firebase service account private key. Download from Firebase Console → Project Settings → Service Accounts.

### Frontend

The EAS project ID is embedded in `frontend/app.json` under `extra.eas.projectId`. No additional `.env` file is needed for the frontend.

---

## Database

**Technology:** Firebase Firestore (NoSQL document store)  
**Region:** `me-west1` (Tel Aviv)

### Collections

| Collection | Purpose |
|---|---|
| `users` | All accounts (patients + family members), health profile, preferences, push token |
| `glucose_readings` | Immutable glucose measurements (manual, LibreView CSV, CGM) |
| `predictions` | LSTM prediction results per user |
| `alerts` | Triggered alerts (high/low glucose events) |
| `notifications` | Push notification history (read/unread state per user) |
| `family_patient_links` | Many-to-many patient ↔ family member relationships |
| `pairing_codes` | Short-lived invite codes for family pairing |
| `meals` | Meal entries (name, carbs, meal type, timestamp) |
| `activities` | Physical activity logs |
| `sleep_logs` | Sleep duration entries |
| `insulin_logs` | Insulin dose entries |
| `password_reset_tokens` | One-time tokens for password reset flow |

### Key Relationships

```
users (patient)  ──< family_patient_links >──  users (family_member)
users (patient)  ──< glucose_readings
users (patient)  ──< predictions
users            ──< notifications
```

### Required Firestore Composite Index

The predictions query requires a composite index. Create it via Firebase Console or click the index creation link that appears in the backend logs:

- Collection: `predictions`
- Fields: `userId` (Ascending), `createdAt` (Ascending)

---

## API Summary

**Base URL:** `http://localhost:8000`  
**Auth:** `Authorization: Bearer <JWT>`  
**Interactive docs:** `http://localhost:8000/docs`  
**Full reference:** [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)

| Router | Prefix | Key Endpoints |
|---|---|---|
| Auth | `/auth` | register, login, forgot-password, reset-password, change-password, delete account |
| User | `/users` | profile CRUD, preferences, reminders, emergency contacts, push token |
| Glucose | `/glucose` | add reading, list, stats, CSV import |
| Prediction | `/glucose/predict` | AI prediction (LSTM, 1-hour horizon) |
| Alerts | `/alerts` | list alert history |
| Family | `/family` | invite, join, list links, remove link |
| Notifications | `/notifications` | list, unread count, mark read, delete |
| Daily Logs | `/logs` | meals, insulin, activity, sleep CRUD |
| Health | `/health` | health profile (conditions, ISF, basal insulin) |
| LibreView | `/libreview` | CSV upload, CGM data import |

---

## Authentication

### Registration Flow
1. `POST /auth/register` — creates account and sends a verification email
2. User clicks the link in the email → account marked as verified in Firestore
3. Unverified users cannot access protected routes

### Login
- `POST /auth/login` → returns a **JWT** (24-hour expiry)
- All protected routes require `Authorization: Bearer <token>`
- `401` responses automatically log the user out on the client

### Password Reset
1. `POST /auth/forgot-password` → sends email with a one-time reset link
2. User opens link → HTML reset form served by the backend
3. Submits `POST /auth/reset-password` with token + new password

### Roles

| Role | Access |
|---|---|
| `patient` | Full access to own data, glucose entry, prediction, daily log |
| `family_member` | Read-only access to linked patient data and own notifications |

---

## Notifications

### Types

| Type | Trigger | Recipients |
|---|---|---|
| **Emergency Alert** | Glucose < 70 or > 180 mg/dL on new reading | Patient + all linked family members |
| **Prediction Alert** | LSTM predicts high or low risk | Patient + all linked family members |
| **Stale Pattern Alert** | No readings in 24h but historical risk detected | Patient + all linked family members |
| **Glucose Reminder** | Every 4 hours (or custom schedule) if no recent reading | Patient only |

### Delivery Flow

```
Glucose entry / Scheduled job
        |
        v
  family_service.py
        |
        |-- Save to Firestore (notifications collection)
        |
        +-- Expo Push API --> FCM --> Device
```

### Implementation Notes

- Push tokens registered via `PUT /users/me/push-token` on app startup
- Rate limiting prevents duplicate alerts (high/low: 60 min cooldown, patch error: 120 min)
- All notifications persist in Firestore with `isRead` state for history
- Web platform uses a 60-second polling fallback instead of push
- **Android requires a development build** — Expo Go does not support push notifications

---

## Prediction Module

### Overview

The prediction engine (`backend/app/services/prediction_service.py`) forecasts glucose levels **1 hour ahead** using an LSTM neural network with an ensemble fallback.

### Architecture

```
Incoming glucose readings
        |
        v
  Mode selection
        |
        |-- real_time  (data < 24h) --> LSTM prediction
        |       |
        |       +-- Fine-tuning on patient's personal data (15 epochs)
        |
        +-- pattern    (data > 24h) --> Historical Pattern Analysis
                |                       + LSTM seeded from pattern average
                +-- Weighted average of readings in +-1.5h window over 30 days

        Both modes --> Ensemble (LSTM + trend + pattern weights)
                |
                +-- Alert if predicted value is out of range
```

### Model Details

| Property | Value |
|---|---|
| Architecture | LSTM (sequence-to-one) |
| Input features | 6 (glucose, carbs, insulin, activity, sleep, time) |
| Sequence length | 12 readings |
| Base model | Pre-trained on population data (`models/base_model.keras`) |
| Fine-tuning | Per-patient, triggered every 10 new readings |
| Minimum readings | 15 (required to produce a prediction) |
| Output | Predicted glucose (mg/dL) + trend direction + AI advice text |

### Alert Types

| Alert | Condition |
|---|---|
| High Glucose Rising | Predicted > 180, current < predicted |
| High Glucose Stable | Predicted > 180, predicted approximately equals current |
| Low Glucose Dropping | Predicted < 70, current > predicted |
| Low Glucose Stable | Predicted < 70, predicted approximately equals current |
| Patch Error | CGM reading jump > 80 mg/dL (likely sensor error) |

---

## Development

### Running Tests (Backend)

```bash
cd backend
pytest tests/ -v
```

### Backend Hot Reload

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Metro Bundler

```bash
cd frontend
npx expo start --dev-client   # development build (push notifications)
npx expo start --web          # web browser
```

### EAS Build (Production APK)

```bash
npx eas build --profile production --platform android
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Push notifications not received on emulator | Sign in to a Google account in the emulator, then open Google Play Store |
| `FirebaseApp is not initialized` | `google-services.json` is missing — download from Firebase Console and place in `frontend/` |
| `SERVICE_NOT_AVAILABLE` (FCM) | Google Play Services not signed into an account on the emulator |
| `Filename longer than 260 characters` (Windows build) | Enable Windows long paths: run as Administrator `Set-ItemProperty HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem LongPathsEnabled 1` and reboot, or use EAS Build instead |
| `CA signature digest algorithm too weak` (EAS) | Upgrade EAS CLI: `npm install -g eas-cli` |
| Prediction not loading | Requires at least 15 glucose readings. Also check that the Firestore composite index is built (see Database section) |
| `The query requires an index` (Firestore) | Click the index creation URL printed in the backend logs to build the missing composite index |
| Backend not reachable from emulator | Use `http://10.0.2.2:8000` — the special IP Android emulator uses to reach the host machine's localhost |

---

## Roadmap

- [ ] **iOS support** — Currently Android + Web only; iOS push notifications require an Apple Developer account
- [ ] **LibreView live sync** — CSV import is implemented; real-time CGM API sync is in progress
- [ ] **Wearable integration** — Planned connection to smartwatch glucose sensors
- [ ] **Offline mode** — Currently requires internet connection for all features
- [ ] **LLM-generated advice** — AI advice text framework is in place; Groq/LLM integration is partially implemented

---

## Contributors

**Deema Dwayat** — Software Engineering, Azrieli College of Engineering, Jerusalem

**Wajde Alfrawna** — Software Engineering, Azrieli College of Engineering, Jerusalem

**Department:** Software Engineering  
**Institution:** Azrieli College of Engineering, Jerusalem  
**Project Type:** Graduation Project (Final Year)

---

## License

This project was developed as an academic graduation project at **Azrieli College of Engineering**. All rights are reserved by the authors and the institution.
