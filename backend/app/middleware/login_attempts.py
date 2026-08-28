import time
from fastapi import HTTPException, status

# Failed-login tracker with progressive backoff, keyed by "ip:<addr>"
# (broad — catches one source spraying many emails) and
# "ip_email:<addr>:<email>" (focused — catches brute-force against one
# account from one source).
#
# Deliberately NOT keyed by email alone: that would let an attacker lock a
# victim out of their own account just by sending failed attempts against
# the victim's email from any IP (account-lockout DoS), without ever
# needing the correct password. Scoping the per-account limit to
# (ip, email) means only requests from the *same* source count toward it —
# the real user, coming from their own IP, is unaffected.
#
# Progressive backoff instead of a hard wall: the first FREE_ATTEMPTS
# failures are unrestricted, then each further failure doubles the
# required wait before the next attempt (capped at MAX_DELAY_SECONDS).
# This never fully locks an account out — a legitimate user can always
# get back in, just increasingly slowly — while automated guessing is
# throttled to a crawl.
#
# In-memory only — resets on restart and does not share state across
# multiple backend instances. Fine for a single-instance deployment;
# scaling to multiple backend instances needs Redis or another shared
# store instead, so the counters stay consistent across processes.
FREE_ATTEMPTS_PER_IP = 10
FREE_ATTEMPTS_PER_IP_EMAIL = 5
BASE_DELAY_SECONDS = 2
MAX_DELAY_SECONDS = 15 * 60       # 15 minutes
RESET_AFTER_SECONDS = 15 * 60     # forget history after this much inactivity

_state: dict[str, dict] = {}


def _delay_for(count: int, free_attempts: int) -> float:
    if count < free_attempts:
        return 0
    exponent = count - free_attempts
    return min(MAX_DELAY_SECONDS, BASE_DELAY_SECONDS * (2 ** exponent))


def check_login_allowed(*keyed_limits: tuple[str, int]) -> None:
    """Raise 429 (with Retry-After) if any key is still in its backoff window."""
    now = time.time()
    for key, free_attempts in keyed_limits:
        entry = _state.get(key)
        if not entry:
            continue
        if now - entry["last_failure"] > RESET_AFTER_SECONDS:
            del _state[key]
            continue
        delay = _delay_for(entry["count"], free_attempts)
        ready_at = entry["last_failure"] + delay
        if now < ready_at:
            retry_after = int(ready_at - now) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )


def record_failed_attempt(*keys: str) -> None:
    now = time.time()
    for key in keys:
        entry = _state.get(key)
        if entry and now - entry["last_failure"] <= RESET_AFTER_SECONDS:
            entry["count"] += 1
            entry["last_failure"] = now
        else:
            _state[key] = {"count": 1, "last_failure": now}


def record_successful_login(*keys: str) -> None:
    for key in keys:
        _state.pop(key, None)
