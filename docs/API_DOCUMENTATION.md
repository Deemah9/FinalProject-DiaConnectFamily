# DiaConnect Family — API Documentation

**Framework:** FastAPI (Python)
**Base URL (local):** `http://localhost:8000` (web) / `http://10.0.2.2:8000` (Android emulator)
**Authentication:** Bearer JWT, except where noted as unauthenticated
**Interactive docs:** `http://127.0.0.1:8000/docs` (Swagger, auto-generated — always the source of truth for exact request/response schemas; this file is a human-readable companion)

> This replaces the earlier v1.0.0 draft, which documented ~14 endpoints from Week 2. The backend now exposes 60+ endpoints across 10 routers. Every endpoint below was verified against the current route/model/service code.

---

## Auth header

```
Authorization: Bearer <token>
```

Token comes from `POST /auth/login` or `POST /auth/register` (both return a token immediately). Expiry: 1440 minutes (24h).

---

## 1. Auth — `/auth`

### POST /auth/register
Public. Body: `{email, password, first_name, last_name, role, phone?}` (`role` must be `"patient"` or `"family_member"`; password must satisfy a complexity regex).
Response `201`: `{message, userId, email, role, accessToken}`

### POST /auth/login
Public. Body: `{email, password}`
Response `200`: `{message, userId, email, role, accessToken}`

### GET /auth/me
Any authenticated user. Response: `{userId, email, role, firstName?, lastName?, phone?}`. `404` if the user document is missing.

### POST /auth/forgot-password
Public. Body: `{email}`. Always returns `200` (doesn't reveal whether the account exists); emails a reset link if it does.

### POST /auth/reset-password
Public. Body: `{token, new_password}`. Validates the reset token, updates the password, marks the token used.

### POST /auth/change-password
Authenticated. Body: `{current_password, new_password, confirm_password}`.

### DELETE /auth/account
Authenticated. Body: `{password}`. `204 No Content`.
Cascades: **patient** → deletes own `glucose_readings`, `family_patient_links`, `pairing_codes`, `meals`, `activities`, `sleep_logs`. **family_member** → deletes own `family_patient_links` only.

### GET /auth/reset-redirect
Public. Query `token`. Returns an HTML page (a browser-facing password-reset form that posts to `/auth/reset-password`) — this is a UX bridge for reset links opened outside the app, not a JSON API.

---

## 2. User Profile — `/users`

### GET /users/me
Returns the full Firestore user document (includes `uid`, plus default-filled `lifestyle`/`medical` if absent). No fixed shape beyond that — reflects whatever has been written to the document.

### PUT /users/me
Whitelisted fields only: `firstName`, `lastName`, `phone`, `dateOfBirth`, `gender`, `language`. `400` if none of these are present in the body.

### PUT /users/me/medical
**Patients only.** Body is an arbitrary object — overwrites the entire `medical` field wholesale (no server-side schema). `403` for family members.

### PUT /users/me/lifestyle
All roles. Same wholesale-overwrite behavior as `/medical`, no role restriction.

### GET / PUT /users/me/preferences
Whitelisted keys: `theme`, `fontScale`, `highContrast`, `hapticEnabled`.

### GET / PUT /users/me/reminders
Shape: `{enabled, reminders: [{name, time}]}`. `GET` auto-converts a legacy `times: [...]` array into this shape for backward compatibility.

### GET / PUT /users/me/emergency-contacts
Shape: `{contacts: [{id, name, phone}]}`. `PUT` replaces the entire list.

### PUT /users/me/push-token
Body: `{token}`. Stores an Expo push token, used for emergency and prediction alert delivery.

---

## 3. Glucose — `/glucose` (CRUD/import)

### POST /glucose/
**Patients only.** Body: `{value (40–600), measuredAt}`. `measuredAt` cannot be more than 2 minutes in the future; always include a timezone offset (e.g. `+02:00`).
`201`: `{id, value, measuredAt, source: "manual", createdAt}`.
Side effects: evaluates/stores an `alerts` entry; if `value < 70` or `value > 300`, fires a background emergency push + notification to the patient and linked family members.

### GET /glucose/
Query `limit` (default 500, capped 2000). Returns readings for the current user, descending by `measuredAt`.

### GET /glucose/latest
Most recent reading. `404` if none exist.

### GET /glucose/stats
Query `days` (must be `7`, `14`, or `30` — `400` otherwise).
Response: `{count, average, min, max, time_in_range, days}` (`average`/`min`/`max`/`time_in_range` are `null` if no readings exist). `time_in_range` = % of readings in 70–180 mg/dL.

### GET /glucose/a1c
**Patients only.** Estimated HbA1c from the last 90 days (Nathan et al. formula: `eA1C = (avg + 46.7) / 28.7`), plus an ADA time-in-range breakdown (`very_low <54`, `low 54–70`, `in_range 70–180`, `high 180–250`, `very_high >250`). Flags low reliability if the data span is under 14 days.

### PATCH /glucose/{reading_id}
**Patients only.** Body: `{value}`. Only editable for `source == "manual"` readings owned by the caller — CSV/CGM-imported readings cannot be edited. `403` otherwise.

### DELETE /glucose/{reading_id}
**Patients only.** Permanently disabled — always returns `403`. Kept in the API surface intentionally so the intent (no deletion of medical records) is explicit rather than the route simply not existing.

### POST /glucose/import-csv
**Patients only.** Multipart file upload, `.csv`, ≤5MB. Parses a FreeStyle LibreLink CSV export (last 90 days only; CGM rows deduplicated to one per 15 minutes). Response: `{imported_count, skipped_count, source: "csv"}`.

---

## 4. Prediction — also under `/glucose` (separate router: `prediction.py`)

### GET /glucose/predict
**Patients only.** Query `hours` (1–24, default 1), `lang` (`ar`/`en`/`he`, default `ar`).
Runs a per-user fine-tuned LSTM if the last reading is under 24h old (`real_time` mode); falls back to historical pattern analysis if data is stale (`pattern` mode); returns `prediction_mode: "none"` if fewer than 10 usable readings exist.
Response fields: `predicted_value, hours, trend, alert_type, probability, prob_up, prob_down, advice {patient, family}, readings_used, message, family_message, data_stale, hours_since_last_reading, prediction_mode, pattern_prediction, comparison_to_pattern`.

### GET /glucose/predict/family
**Family members only.** Query `patient_id`, `hours`, `lang`. Same response shape as above, for a linked patient. `403` if the caller isn't linked to that patient.

### GET /glucose/predict/accuracy
**Patients only.** Response: `{evaluated_predictions, mae_mg_dl, rmse_mg_dl, within_15_mg_dl_pct, within_20_mg_dl_pct, within_30_mg_dl_pct, message}`.
Computed only from **real-time/hybrid-mode** predictions that have had their `actualValue` filled in — pattern-mode predictions are never persisted, so they're excluded from this metric.

---

## 5. Daily Logs — `/daily-logs`

> All timestamps require an explicit timezone offset. Logging is optional — intended for events that differ from the user's baseline `lifestyle` profile, not exhaustive daily tracking.

### POST /daily-logs/meals
Body: `{carbs (0–500), foods?, meal_type?, notes?, timestamp}`. `201`.
Note: `meal_type` is accepted here but **not currently persisted** by the backend (see Database Schema doc) — `MealResponse.meal_type` will come back `null` regardless of what was sent.

### POST /daily-logs/activities
Body: `{type, duration_minutes (0–1440), notes?, timestamp}`. `201`.

### POST /daily-logs/sleep
Body: `{sleep_hours (0–24), notes?, timestamp}`. `201`.

### GET /daily-logs/today
Last 24 hours (timestamp-based, not calendar day). Response: `{meals, activities, sleep, insulin}`.

### GET /daily-logs/by-date
Query `date` (`YYYY-MM-DD`). Same response shape as `/today`, for a specific calendar date.

### GET /daily-logs/summary
Query `days` (`7`/`14`/`30`, else `400`). Response: `{meals_count, avg_carbs, activities_count, total_activity_minutes, sleep_count, avg_sleep_hours, days}`.

### DELETE /daily-logs/meals/{id} · /activities/{id} · /sleep/{id}
Deletes the caller's own log entry. `204`. `404` if not found or not owned.

---

## 6. Alerts — `/alerts`

Simple high/low glucose alert feed (`type: "high" | "low"`, thresholds 180/70 — see Database Schema doc for how this differs from the emergency push-notification thresholds).

| Method + Path | Role | Notes |
|---|---|---|
| GET /alerts/ | any | Query `limit` (default 20, capped 100). Own alerts, most recent first. |
| PATCH /alerts/read-all | any | Marks all own alerts read. |
| GET /alerts/patient/{patient_id} | family_member | `403` if not linked to that patient. |
| PATCH /alerts/patient/{patient_id}/{alert_id}/read | family_member | `404` if alert not found. |
| PATCH /alerts/patient/{patient_id}/read-all | family_member | |

`AlertResponse`: `{id, type, value, readingId, createdAt, read}`

---

## 7. Family Connection — `/family`

| Method + Path | Role | Notes |
|---|---|---|
| POST /family/view | **unauthenticated** | Body `{code}`. Public pairing-code viewer — no login required. `400` on invalid code. Response: `{patient_id, patient_name, readings: [...]}`. |
| POST /family/generate-code | patient | 6-char code, valid 7 days. Generating a new one invalidates any previous unused code. |
| POST /family/join | family_member | Body `{code}`. Links to the patient; `400` on invalid/expired/used code. |
| GET /family/my-members | patient | Family members linked to the current patient. |
| DELETE /family/members/{link_id} | patient | Removes a family-member link. `404` if not found/owned. |
| GET /family/patients | family_member | Patients linked to the current family member. |
| DELETE /family/patients/{link_id} | family_member | Removes a patient link. |
| GET /family/patient/{patient_id}/daily-logs | family_member | Query `days` (1–30). `403` if not linked. |
| GET /family/patient/{patient_id}/glucose | family_member | Query `limit` (1–200). `403` if not linked. |

---

## 8. LibreView Sync — `/libreview`

### POST /libreview/sync
**Patients only.** Body: `{email, password}` — LibreView/LibreLinkUp credentials, used only for the duration of this request and never persisted. Logs in, fetches history, imports new readings (deduplicated by timestamp), evaluates alerts for each imported reading.
Response: `{imported_count, skipped_count, source: "libreview"}`.
Errors: `401` wrong credentials, `502` LibreView API error, `504` network timeout.

---

## 9. Health / Insulin — `/health`

> Note: `GET /health` (defined directly in `main.py`, no path segment after it) is a separate, unauthenticated liveness check (`{status, service}`) — distinct from this router.

| Method + Path | Role | Notes |
|---|---|---|
| GET /health/reference | public | Static reference lists for dropdowns: `{conditions, fast_insulin_types, slow_insulin_types}`. |
| GET /health/info | patient | `{conditions, basal_insulin, insulin_sensitivity}`. |
| PUT /health/info | patient | Body: `{conditions[], basal_insulin?, insulin_sensitivity?}`. Replaces the health profile wholesale. |
| POST /health/insulin | patient | Body: `{insulin_type="fast", units (0.5–100), timestamp}`. Logs a bolus dose. `201`. |
| GET /health/insulin/today | any | Fast-insulin doses in the last 24h. |
| GET /health/insulin/by-date | any | Query `date` (`YYYY-MM-DD`). |
| DELETE /health/insulin/{dose_id} | patient | `404` if not found/owned. |

---

## 10. Notifications — `/notifications`

| Method + Path | Role | Notes |
|---|---|---|
| POST /notifications/reminder-fired | any | Body `{title, body}`. Records that a local/scheduled reminder fired. |
| GET /notifications/ | any | All notifications for the current user. |
| GET /notifications/unread-count | any | `{unread_count}`. |
| PATCH /notifications/read-all | any | |
| PATCH /notifications/{id}/read | any | `404` if not found. |
| DELETE /notifications/clear-all | any | `{deleted: count}`. |
| DELETE /notifications/{id} | any | `404` if not found. |

---

## Root endpoints

| Method + Path | Auth | Notes |
|---|---|---|
| GET / | none | `{message, status, version, docs}` — API info. |
| GET /health | none | `{status, service}` — plain liveness check (not the `/health/*` router above). |

---

## Error Codes

| Code | Meaning |
|---|---|
| 400 | Bad Request — invalid or missing fields |
| 401 | Unauthorized — invalid or expired token |
| 403 | Forbidden — insufficient role, not linked, or a disabled operation (e.g. glucose delete) |
| 404 | Not Found |
| 422 | Unprocessable Entity — Pydantic validation error |
| 500 | Internal Server Error |
| 502 / 504 | Upstream (LibreView) error / timeout — `/libreview/sync` only |

---

## Background Jobs (backend/app/main.py)

The backend runs an in-process `BackgroundScheduler` (APScheduler) — these are not endpoints, but they call the same services and are worth knowing about since they generate the same alerts/notifications a user-triggered request would:

- **Glucose reminders**, every `REMINDER_INTERVAL_HOURS` (see `reminder_service.py`) — pushes a reminder to patients who haven't logged a reading recently and don't have custom reminders configured.
- **Auto-prediction**, every 60 minutes — runs the LSTM prediction for every patient with a reading under 6 hours old, on a background thread per patient. This is why predictions/alerts can appear without the app being open; rate-limiting inside `prediction_service` still applies.

Both jobs run only while the FastAPI process is up — there is no persistence/replay if the server restarts mid-interval.

---

## Notes for Frontend

- Always send timestamps with an explicit timezone offset (e.g. `"2026-07-03T08:00:00+03:00"`) — the server assumes UTC for naive datetimes and rejects readings/events more than a few minutes in the future (2 min for glucose, 10 min for meals/activities/sleep/insulin).
- CORS currently allows all origins (`allow_origins=["*"]`, `allow_credentials=False`) — there is no origin whitelist to keep in sync with; this is intentionally permissive for development and should be tightened before a production release.
- The single frontend integration point is `frontend/services/api.js` — every backend call in the app goes through it.

---

**Last verified against code:** 2026-07-03
