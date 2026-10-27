"""Download wind actuals (FUELHH) and forecasts (WINDFOR) from Elexon into backend/data/.
Scope: purchase decisions made 1-31 Jan 2026, i.e. delivery 2 Jan - 1 Feb 2026."""
import os
from datetime import date, timedelta
import httpx, pandas as pd

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
OUT = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(OUT, exist_ok=True)

def get(name, **p):
    r = httpx.get(f"{BASE}/{name}/stream", params={**p, "format": "json"}, timeout=180)
    r.raise_for_status()
    return r.json()

def chunks(a, b, n=4):
    while a < b:
        yield a, min(a + timedelta(n), b)
        a += timedelta(n)

ts = lambda s: pd.to_datetime(s, utc=True).dt.tz_localize(None)  
act, fc = [], []
for a, b in chunks(date(2026, 1, 1), date(2026, 2, 2)):
    print("actuals", a, b)
    act += get("FUELHH", settlementDateFrom=str(a), settlementDateTo=str(b), fuelType="WIND")
for a, b in chunks(date(2025, 12, 30), date(2026, 2, 1)):
    print("forecasts", a, b)
    fc += get("WINDFOR", publishDateTimeFrom=f"{a}T00:00:00Z", publishDateTimeTo=f"{b}T00:00:00Z")

A = pd.DataFrame(act)
A = A[A.fuelType == "WIND"].copy()
A["startTime"] = ts(A.startTime)
A[["startTime", "generation"]].drop_duplicates("startTime").to_csv(f"{OUT}/actuals.csv.gz", index=False)

F = pd.DataFrame(fc)[["publishTime", "startTime", "generation"]].copy()
F["publishTime"], F["startTime"] = ts(F.publishTime), ts(F.startTime)
day = F.startTime.dt.floor("D")

F = F[(F.startTime >= "2026-01-02") & (F.startTime < "2026-02-02")
      & (F.publishTime >= day - pd.Timedelta(days=2)) & (F.publishTime <= day - pd.Timedelta(hours=8))]
F.drop_duplicates().to_csv(f"{OUT}/windfor.csv.gz", index=False)
print(len(A), "actual rows,", len(F), "forecast rows")
