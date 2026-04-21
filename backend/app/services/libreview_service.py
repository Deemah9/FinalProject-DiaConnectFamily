"""
LibreView Unofficial API Client
================================
Academic use only.
This service uses the undocumented LibreView / LibreLinkUp REST API,
which has been reverse-engineered by the open-source diabetes community.
Abbott has not published these endpoints officially and may change them
at any time without notice.

API base URL  : https://api.libreview.io
Regional URLs : https://api-eu.libreview.io   (Europe)
                https://api-us.libreview.io   (United States)
                https://api-ap.libreview.io   (Asia-Pacific)
                https://api-eu2.libreview.io  (EU-2)
                https://api-ca.libreview.io   (Canada)
                https://api-ae.libreview.io   (UAE)
                https://api-jp.libreview.io   (Japan)
"""

import httpx
from datetime import datetime, timezone
from typing import Optional


# ==========================================
# Constants
# ==========================================

# Default entry point — LibreView may redirect to a regional server.
BASE_URL = "https://api.libreview.io"

# Map of region codes returned by the redirect response.
REGION_URLS: dict[str, str] = {
    "eu":  "https://api-eu.libreview.io",
    "eu2": "https://api-eu2.libreview.io",
    "us":  "https://api-us.libreview.io",
    "ap":  "https://api-ap.libreview.io",
    "ca":  "https://api-ca.libreview.io",
    "ae":  "https://api-ae.libreview.io",
    "jp":  "https://api-jp.libreview.io",
}

# mmol/L → mg/dL conversion factor (standard medical formula).
MMOL_TO_MGDL = 18.0182

# Headers required by the LibreView app — the API rejects requests
# that do not include product + version headers.
# These values mirror the LibreLinkUp iOS app as documented by the
# open-source community.
LLU_HEADERS = {
    "product":          "llu.ios",
    "version":          "4.7.0",
    "Accept-Encoding":  "gzip, deflate, br",
    "Content-Type":     "application/json",
    "Connection":       "keep-alive",
    "User-Agent":       (
        "LibreLinkUp/4.7.0 CFNetwork/1410.0.3 Darwin/22.6.0"
    ),
}


# ==========================================
# Login
# ==========================================

def login(email: str, password: str) -> tuple[str, str]:
    """
    Authenticate with the LibreView API.

    Handles the regional redirect automatically:
    some accounts are hosted on regional servers (EU, US, etc.).
    The API returns status=2 when a redirect is needed, and includes
    the region code in the response. We retry on the correct server.

    Returns
    -------
    (token, base_url)
        token    : Bearer token for subsequent requests.
        base_url : the actual server URL used (may differ from BASE_URL).

    Raises
    ------
    ValueError  : wrong credentials, account locked, or unknown API error.
    httpx.HTTPError : network-level failure.

    ── What the login response looks like ──────────────────────────
    SUCCESS (status 0):
    {
      "status": 0,
      "data": {
        "user": { "id": "...", "email": "...", "firstName": "...", ... },
        "authTicket": {
          "token":    "eyJhbGc...",   ← use this as Bearer token
          "expires":  1712345678,     ← Unix timestamp
          "duration": 15552000        ← seconds (~180 days)
        }
      }
    }

    REGIONAL REDIRECT (status 2):
    {
      "status": 2,
      "data": {
        "redirect": true,
        "region": "eu"               ← maps to api-eu.libreview.io
      }
    }

    WRONG CREDENTIALS (status 4):
    {
      "status": 4,
      "error": { "message": "Email or password incorrect" }
    }
    ─────────────────────────────────────────────────────────────────
    """
    active_url = BASE_URL
    payload = {"email": email, "password": password}

    with httpx.Client(timeout=15) as client:

        # Follow up to 3 regional redirects before giving up
        for attempt in range(3):
            resp = client.post(
                f"{active_url}/llu/auth/login",
                json=payload,
                headers=LLU_HEADERS,
            )
            resp.raise_for_status()
            body = resp.json()
            data = body.get("data", {})
            status_code = body.get("status", -1)

            # Redirect requested — status=2 OR status=0 with redirect flag
            needs_redirect = (
                status_code == 2
                or data.get("redirect") is True
            )

            if needs_redirect:
                region = data.get("region", "")
                regional_url = REGION_URLS.get(region)
                if not regional_url:
                    raise ValueError(
                        "LibreView requested redirect to unknown"
                        f" region: '{region}'"
                    )
                active_url = regional_url
                continue  # retry on the regional server

            # ── Error check ───────────────────────────────────────
            if status_code != 0:
                error_msg = (
                    body.get("error", {}).get("message")
                    or f"LibreView login failed with status {status_code}"
                )
                raise ValueError(error_msg)

            # ── Terms of Service step ─────────────────────────────
            step = data.get("step", {})
            if step:
                step_type = step.get("type", "unknown")
                raise ValueError(
                    f"LibreView requires action (step: '{step_type}'). "
                    "Open the LibreView app, accept any pending "
                    "Terms & Conditions, then try again."
                )

            # ── Extract token ─────────────────────────────────────
            token = data.get("authTicket", {}).get("token")
            if not token:
                token = data.get("user", {}).get("token")

            if not token:
                raise ValueError(
                    "LibreView login succeeded but no token was returned. "
                    f"Response data keys: {list(data.keys())}"
                )

            # Also extract the user's own ID (used as fallback patientId)
            user_id = data.get("user", {}).get("id")

            return token, active_url, user_id

        raise ValueError(
            "LibreView redirect loop exceeded — "
            "could not resolve regional server."
        )
        return None, active_url, None  # unreachable, satisfies type checker


# ==========================================
# Fetch Connections
# ==========================================

def fetch_connections(
    token: str, base_url: str, self_id: str = None
) -> list[str]:
    """
    Retrieve the list of patient IDs linked to this LibreView account.

    In LibreLinkUp, a family member sees the patient's patientId here.
    If this is a standalone patient account with no linked viewers,
    the list may be empty — we handle that case in fetch_readings.

    Returns
    -------
    list of patientId strings.

    ── What the connections response looks like ────────────────────
    {
      "status": 0,
      "data": [
        {
          "id":        "...",
          "patientId": "abc-123-uuid",   ← use this to fetch graph
          "firstName": "John",
          "lastName":  "Doe",
          "country":   "US",
          "status":    2,
          "uom":       1,              ← 0=mg/dL, 1=mmol/L
          "glucoseMeasurement": { ... } ← latest reading snapshot
        }
      ]
    }
    ─────────────────────────────────────────────────────────────────
    """
    headers = {**LLU_HEADERS, "Authorization": f"Bearer {token}"}

    with httpx.Client(timeout=15) as client:
        resp = client.get(
            f"{base_url}/llu/connections",
            headers=headers,
        )

        # 403 = standalone patient account with no LLU followers.
        # Fall back to fetching the patient's own readings using their user ID.
        if resp.status_code == 403:
            return [self_id] if self_id else []

        resp.raise_for_status()
        body = resp.json()

    if body.get("status") != 0:
        raise ValueError(
            f"Failed to fetch LibreView connections. "
            f"Status: {body.get('status')}"
        )

    connections = body.get("data") or []
    return [c["patientId"] for c in connections if c.get("patientId")]


# ==========================================
# Fetch Glucose Readings for One Patient
# ==========================================

def fetch_graph(
    token: str,
    base_url: str,
    patient_id: str,
) -> list[dict]:
    """
    Fetch historical glucose readings for one connected patient.

    Returns a list of normalised dicts ready to be saved:
        { "value": int (mg/dL), "measuredAt": datetime (UTC) }

    ── What the graph response looks like ──────────────────────────
    {
      "status": 0,
      "data": {
        "connection": { "patientId": "...", ... },
        "activeSensors": [ ... ],
        "graphData": [
          {
            "FactoryTimestamp": "1/15/2024 8:30:00 AM",   ← UTC
            "Timestamp":        "1/15/2024 10:30:00 AM",  ← local time
            "type":             0,
            "ValueInMgPerDl":   120,   ← always present in mg/dL
            "MeasurementColor": 1,
            "GlucoseUnits":     0,     ← 0=mg/dL, 1=mmol/L
            "Value":            120,   ← in the account's display unit
            "isHigh":           false,
            "isLow":            false
          },
          ...
        ]
      }
    }

    Unit note:
    - We always use ValueInMgPerDl when present (it is always mg/dL).
    - If absent, we read Value and convert from mmol/L if GlucoseUnits=1.
    - All values are rounded to int to match our GlucoseDocument schema.

    Timestamp note:
    - FactoryTimestamp is UTC. Timestamp is local/account timezone.
    - We parse FactoryTimestamp and attach UTC timezone explicitly.
    ─────────────────────────────────────────────────────────────────
    """
    headers = {**LLU_HEADERS, "Authorization": f"Bearer {token}"}

    with httpx.Client(timeout=15) as client:
        resp = client.get(
            f"{base_url}/llu/connections/{patient_id}/graph",
            headers=headers,
        )

        # 403 = this account is not a follower of this patient.
        # The LLU graph API only works for follower accounts.
        if resp.status_code == 403:
            return []

        resp.raise_for_status()
        body = resp.json()

    if body.get("status") != 0:
        raise ValueError(
            f"Failed to fetch graph for patientId={patient_id}. "
            f"Status: {body.get('status')}"
        )

    raw_readings = body.get("data", {}).get("graphData") or []
    normalised = []

    for entry in raw_readings:
        value_mgdl = _extract_mgdl(entry)
        measured_at = _parse_timestamp(entry.get("FactoryTimestamp"))

        if value_mgdl is None or measured_at is None:
            continue

        normalised.append({
            "value":      value_mgdl,
            "measuredAt": measured_at,
        })

    return normalised


# ==========================================
# Fetch Patient's Own Logbook
# ==========================================

def fetch_logbook(token: str, base_url: str) -> list[dict]:
    """
    Fetch the logged-in patient's own glucose readings from their logbook.
    Used when the account has no LLU follower connections.

    Endpoint: GET /llu/logbook
    Returns the same normalised list as fetch_graph.
    """
    headers = {**LLU_HEADERS, "Authorization": f"Bearer {token}"}

    with httpx.Client(timeout=15) as client:
        resp = client.get(
            f"{base_url}/llu/logbook",
            headers=headers,
        )

        if resp.status_code in (403, 404):
            return []

        resp.raise_for_status()
        body = resp.json()

    if body.get("status") != 0:
        return []

    raw_readings = body.get("data") or []
    normalised = []

    for entry in raw_readings:
        value_mgdl = _extract_mgdl(entry)
        measured_at = _parse_timestamp(entry.get("FactoryTimestamp"))

        if value_mgdl is None or measured_at is None:
            continue

        normalised.append({
            "value":      value_mgdl,
            "measuredAt": measured_at,
        })

    return normalised


# ==========================================
# Full Sync Flow
# ==========================================

def sync(email: str, password: str) -> list[dict]:
    """
    Full sync: login → try follower connections → fallback to own logbook.

    Flow:
      1. Login and get token + user_id.
      2. Fetch LLU connections (follower accounts).
      3. If connections found → fetch graph for each patient.
      4. If no connections (standalone patient) → fetch own logbook.
    """
    token, base_url, _ = login(email, password)
    patient_ids = fetch_connections(token, base_url, self_id=None)

    all_readings: list[dict] = []

    if patient_ids:
        for pid in patient_ids:
            readings = fetch_graph(token, base_url, pid)
            all_readings.extend(readings)
    else:
        # Standalone patient account — fetch their own logbook
        all_readings = fetch_logbook(token, base_url)

    return all_readings


# ==========================================
# Private Helpers
# ==========================================

def _extract_mgdl(entry: dict) -> Optional[int]:
    """
    Extract glucose value as mg/dL integer from a graph entry.

    Prefers ValueInMgPerDl (always mg/dL when present).
    Falls back to Value + GlucoseUnits conversion.
    """
    mgdl = entry.get("ValueInMgPerDl")
    if mgdl is not None:
        return int(round(float(mgdl)))

    raw_value = entry.get("Value")
    if raw_value is None:
        return None

    units = entry.get("GlucoseUnits", 0)
    if units == 1:
        # mmol/L → mg/dL
        return int(round(float(raw_value) * MMOL_TO_MGDL))

    return int(round(float(raw_value)))


def _parse_timestamp(raw: Optional[str]) -> Optional[datetime]:
    """
    Parse a LibreView timestamp string to a UTC-aware datetime.

    LibreView uses US format: "M/D/YYYY H:MM:SS AM/PM"
    FactoryTimestamp is in UTC — we attach tzinfo explicitly.

    Returns None if the string is missing or cannot be parsed.
    """
    if not raw:
        return None
    try:
        dt = datetime.strptime(raw, "%m/%d/%Y %I:%M:%S %p")
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        # Some accounts may use a 24h format — try that as fallback.
        try:
            dt = datetime.strptime(raw, "%m/%d/%Y %H:%M:%S")
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
