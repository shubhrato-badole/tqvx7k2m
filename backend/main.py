import functools, os
import numpy as np, pandas as pd
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from logic import latest_before_deadline, offset

HERE = os.path.dirname(__file__)
assert os.path.exists(f"{HERE}/data/windfor.csv.gz"), "Run `python fetch_data.py` first"
act = (pd.read_csv(f"{HERE}/data/actuals.csv.gz", parse_dates=["startTime"]).drop_duplicates("startTime")
       .set_index("startTime").generation.resample("1h").mean().dropna().rename("actual"))
fc = pd.read_csv(f"{HERE}/data/windfor.csv.gz", parse_dates=["publishTime", "startTime"])
DEADLINES = {"09:20", "09:50", "15:30"}  
app = FastAPI(title="Beaufort")

@functools.lru_cache
def table(cut):
    f = latest_before_deadline(fc, cut).set_index("startTime").rename(columns={"generation": "forecast"})
    t = f.join(act).sort_index()
    t["err"] = t.actual - t.forecast  
    return t

@app.get("/api/briefing")
def briefing(day: str, cut: str = "09:20"):
    cut = cut if cut in DEADLINES else "09:20"
    t = table(cut)
    q = t.groupby(t.index.hour).err.quantile([.1, .9]).unstack()  
    start = pd.Timestamp(day) + pd.Timedelta(days=1)
    x = t[(t.index >= start) & (t.index < start + pd.Timedelta(days=1))]
    rows = [dict(t=i.isoformat(), f=r.forecast, lo=max(0, r.forecast + q.loc[i.hour, .1]),
                 hi=r.forecast + q.loc[i.hour, .9], a=None if pd.isna(r.actual) else r.actual)
            for i, r in x.iterrows()]

    v = fc[(fc.startTime >= start) & (fc.startTime < start + pd.Timedelta(days=1)) & (fc.publishTime <= start + offset(cut))]
    pubs = sorted(v.publishTime.unique())[:-1]
    vint = [dict(issued=pd.Timestamp(p).isoformat(),
                 v=[None if pd.isna(z) else float(z) for z in v[v.publishTime == p].set_index("startTime").generation.reindex(x.index)])
            for p in pubs[::max(1, len(pubs) // 5)]]
    step = float(x.index.to_series().diff().median() / pd.Timedelta(hours=1)) if len(x) > 1 else 1.0
    return dict(rows=rows, vint=vint, step=step, issued=x.publishTime.max().isoformat() if len(x) else None,
                mae=float(np.nan_to_num(t.err.abs().mean())))

@app.get("/api/accuracy")
def accuracy(cut: str = "09:20"):
    t = table(cut if cut in DEADLINES else "09:20").dropna(subset=["actual"])
    e = t.err.abs()
    by = lambda k: [dict(k=str(a), v=float(b)) for a, b in e.groupby(k).mean().items()]
    return dict(n=int(len(t)), mae=e.mean(), rmse=float((t.err ** 2).mean() ** .5), bias=t.err.mean(),
                mean_actual=t.actual.mean(), daily=by(t.index.date), hourly=by(t.index.hour))

if os.path.isdir(f"{HERE}/static"):
    app.mount("/", StaticFiles(directory=f"{HERE}/static", html=True))
