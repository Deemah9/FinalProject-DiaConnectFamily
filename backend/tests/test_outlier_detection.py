"""
Unit tests for PredictionService._remove_outliers — pure function, no Firestore.
"""

from datetime import datetime, timedelta, timezone

from app.services.prediction_service import prediction_service

BASE_TS = datetime(2026, 7, 3, 18, 0, tzinfo=timezone.utc)


def _reading(value: int, minutes_offset: int, source: str = "csv_cgm") -> dict:
    return {
        "value": value,
        "measuredAt": BASE_TS + timedelta(minutes=minutes_offset),
        "source": source,
    }


class TestRapidButPlausibleTrend:
    def test_post_hypo_rebound_is_not_flagged_as_outlier(self):
        """
        Regression test for a real cascading false-positive: a legitimate
        rapid rise after a low (68 -> 94 -> 147 -> 183 -> 217, ~15 min apart)
        used to get patched at 94->147 (delta 53 > old CGM_MAX_CHANGE=50),
        then every subsequent real reading cascaded into "outlier" too,
        because each was compared only against the frozen patched value.
        """
        readings = [
            _reading(68, 0),
            _reading(94, 15),
            _reading(147, 30),
            _reading(183, 45),
            _reading(217, 73),  # slightly larger gap, matches the real report
        ]
        cleaned = prediction_service._remove_outliers(readings)
        assert [r["value"] for r in cleaned] == [68, 94, 147, 183, 217]


class TestGenuineOutlierStillCaught:
    def test_isolated_spike_between_two_stable_readings_is_patched(self):
        """A single implausible spike surrounded by stable readings should
        still be treated as a sensor glitch, not accepted."""
        readings = [
            _reading(100, 0),
            _reading(105, 15),
            _reading(500, 30),  # isolated glitch — no plausible physiological jump this fast
            _reading(102, 45),
        ]
        cleaned = prediction_service._remove_outliers(readings)
        values = [r["value"] for r in cleaned]
        assert values[2] != 500, "the isolated 500 spike should have been patched"
        assert values == [100, 105, 105, 102]


class TestCascadePrevention:
    def test_real_reading_after_a_patched_one_is_not_dragged_down(self):
        """
        Once a reading gets patched, the NEXT real reading should be judged
        against the previous RAW value too, not only the frozen cleaned
        value — otherwise one glitch drags down every reading after it.
        """
        readings = [
            _reading(100, 0),
            _reading(300, 15),   # implausible jump — gets patched back to 100
            _reading(320, 30),   # plausible relative to the RAW 300, even though far from patched 100
        ]
        cleaned = prediction_service._remove_outliers(readings)
        values = [r["value"] for r in cleaned]
        assert values[1] == 100, "the implausible 300 should still be patched"
        assert values[2] == 320, "320 is plausible next to the raw 300 and should NOT cascade-patch"
