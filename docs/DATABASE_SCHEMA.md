# DiaConnect Family - Database Schema

**Project:** Type 2 Diabetes Monitoring & Prediction Platform
**Database:** Firebase Firestore
**Region:** me-west1 (Tel Aviv)
**Status:** Reflects the actual backend implementation (models + services), not a design draft.

> This document replaces the earlier `DATABASE_SCHEMA.md` / `DATABASE_SCHEMA2.md` drafts, which described a Week 2/3 plan that has since diverged from the shipped code (collection names, fields, and even entire subsystems like alerts/family/predictions/notifications changed). Everything below was verified against `backend/app/models/`, `backend/app/services/`, and `backend/app/routes/`.

---

## Collections Overview

```
Firestore
├── users
├── glucose_readings
├── meals
├── activities
├── sleep_logs
├── insulin_logs
├── predictions
├── alerts
├── notifications
├── pairing_codes
├── family_patient_links
└── password_reset_tokens
```

There is **no `family_connections` or `daily_logs` collection** — those were renamed/replaced during implementation (see `family_patient_links` and the three event collections below).

---

## 1. users

**Purpose:** All accounts (patients and family members). One document per user, keyed by Firebase Auth UID.

**Top-level fields** (`app/models/user.py`, hand-rolled `User` class — not Pydantic):

- `email`: string
- `password`: string (bcrypt hash)
- `role`: `"patient" | "family_member"`
- `firstName`, `lastName`: string | absent (only written if truthy)
- `phone`: string | absent
- `isActive`: boolean (default `true`) — soft-delete flag
- `createdAt`, `updatedAt`: timestamp (UTC)
- `dateOfBirth`, `gender`, `language`: string | absent — set via `PUT /users/me` (whitelisted raw-dict update, no schema enforced beyond the field whitelist)
- `pushToken`: string | absent — Expo push token, set via `PUT /users/me/push-token`

**Nested objects (no fixed Pydantic schema unless noted — shape is whatever the client last wrote):**

- `medical`: object | absent — overwritten wholesale by `PUT /users/me/medical` (**patients only**). No server-side field validation; shape is client-defined.
- `lifestyle`: object | absent — overwritten wholesale by `PUT /users/me/lifestyle` (all roles). Read by `prediction_service` for `activity_level` (default `"moderate"`) and `sleep_hours` (default `7.0`).
- `health`: object | absent — the only nested object with an actual Pydantic schema (`app/models/health.py`), updated via `PUT /health/info` (**patients only**):
  - `conditions`: array of strings, each must be one of `CONDITION_IDS` (hypertension, kidney_disease, heart_disease, dyslipidemia, obesity, neuropathy, condition_other)
  - `basal_insulin`: object | null — `{type, dose, time}` (`type` must be a slow-insulin ID, `dose` 1–200 units, `time` "HH:MM")
  - `insulin_sensitivity`: number (ISF, mg/dL drop per unit of fast insulin), default `30.0` if unset
- `preferences`: object | absent — whitelisted keys only: `theme`, `fontScale`, `highContrast`, `hapticEnabled` (`GET/PUT /users/me/preferences`)
- `reminderSettings`: object — `{enabled: boolean, reminders: [{name, time}]}` (`GET/PUT /users/me/reminders`); legacy `times: [...]` shape is auto-converted on read for backward compatibility
- `emergencyContacts`: object — `{contacts: [{id, name, phone}]}` (`GET/PUT /users/me/emergency-contacts`), full list replaced on every save

**Indexes:** `email` (ascending), `role` (ascending), `createdAt` (descending)

**Access control:** patients have full access to their own document; family members can read their own document only. Medical fields are patient-only (403 for family members).

---

## 2. glucose_readings

**Purpose:** Immutable-by-design glucose measurements (manual entry, LibreView sync, or CSV import).

**Fields written** (`app/models/glucose_reading.py::GlucoseDocument`, `app/services/glucose_service.py`):

- `userId`: string (ref → `users`)
- `value`: integer, mg/dL
- `measuredAt`: timestamp (UTC)
- `source`: `"manual" | "libreview" | "libreview_csv" | "csv" | "csv_cgm" | "csv_scan"`
- `createdAt`: timestamp (UTC)

> **No `unit` field exists on this document.** Some read paths (`family_service`) defensively do `d.get("unit", "mg/dL")`, but nothing ever writes `unit` — all values are implicitly mg/dL.

**Validation:** `value` 40–600 mg/dL; `measuredAt` cannot be more than 2 minutes in the future.

**Mutability:** Only `value` can be patched (`PATCH /glucose/{id}`), and only for `source == "manual"` readings owned by the caller. `DELETE /glucose/{id}` is permanently disabled (always returns 403) — incorrect manual readings must be corrected via edit, not delete.

**Indexes:**
- `userId` + `measuredAt` (composite, descending) — used by `family_service` for a linked family member's view
- Most first-party reads (`get_readings`, `calculate_stats`, `get_estimated_a1c`, prediction context) deliberately stream by `userId` only and sort/filter in Python to avoid needing this index — so it is only required for the family-view path.

---

## 3. meals

**Purpose:** Event-based meal log (timestamp-based, not calendar-date-based — a meal at 10 PM can affect glucose into the next day).

**Fields written** (`app/services/daily_log_service.py::add_meal`):

- `userId`: string
- `carbs`: integer, 0–500 g
- `foods`: string | null
- `notes`: string | null
- `timestamp`: timestamp (UTC)
- `createdAt`: timestamp (UTC)

> **`meal_type` is accepted by the API (`MealCreate.meal_type`, e.g. breakfast/lunch/dinner/snack) but is silently dropped and never persisted.** `MealResponse.meal_type` will always come back `null`. Fix this in the service if the field is actually needed, or drop it from the model/API docs if it's dead.

**Validation:** `timestamp` cannot be more than 10 minutes in the future.

**Design decision:** carbs are tracked instead of calories because carbs have a direct, near-term glucose impact.

**Indexes:** `userId` + `timestamp` (composite) — required by `family_service.get_patient_daily_logs`; own-user reads avoid it by filtering in Python.

---

## 4. activities

**Fields written:** `userId`, `type` (free text, e.g. "walking"), `duration_minutes` (0–1440), `notes` | null, `timestamp`, `createdAt`.

Same timestamp validation and indexing notes as `meals`.

---

## 5. sleep_logs

**Purpose:** Records *exceptions* to the user's baseline sleep pattern (baseline lives in `users.lifestyle`), not nightly tracking.

**Fields written:** `userId`, `sleep_hours` (0–24, float), `notes` | null, `timestamp`, `createdAt`.

Same timestamp validation and indexing notes as `meals`.

---

## 6. insulin_logs

**Purpose:** Fast/bolus insulin dose log (basal insulin is a single value stored on `users.health.basal_insulin`, not logged as events).

**Fields written** (`app/services/health_service.py`):

- `userId`: string
- `insulin_type`: string, default `"fast"`
- `units`: float, 0.5–100
- `timestamp`: timestamp (UTC), same 10-minute-future validation as other events
- `createdAt`: timestamp (UTC)

**Used by:** `prediction_service._compute_insulin_effect` (last 4 hours) to subtract an insulin-decay curve from the glucose prediction.

**Indexes:** none required — all reads filter by `userId` only, then by `timestamp` in Python.

---

## 7. predictions

**Purpose:** Persisted record of real-time/hybrid LSTM predictions, later reconciled against the actual reading for accuracy tracking.

**Fields written** (`app/services/prediction_service.py`):

- `userId`, `predictedValue`, `currentValue`, `hours`, `trend`, `alertType`, `predictionMode`
- `actualValue`: null at write time, filled in later by `glucose_service._fill_prediction_actuals` when a new reading lands within ±30 min of `createdAt + hours`
- `createdAt`: timestamp (UTC)

> **Pattern-mode predictions (data stale > 24h) are never written here** — only `real_time`/hybrid mode predictions are persisted, so `GET /glucose/predict/accuracy` only ever reflects real-time-mode accuracy.

**Write is rate-limited:** skipped if a prediction for the same user was already saved in the last 20 minutes.

**Indexes:** `userId` + `createdAt` (composite) — required for both the rate-limit check and the accuracy backfill query.

---

## 8. alerts

**Purpose:** Simple high/low glucose alert feed (separate from the emergency push-notification system — see note below).

**Fields written** (`app/services/alert_service.py`):

- `userId`, `type` (`"high" | "low"`), `value`, `readingId`, `createdAt`, `read` (boolean, default `false`)

**Thresholds:** high > 180 mg/dL, low < 70 mg/dL.

> **Two independent threshold systems exist and can disagree.** This `alerts` collection uses 70/180. The emergency *push notification* triggered directly from `glucose_service.create_reading` uses 70/300 (`DANGEROUS_LOW`/`DANGEROUS_HIGH`). A reading of 250 mg/dL creates an `alerts` document but does **not** trigger an emergency push.

**Retention:** `get_alerts` auto-deletes any alert older than 7 days as a side effect of listing them.

**Indexes:** none required for the primary (per-user) read path — filtered by `userId` and sorted in Python.

---

## 9. notifications

**Purpose:** Generic notification inbox used by emergency alerts, prediction alerts, and glucose reminders — client renders localized text from `notifKey`/`notifParams` rather than trusting server-baked strings.

**Fields written** (`app/services/notification_service.py`):

- `userId`, `type` (e.g. `"emergency_alert"`, `"prediction_alert"`, `"glucose_reminder"`)
- `title`, `body`: string (server-baked fallback text)
- `glucoseValue`: integer | null
- `isRead`: boolean (default `false`)
- `createdAt`: timestamp (UTC)
- `patientName`, `notifKey`, `notifParams`: present only when provided by the caller

**Indexes:** `userId` + `createdAt` (composite, descending); `userId` + `isRead` (composite) — both required.

---

## 10. pairing_codes

**Purpose:** Short-lived, single-use codes patients generate to link a family member.

**Fields written** (`app/services/family_service.py`):

- `code`: 6-char uppercase alphanumeric, unique among currently-unused codes
- `patient_id`: string
- `created_at`, `expires_at`: timestamp (expires after 30 minutes)
- `used`: boolean

**Business rule:** generating a new code deletes all previously-unused codes for that patient — only one active code at a time.

---

## 11. family_patient_links

**Purpose:** The actual patient ↔ family-member relationship (this replaces the planned `family_connections` collection — no permission-granularity object exists; access is all-or-nothing per link).

**Fields written:**

- `family_member_id`, `patient_id`: string (refs → `users`)
- `patient_name`: string — denormalized snapshot taken at link time
- `linked_at`: timestamp

> **`family_member_name` is read defensively (`d.get("family_member_name", "")`) but never written.** `get_family_members` always resolves the name live from the `users` collection instead — the field can be considered dead on this document.

**Indexes:** none required — lookups filter by `patient_id` or `family_member_id` only.

---

## 12. password_reset_tokens

**Fields written** (`app/models/password_reset_token.py`):

- `token`: URL-safe random string (32 bytes)
- `userId`, `email`: string
- `expiresAt`: timestamp (60 minutes from creation)
- `used`: boolean

Queried by `token` + `used == false`; expiry checked manually (not a Firestore TTL policy).

---

## Design Rationale

### Event-based architecture (meals / activities / sleep_logs / insulin_logs)
Timestamp-based, not calendar-date-based, so a late-night event is correctly associated with the glucose readings it affects rather than the day it was logged. `users.lifestyle` stores the **baseline** pattern; these collections store **exceptions** and discrete events only.

### Immutable glucose readings
No update-in-place beyond correcting a manual entry's `value`; deletion is disabled outright. This preserves the integrity of the historical series that the prediction model and accuracy tracking depend on.

### Denormalization
`patient_name` on `family_patient_links` and `patientName` on `notifications` are intentional denormalizations to avoid a join-style lookup on every read — standard Firestore pattern, not an oversight.

### Composite indexes actually required
Only these query shapes need a composite index (everything else deliberately does a single-field `where` and sorts/filters in Python to avoid the index requirement):

| Collection | Index | Used by |
|---|---|---|
| `glucose_readings` | `userId` ↑, `measuredAt` ↓ | Family member viewing a linked patient's readings |
| `predictions` | `userId` ↑, `createdAt` ↑ | Rate-limit check on write; accuracy backfill in `glucose_service` |
| `notifications` | `userId` ↑, `createdAt` ↓ | Notification inbox listing |
| `notifications` | `userId` ↑, `isRead` ↑ | Unread count / mark-all-read |
| `meals`, `activities`, `sleep_logs` | `userId` ↑, `timestamp` ↑ | Family member viewing a linked patient's daily logs |

Indexes are auto-created on first query — Firestore surfaces a console link in the error when one is missing.

---

## Known Data-Model Discrepancies (verified against code, not yet fixed)

These are worth resolving in code or explicitly deciding to leave as-is — listed here so they aren't lost:

1. `glucose_readings.unit` — read with a fallback, never written.
2. `meals.meal_type` — accepted by the API, dropped before the Firestore write.
3. `family_patient_links.family_member_name` — read with a fallback, never written.
4. Alert thresholds (70/180 in `alerts`) vs. emergency-push thresholds (70/300 in `glucose_service`) are two separate, unsynchronized systems.
5. Prediction alert rate-limiting (`prediction_service._last_alert_sent`) is in-process memory, not Firestore-backed — resets on every backend restart/deploy.

---

**Last verified against code:** 2026-07-03
**Authors:** Deema Dweyyat + Wajdi Alfarawna
**Supervisor:** Dr. Roger Cohen
