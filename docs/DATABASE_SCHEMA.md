# DiaConnect Family - Database Schema

**Project:** Type 2 Diabetes Monitoring & Prediction Platform  
**Database:** Firebase Firestore  
**Region:** me-west1 (Tel Aviv)  
**Created:** December 19, 2024

---

## Collections Overview

```
Firestore
├── users
├── glucose_readings
├── daily_logs
├── predictions
├── alerts
└── family_connections
```

---

## 1. users

**Purpose:** Store all system users (patients and family members)

**Fields:**

- `userId`: string (Firebase Auth UID)
- `email`: string
- `fullName`: string
- `phone`: string | null
- `role`: string ("patient" | "family_member")
- `diabetesType`: string | null ("type2")
- `diagnosisDate`: timestamp | null
- `age`: number | null
- `gender`: string | null ("male" | "female")
- `comorbidities`: array of objects
  - `condition`: string
  - `diagnosisDate`: timestamp
  - `severity`: string
  - `isActive`: boolean
- `medicalHistory`: object
  - `allergies`: array of strings
  - `bloodType`: string | null
  - `height`: number | null (cm)
  - `weight`: number | null (kg)
  - `bmi`: number | null
- `lifestyleHabits`: object
  - `sleep`: object (typical bedtime, wakeup, duration, quality)
  - `diet`: object (dietary pattern, meals per day, preferred foods)
  - `exercise`: object (frequency, duration, activities)
  - `smoking`: object (is smoker, frequency)
  - `alcohol`: object (consumes, frequency)
- `targetGlucoseRange`: object
  - `min`: number (mg/dL)
  - `max`: number (mg/dL)
- `sensorInfo`: object | null
  - `brand`: string
  - `sensorId`: string | null
  - `lastSync`: timestamp | null
- `notificationPreferences`: object
  - `enableAlerts`: boolean
  - `alertThresholds`: object (high, low)
- `profilePicture`: string | null
- `createdAt`: timestamp
- `updatedAt`: timestamp
- `isActive`: boolean

**Indexes:**

- `email` (ascending)
- `role` (ascending)
- `createdAt` (descending)

---

## 2. glucose_readings

**Purpose:** Store all glucose readings

**Fields:**

- `readingId`: string
- `userId`: string (ref to users)
- `glucoseLevel`: number (mg/dL)
- `unit`: string ("mg/dL" | "mmol/L")
- `timestamp`: timestamp
- `source`: string ("manual" | "libreview" | "dexcom")
- `context`: object
  - `mealRelation`: string | null
  - `activity`: string | null
  - `medication`: boolean
- `notes`: string | null
- `createdAt`: timestamp

**Indexes:**

- `userId` + `timestamp` (composite, descending)
- `userId` + `source` (composite)

**Validation:**

- `glucoseLevel`: 40-400 mg/dL

---

## 3. daily_logs

**Purpose:** Complete daily log including meals, activities, sleep, medications

**Fields:**

- `logId`: string
- `userId`: string (ref to users)
- `date`: string (YYYY-MM-DD)
- `meals`: array of objects
  - `mealId`: string
  - `type`: string
  - `time`: timestamp
  - `items`: array (name, quantity, carbs, calories)
  - `totalCarbs`: number
  - `glucoseBefore`: number | null
  - `glucoseAfter`: number | null
- `activities`: array of objects
  - `activityId`: string
  - `type`: string
  - `duration`: number (minutes)
  - `intensity`: string
  - `time`: timestamp
- `sleep`: object
  - `bedtime`: timestamp | null
  - `wakeup`: timestamp | null
  - `duration`: number | null (hours)
  - `quality`: string | null
- `medications`: array of objects
  - `medicationId`: string
  - `name`: string
  - `dosage`: string
  - `time`: timestamp
  - `taken`: boolean
- `dailySummary`: object
  - `avgGlucose`: number
  - `minGlucose`: number
  - `maxGlucose`: number
  - `readingsCount`: number
  - `timeInRange`: number (percentage)
- `notes`: string | null
- `createdAt`: timestamp
- `updatedAt`: timestamp

**Indexes:**

- `userId` + `date` (composite, descending)

---

## 4. predictions

**Purpose:** ML model predictions for glucose levels

**Fields:**

- `predictionId`: string
- `userId`: string (ref to users)
- `predictedGlucose`: number (mg/dL)
- `predictionTime`: timestamp
- `confidenceScore`: number (0-1)
- `riskLevel`: string ("low" | "moderate" | "high")
- `riskFactors`: array of objects
  - `factor`: string
  - `impact`: number (0-1)
- `modelVersion`: string
- `actualGlucose`: number | null (filled later)
- `predictionError`: number | null
- `createdAt`: timestamp
- `evaluatedAt`: timestamp | null

**Indexes:**

- `userId` + `predictionTime` (composite, descending)
- `userId` + `riskLevel` (composite)

---

## 5. alerts

**Purpose:** Alerts and notifications

**Fields:**

- `alertId`: string
- `userId`: string (patient ID)
- `type`: string ("high_glucose" | "low_glucose" | "prediction_risk")
- `severity`: string ("info" | "warning" | "critical")
- `title`: string
- `message`: string
- `relatedData`: object
  - `glucoseLevel`: number | null
  - `predictionId`: string | null
  - `readingId`: string | null
- `recommendations`: array of objects
  - `action`: string
  - `priority`: string
- `isRead`: boolean
- `isAcknowledged`: boolean
- `sentToFamily`: boolean
- `notificationSent`: object
  - `patient`: boolean
  - `familyMembers`: array of strings
  - `sentAt`: timestamp | null
- `createdAt`: timestamp
- `resolvedAt`: timestamp | null

**Indexes:**

- `userId` + `createdAt` (composite, descending)
- `userId` + `isRead` (composite)

---

## 6. family_connections

**Purpose:** Connect patients with family members

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
- `invitedBy`: string (userId)
- `createdAt`: timestamp
- `acceptedAt`: timestamp | null
- `updatedAt`: timestamp

**Indexes:**

- `patientId` + `status` (composite)
- `familyMemberId` + `status` (composite)

---

## Access Control

**Patients:**

- Full access to their own data
- Manage family connections and permissions

**Family Members:**

- Access based on granted permissions
- Cannot modify patient data
- Receive alerts if permission granted

---

## Design Rationale & Technical Notes

### Users Collection Design

Medical and lifestyle fields are designed for patient users only. For family members, these fields remain `null` and are ignored by application logic. This approach:

- Maintains schema consistency across user types
- Simplifies authentication and user management flow
- Provides role flexibility (e.g., family member may become patient)
- Avoids need for separate collections per user type

**Future Consideration:** Some medical and lifestyle fields may be refactored into subcollections in future iterations to reduce document size and optimize update frequency for frequently-changed fields.

### Glucose Readings Scalability

Continuous Glucose Monitoring (CGM) devices generate high-frequency data (up to 288 readings per day per patient). To maintain optimal performance:

- Current design prioritizes query efficiency with composite indexes
- **Archival Strategy:** Readings older than 6 months may be archived or aggregated into monthly summaries to control storage growth
- Retention policy can be adjusted based on regulatory requirements and user preferences

### Daily Logs Denormalization

The `dailySummary` object contains calculated aggregates (avg, min, max glucose, etc.) that are intentionally denormalized for:

- Fast read performance for dashboard queries
- Reduced computation on client and backend
- Historical trend analysis without scanning all readings

This is a standard Firestore optimization pattern and not a design flaw.

### Permissions Granularity

The separation of `role` (user type) and `permissions` (relationship-based access) allows:

- Fine-grained access control per family connection
- Different permission levels for different family members
- Easy permission updates without role changes
- Scalability for future access types (e.g., healthcare providers)

---

## Data Retention & Privacy

- All personally identifiable information (PII) follows healthcare data protection standards
- Users can request data export (GDPR compliance consideration)
- Soft delete strategy: `isActive: false` instead of document deletion
- Audit logs for sensitive operations to be implemented in production

---

## Performance Considerations

**Expected Load (100 active patients, 6 months):**

- `users`: ~200 documents, ~400 KB
- `glucose_readings`: ~500K documents, ~250 MB
- `daily_logs`: ~18K documents, ~90 MB
- `predictions`: ~72K documents, ~36 MB
- `alerts`: ~10K documents, ~5 MB
- `family_connections`: ~300 documents, ~150 KB

**Total:** ~381 MB (well within Firestore free tier limits)

**Query Optimization:**

- All frequent queries have composite indexes
- Pagination implemented for large result sets
- Real-time listeners limited to recent data only

---

## Future Enhancements

- [ ] Add `reports` collection for automated monthly/weekly summaries
- [ ] Add `doctor_connections` for healthcare provider access
- [ ] Implement data export functionality (PDF/CSV)
- [ ] Add medication reminders as separate collection
- [ ] Consider subcollections for very active patients (>1 year of data)

---

## Validation Rules Summary

| Field             | Rule                               |
| ----------------- | ---------------------------------- |
| `email`           | Valid email format, unique         |
| `role`            | Enum: ["patient", "family_member"] |
| `glucoseLevel`    | Range: 40-400 mg/dL                |
| `age`             | Range: 1-120                       |
| `targetRange.min` | Range: 40-100 mg/dL                |
| `targetRange.max` | Range: 100-200 mg/dL               |
| `timestamp`       | Not in future                      |

---

## Notes

- All timestamps use Firebase Timestamp type
- Document IDs are auto-generated using Firestore `doc().id`
- Fields marked with `| null` are optional
- Arrays can be empty `[]`
- All collections are top-level (no subcollections currently)
- Schema designed for scalability up to 1000 active users

---

**Version:** 1.1  
**Last Updated:** December 19, 2024  
**Authors:** Deema Dweyyat + Wajdi Alfarawna  
**Status:** Ready for Implementation  
**Review Status:** Peer Reviewed - 9.5/10

## Future Enhancements

### System Diagnostics (Week 8+)

To enhance debugging capabilities:

- Add system health monitoring
- Track API call success rates
- Monitor sensor connectivity status
- Detailed error logging

### Data Quality Enhancement (Week 6+)

- Add quality indicators to glucose readings
- Implement anomaly detection
- Track data validation metrics

These enhancements are not critical for MVP but will
improve system reliability and maintainability.
