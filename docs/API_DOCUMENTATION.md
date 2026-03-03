# DiaConnect Family — API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:8000`  
**Authentication:** Bearer Token (JWT)

---

## Authentication

All endpoints (except Register and Login) require a Bearer token in the header:

```
Authorization: Bearer <token>
```

---

## 1. Authentication APIs

### POST /auth/register

Register a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "123456",
  "first_name": "ديما",
  "last_name": "دويات",
  "role": "patient"
}
```

> `role` must be `"patient"` or `"family_member"`

**Response:** `201 Created`

```json
{
  "message": "User registered successfully",
  "uid": "abc123"
}
```

---

### POST /auth/login

Login and receive a JWT token.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "123456"
}
```

**Response:** `200 OK`

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "role": "patient"
}
```

---

## 2. User Profile APIs

### GET /users/me

Get current user profile.

**Response:** `200 OK`

```json
{
  "uid": "abc123",
  "email": "user@example.com",
  "firstName": "ديما",
  "lastName": "دويات",
  "role": "patient",
  "phone": "+972599111111",
  "isActive": true
}
```

---

### PUT /users/me

Update basic profile fields.

**Allowed fields:** `firstName`, `lastName`, `phone`, `dateOfBirth`, `gender`

**Request Body:**

```json
{
  "phone": "+972599111111",
  "gender": "female"
}
```

**Response:** `200 OK` — Updated user document

---

### PUT /users/me/medical

Update medical information. **Patients only.**

**Request Body:**

```json
{
  "diabetes_type": "type2",
  "diagnosis_year": 2020,
  "medications": ["Metformin"]
}
```

**Response:** `200 OK` — Updated user document  
**Error:** `403 Forbidden` — if user is not a patient

---

### PUT /users/me/lifestyle

Update lifestyle information. **All roles.**

**Request Body:**

```json
{
  "activity_level": "moderate",
  "sleep_hours": 7
}
```

**Response:** `200 OK` — Updated user document

---

## 3. Glucose Readings APIs

### POST /glucose/

Add a new glucose reading. **Patients only.**

**Request Body:**

```json
{
  "value": 145,
  "measuredAt": "2026-02-28T08:00:00+02:00"
}
```

> `value` must be between 40 and 600 mg/dL  
> `measuredAt` cannot be in the future  
> Always include timezone (e.g. `+02:00` for Israel)

**Response:** `201 Created`

```json
{
  "id": "xyz789",
  "value": 145,
  "measuredAt": "2026-02-28T06:00:00+00:00",
  "source": "manual",
  "createdAt": "2026-02-28T06:00:01+00:00"
}
```

---

### GET /glucose/

Get all glucose readings for current user (descending order).

**Response:** `200 OK` — List of glucose readings

---

### GET /glucose/latest

Get the most recent glucose reading.

**Response:** `200 OK` — Single glucose reading  
**Error:** `404 Not Found` — if no readings exist

---

### GET /glucose/stats

Get basic glucose statistics.

**Response:** `200 OK`

```json
{
  "count": 10,
  "average": 145.5,
  "min": 95,
  "max": 210
}
```

> Returns `null` for average/min/max if no readings exist

---

## 4. Daily Logs APIs

> **Note:** All timestamps must include timezone (e.g. `+02:00`)  
> Recording is optional — only log when activity differs from baseline lifestyle profile

### POST /daily-logs/meals

Log a meal event.

**Request Body:**

```json
{
  "carbs": 60,
  "foods": "Rice and chicken",
  "notes": "Large portion",
  "timestamp": "2026-02-28T12:00:00+02:00"
}
```

> `carbs` required (0–500g) — directly impacts glucose levels  
> `foods` and `notes` are optional

**Response:** `201 Created`

```json
{
  "id": "meal123",
  "carbs": 60,
  "foods": "Rice and chicken",
  "notes": "Large portion",
  "timestamp": "2026-02-28T10:00:00+00:00",
  "createdAt": "2026-02-28T10:00:01+00:00"
}
```

---

### POST /daily-logs/activities

Log an activity event.

**Request Body:**

```json
{
  "type": "walking",
  "duration_minutes": 30,
  "notes": "Morning walk",
  "timestamp": "2026-02-28T07:00:00+02:00"
}
```

> `duration_minutes` must be 0–1440

**Response:** `201 Created`

---

### POST /daily-logs/sleep

Log a sleep event. Only when sleep differs from baseline.

**Request Body:**

```json
{
  "sleep_hours": 5.5,
  "notes": "Bad night",
  "timestamp": "2026-02-28T06:00:00+02:00"
}
```

> `sleep_hours` must be 0–24

**Response:** `201 Created`

---

### GET /daily-logs/today

Get all events from the last 24 hours.

**Response:** `200 OK`

```json
{
  "meals": [...],
  "activities": [...],
  "sleep": [...]
}
```

> Uses timestamp-based filtering (last 24 hours) — not calendar day  
> This ensures late-night events appear in the correct context

---

## Error Codes

| Code | Meaning                                   |
| ---- | ----------------------------------------- |
| 400  | Bad Request — invalid or missing fields   |
| 401  | Unauthorized — invalid or expired token   |
| 403  | Forbidden — insufficient role permissions |
| 404  | Not Found — resource does not exist       |
| 422  | Unprocessable Entity — validation error   |
| 500  | Internal Server Error                     |

---

## Notes for Frontend

- Always send `timestamp` with explicit timezone: `"2026-03-01T08:00:00+02:00"`
- Never send naive timestamps (without timezone) — server assumes UTC
- Token expiry: 1440 minutes (24 hours) in development
- CORS allowed origins: `http://localhost:3000`, `http://localhost:8081`, `exp://localhost:8081`
