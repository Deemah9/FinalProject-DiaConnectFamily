# DiaConnect Family - Database Schema

**Project:** Type 2 Diabetes Monitoring & Prediction Platform  
**Database:** Firebase Firestore  
**Region:** me-west1 (Tel Aviv)  
**Created:** December 19, 2024  
**Last Updated:** March 1, 2026

---

## Collections Overview

```
Firestore
├── users                  ✅ Active
├── glucose_readings       ✅ Active
├── meals                  ✅ Active (event-based)
├── activities             ✅ Active (event-based)
├── sleep_logs             ✅ Active (event-based)
├── predictions            🔜 Week 3
├── alerts                 🔜 Week 3
└── family_connections     🔜 Week 3
```

> **Note:** `daily_logs` collection was replaced by three separate event-based collections
> (`meals`, `activities`, `sleep_logs`) for medical accuracy and AI integration readiness.

---

## 1. users

**Purpose:** Store all system users (patients and family members)

**Fields:**

- `userId`: string (Firebase Auth UID)
- `email`: string
- `firstName`: string
- `lastName`: string
- `phone`: string | null
- `role`: string ("patient" | "family_member")
- `dateOfBirth`: string | null
- `gender`: string | null ("male" | "female")
- `isActive`: boolean
- `medical`: object | null _(patients only)_
  - `diabetes_type`: string | null ("type2")
  - `diagnosis_year`: number | null
  - `medications`: array of strings
  - `comorbidities`: array of strings
  - `allergies`: array of strings
  - `blood_type`: string | null
  - `height`: number | null (cm)
  - `weight`: number | null (kg)
- `lifestyle`: object | null
  - `activity_level`: string | null ("low" | "moderate" | "high")
  - `sleep_hours`: number | null
  - `diet_type`: string | null
  - `smoking`: boolean | null
  - `alcohol`: boolean | null
- `createdAt`: timestamp
- `updatedAt`: timestamp

**Indexes:**

- `email` (ascending)
- `role` (ascending)
- `createdAt` (descending)

**Access Control:**

- Patients: full access to own document
- Family members: read-only based on `family_connections` permissions
- Medical fields: patients only (403 for family members)

---

## 2. glucose_readings

**Purpose:** Store all glucose readings (manual and LibreView)

**Fields:**

- `userId`: string (ref to users)
- `value`: number (mg/dL)
- `measuredAt`: timestamp
- `source`: string ("manual" | "libreview")
- `createdAt`: timestamp

**Validation:**

- `value`: 40–600 mg/dL
- `measuredAt`: cannot be in the future (10-minute buffer allowed)
- `source`: server-assigned ("manual" for API, "libreview" for sensor)

**Immutability:** Readings are immutable medical records — no updates allowed.

**Indexes:**

- `userId` + `measuredAt` (composite, descending) ✅ Created

**Notes:**

- CGM devices generate up to 288 readings/day per patient
- Archival strategy for readings older than 6 months: TBD (Week 5+)

---

## 3. meals

**Purpose:** Store meal events logged by users

**Fields:**

- `userId`: string (ref to users)
- `carbs`: number (grams, 0–500)
- `foods`: string | null
- `notes`: string | null
- `timestamp`: timestamp (when the meal occurred)
- `createdAt`: timestamp

**Validation:**

- `carbs`: 0–500 grams (required — directly impacts glucose levels)
- `timestamp`: cannot be in the future (10-minute buffer allowed)
- `foods`: optional — only logged when abnormal

**Design Decision:** Carbohydrates are tracked (not calories) because carbs directly
impact glucose levels in diabetic patients.

**Indexes:**

- `userId` + `timestamp` (composite, ascending) ✅ Created

---

## 4. activities

**Purpose:** Store physical activity events

**Fields:**

- `userId`: string (ref to users)
- `type`: string (e.g. "walking", "cycling", "swimming")
- `duration_minutes`: number (0–1440)
- `notes`: string | null
- `timestamp`: timestamp (when the activity occurred)
- `createdAt`: timestamp

**Validation:**

- `duration_minutes`: 0–1440 (max 24 hours)
- `timestamp`: cannot be in the future (10-minute buffer allowed)

**Indexes:**

- `userId` + `timestamp` (composite, ascending) ✅ Created

---

## 5. sleep_logs

**Purpose:** Store exceptional sleep events (when sleep differs from baseline)

**Fields:**

- `userId`: string (ref to users)
- `sleep_hours`: number (0–24)
- `notes`: string | null
- `timestamp`: timestamp (wake-up time)
- `createdAt`: timestamp

**Validation:**

- `sleep_hours`: 0–24 (float supported, e.g. 6.5)
- `timestamp`: cannot be in the future (10-minute buffer allowed)

**Design Decision:** Sleep baseline is stored in `users.lifestyle.sleep_hours`.
`sleep_logs` only records exceptions — not daily tracking.

**Indexes:**

- `userId` + `timestamp` (composite, ascending) ✅ Created

---

## 6. predictions (🔜 Week 3)

**Purpose:** ML model predictions for glucose levels

**Fields:**

- `predictionId`: string
- `userId`: string (ref to users)
- `predictedGlucose`: number (mg/dL)
- `predictionTime`: timestamp
- `confidenceScore`: number (0–1)
- `riskLevel`: string ("low" | "moderate" | "high")
- `riskFactors`: array of objects
- `modelVersion`: string
- `actualGlucose`: number | null
- `predictionError`: number | null
- `createdAt`: timestamp

---

## 7. alerts (🔜 Week 3)

**Purpose:** Alerts and notifications for patients and family members

**Fields:**

- `alertId`: string
- `userId`: string
- `type`: string ("high_glucose" | "low_glucose" | "prediction_risk")
- `severity`: string ("info" | "warning" | "critical")
- `title`: string
- `message`: string
- `isRead`: boolean
- `isAcknowledged`: boolean
- `sentToFamily`: boolean
- `createdAt`: timestamp
- `resolvedAt`: timestamp | null

---

## 8. family_connections (🔜 Week 3)

**Purpose:** Connect patients with family members with granular permissions

**Fields:**

- `connectionId`: string
- `patientId`: string (ref to users)
- `familyMemberId`: string (ref to users)
- `relationship`: string ("spouse" | "parent" | "child" | "sibling")
- `permissions`: object
  - `viewGlucose`: boolean
  - `viewPredictions`: boolean
  - `viewAlerts`: boolean
  - `viewDailyLogs`: boolean
  - `receiveAlerts`: boolean
- `status`: string ("pending" | "active" | "blocked")
- `invitedBy`: string
- `createdAt`: timestamp
- `acceptedAt`: timestamp | null

**Indexes:**

- `patientId` + `status` (composite)
- `familyMemberId` + `status` (composite)

---

## Design Rationale

### Event-Based Architecture (meals / activities / sleep_logs)

All daily log events use timestamp-based storage instead of date-based (YYYY-MM-DD).

**Reason:** A meal at 10:00 PM affects glucose levels into the next calendar day.
Date-based storage would misrepresent the causal relationship between events and glucose readings.

**Benefit for AI:** All events are time-ordered, enabling accurate causal analysis:
`meal at T` → `glucose reading at T+90min`

### Baseline vs. Events

- `users.lifestyle` stores the **baseline** (typical activity, sleep, diet pattern)
- `meals`, `activities`, `sleep_logs` store **exceptions** only
- This reduces data volume and focuses AI analysis on significant deviations

### Immutable Medical Records

`glucose_readings` are immutable — no updates allowed. Incorrect readings must be deleted and re-entered. This ensures data integrity for medical analysis.

### Timestamp Handling

- All timestamps stored as UTC in Firestore
- Frontend must always send timezone-aware timestamps (e.g. `+02:00`)
- Server applies 10-minute buffer to handle client timezone differences

---

## Access Control

**Patients:**

- Full access to own data across all collections
- Can manage family connections and permissions
- Only patients can add glucose readings and update medical info

**Family Members:**

- Read access based on `family_connections.permissions`
- Cannot modify patient data
- Currently: each user sees only their own data
- Week 3: family members will see linked patient data

---

## Validation Rules Summary

| Field              | Rule                               |
| ------------------ | ---------------------------------- |
| `email`            | Valid email format, unique         |
| `role`             | Enum: ["patient", "family_member"] |
| `value` (glucose)  | Range: 40–600 mg/dL                |
| `measuredAt`       | Not in future (10-min buffer)      |
| `carbs`            | Range: 0–500 grams                 |
| `duration_minutes` | Range: 0–1440 minutes              |
| `sleep_hours`      | Range: 0–24 hours                  |
| `timestamp`        | Not in future (10-min buffer)      |

---

## Performance Considerations

**Expected Load (100 active patients, 6 months):**

| Collection         | Documents | Size    |
| ------------------ | --------- | ------- |
| users              | ~200      | ~400 KB |
| glucose_readings   | ~500K     | ~250 MB |
| meals              | ~30K      | ~15 MB  |
| activities         | ~20K      | ~10 MB  |
| sleep_logs         | ~5K       | ~2 MB   |
| predictions        | ~72K      | ~36 MB  |
| alerts             | ~10K      | ~5 MB   |
| family_connections | ~300      | ~150 KB |

**Total:** ~318 MB (within Firestore free tier limits)

---

## Future Enhancements

- [ ] `GET /daily-logs/summary?days=7` — historical summary with date filtering
- [ ] `DELETE` endpoints for glucose readings and daily logs
- [ ] `timezone` field in user profile for accurate timestamp handling
- [ ] Refresh Token system for extended sessions
- [ ] `reports` collection for automated weekly/monthly summaries
- [ ] `doctor_connections` for healthcare provider access
- [ ] LibreView API integration for automatic glucose readings

---

**Version:** 2.0  
**Authors:** Deema Dweyyat + Wajdi Alfarawna  
**Supervisor:** Dr. Roger Cohen  
**Status:** Week 2 Complete — Week 3 In Progress
