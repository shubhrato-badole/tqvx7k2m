import pandas as pd

def offset(cut):
    """Deadline relative to the start of the delivery day: the previous day at `cut` UK time."""
    return pd.Timedelta(days=-1, hours=int(cut[:2]), minutes=int(cut[3:]))

def latest_before_deadline(fc, cut):
    """Per target hour, the newest forecast published at or before the deadline."""
    ok = fc.publishTime <= fc.startTime.dt.floor("D") + offset(cut)
    return fc[ok].sort_values("publishTime").drop_duplicates("startTime", keep="last")
