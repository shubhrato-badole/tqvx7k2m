import pandas as pd
from logic import latest_before_deadline

T = pd.Timestamp("2026-01-10 12:00")
fc = pd.DataFrame({"publishTime": pd.to_datetime(["2026-01-08 18:00", "2026-01-09 07:30", "2026-01-09 10:00"]),
                   "startTime": [T] * 3, "generation": [1000, 2000, 3000]})

def test_uses_latest_forecast_before_0920():
    assert latest_before_deadline(fc, "09:20").generation.tolist() == [2000]

def test_later_deadline_sees_newer_forecast():
    assert latest_before_deadline(fc, "15:30").generation.tolist() == [3000]

def test_forecast_published_after_deadline_is_ignored():
    late = fc.assign(publishTime=pd.to_datetime(["2026-01-09 09:21"] * 3))
    assert latest_before_deadline(late, "09:20").empty
