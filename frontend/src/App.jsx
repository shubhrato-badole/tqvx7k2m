
import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const DAYS = Array.from(
  { length: 31 },
  (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`
);

const DEADLINES = [
  ["09:20", "EPEX hourly"],
  ["09:50", "N2EX hourly"],
  ["15:30", "EPEX half-hourly"],
];

const fmt = (d, add, o) =>
  new Date(
    new Date(`${d}T12:00:00Z`).getTime() + add * 864e5
  ).toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });

const long = (d, add = 0) =>
  fmt(d, add, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const short = (d) =>
  fmt(d, 0, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const n0 = (v) => Math.round(v).toLocaleString("en-GB");

const shift = (d, k) =>
  new Date(Date.parse(d) + k * 864e5).toISOString().slice(0, 10);

const gwh = (a, h) =>
  (a.reduce((s, v) => s + v, 0) * h) / 1000;

function useApi(url) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let live = true;

    setBusy(true);
    setErr(false);

    fetch(`${API_BASE_URL}${url}`)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`API request failed: ${r.status}`);
        }
        return r.json();
      })
      .then((d) => {
        if (live) setData(d);
      })
      .catch(() => {
        if (live) setErr(true);
      })
      .finally(() => {
        if (live) setBusy(false);
      });

    return () => {
      live = false;
    };
  }, [url]);

  return [data, err, busy];
}

function Chart({ rows, vint, reveal }) {
  const [h, setH] = useState(null);

  const W = 880;
  const H = 330;
  const L = 44;
  const R = 12;
  const T = 12;
  const B = 28;
  const n = rows.length;

  const pts = rows.map((r, i) => ({ ...r, i }));

  const top = Math.max(
    ...rows.map((r) => Math.max(r.hi, reveal ? (r.a ?? 0) : 0))
  );

  const max = Math.max(2000, Math.ceil(top / 2000) * 2000);

  const x = (i) => L + (i * (W - L - R)) / (n - 1);
  const y = (v) => T + (1 - v / max) * (H - T - B);

  const path = (p, k) =>
    p.map((r, j) => `${j ? "L" : "M"}${x(r.i)},${y(r[k])}`).join("");

  const band =
    path(pts, "hi") +
    [...pts].reverse().map((r) => `L${x(r.i)},${y(r.lo)}`).join("") +
    "Z";

  const actual = pts.filter((r) => r.a != null);

  const move = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();

    const i = Math.round(
      (((e.clientX - rect.left) / rect.width) * W - L) /
        ((W - L - R) / (n - 1))
    );

    setH(Math.min(n - 1, Math.max(0, i)));
  };

  const p = h != null ? pts[h] : null;
  const showA = p && reveal && p.a != null;
  const tipW = 176;
  const tx = p
    ? x(h) > W - tipW - 24
      ? x(h) - tipW - 12
      : x(h) + 12
    : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Hourly wind generation: forecast, likely range and actual"
      onPointerMove={move}
      onPointerLeave={() => setH(null)}
    >
      {[0, 1, 2, 3, 4].map((k) => (
        <g key={k}>
          <line
            className="grid"
            x1={L}
            x2={W - R}
            y1={y((max / 4) * k)}
            y2={y((max / 4) * k)}
          />
          <text
            x={L - 8}
            y={y((max / 4) * k) + 4}
            textAnchor="end"
          >
            {(max / 4000) * k}
          </text>
        </g>
      ))}

      {pts
        .filter((r) => r.i % Math.ceil(n / 6) === 0)
        .map((r) => (
          <text
            key={r.i}
            x={x(r.i)}
            y={H - 8}
            textAnchor="middle"
          >
            {r.t.slice(11, 16)}
          </text>
        ))}

      <path className="band" d={band} />

      {vint.map((v, k) => (
        <path
          key={k}
          className="old"
          d={path(
            v.v
              .map((f, i) => ({ i, f }))
              .filter((r) => r.f != null),
            "f"
          )}
        />
      ))}

      <path className="fc" d={path(pts, "f")} />

      {reveal && actual.length > 1 && (
        <path
          className="act"
          pathLength="1"
          d={path(actual, "a")}
        />
      )}

      {p && (
        <g pointerEvents="none">
          <line
            className="cross"
            x1={x(h)}
            x2={x(h)}
            y1={T}
            y2={H - B}
          />

          <circle className="dot" cx={x(h)} cy={y(p.f)} r="4" />

          {showA && (
            <circle className="dotA" cx={x(h)} cy={y(p.a)} r="4" />
          )}

          <g className="tipg" transform={`translate(${tx},${T + 8})`}>
            <rect
              className="tip"
              width={tipW}
              height={showA ? 86 : 69}
              rx="6"
            />

            <text x="12" y="20">{p.t.slice(11, 16)}</text>
            <text x="12" y="39">Forecast {n0(p.f)} MW</text>
            <text x="12" y="57">
              Range {(p.lo / 1000).toFixed(1)} to{" "}
              {(p.hi / 1000).toFixed(1)} GW
            </text>

            {showA && (
              <text x="12" y="75">Actual {n0(p.a)} MW</text>
            )}
          </g>
        </g>
      )}
    </svg>
  );
}

function DayStrip({ day, setDay, dmap }) {
  const vals = Object.values(dmap);
  const lo = vals.length ? Math.min(...vals) : 0;
  const hi = vals.length ? Math.max(...vals) : 0;

  return (
    <div className="strip-wrap">
      <span className="sm">
        Decision day: {short(day)}. Darker days had bigger forecast misses.
      </span>

      <div className="strip" role="group" aria-label="Decision day">
        {DAYS.map((d, i) => {
          const v = dmap[shift(d, 1)];

          return (
            <button
              key={d}
              className={d === day ? "tile on" : "tile"}
              onClick={() => setDay(d)}
              title={`${short(d)}${
                v != null ? `: forecast missed by ${n0(v)} MW` : ""
              }`}
              style={
                v != null && hi > lo
                  ? { "--k": (v - lo) / (hi - lo) }
                  : undefined
              }
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Bars({ data, label, onPick }) {
  const [h, setH] = useState(null);

  if (!data?.length) return <p className="hint">No chart data available.</p>;

  const m = Math.max(...data.map((d) => d.v), 1);
  const d = h != null ? data[h] : null;
  const pos = h != null ? (h + 0.5) / data.length : 0;
  const Tag = onPick ? "button" : "div";

  return (
    <div className="bwrap">
      <div className="bars" onMouseLeave={() => setH(null)}>
        {data.map((x, i) => (
          <Tag
            key={x.k}
            className={i === h ? "bar hot" : "bar"}
            style={{ height: `${(x.v / m) * 100}%` }}
            onMouseEnter={() => setH(i)}
            onFocus={() => setH(i)}
            onBlur={() => setH(null)}
            onClick={onPick ? () => onPick(x.k) : undefined}
            aria-label={`${label(x.k)}: average miss ${n0(x.v)} MW`}
          />
        ))}
      </div>

      <div className="axis">
        <span>{label(data[0].k)}</span>
        <span>{label(data[data.length - 1].k)}</span>
      </div>

      {d && (
        <div
          className="btip"
          style={{
            left: `${pos * 100}%`,
            transform: `translate(${
              pos < 0.2 ? "-10%" : pos > 0.8 ? "-90%" : "-50%"
            }, -100%)`,
          }}
        >
          <b>{label(d.k)}</b>
          <span>Average miss {n0(d.v)} MW</span>
          <span>
            Forecast too {d.bias < 0 ? "high" : "low"} by{" "}
            {n0(Math.abs(d.bias ?? 0))} MW on average
          </span>
          {onPick && (
            <span className="go">Select to open this day's briefing</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("brief");
  const [day, setDay] = useState("2026-01-09");
  const [cut, setCut] = useState("09:20");
  const [reveal, setReveal] = useState(false);
  const [demand, setDemand] = useState(30000);

  // These API hooks must stay inside App, after day and cut are declared.
  const [b, bErr, bBusy] = useApi(
    `/api/briefing?day=${day}&cut=${cut}`
  );
  const [s, sErr, sBusy] = useApi(`/api/accuracy?cut=${cut}`);

  const rows = b?.rows ?? [];
  const E = (a) => gwh(a, b?.step ?? 1);

  const peak = rows.reduce(
    (m, r) => (r.f > m.f ? r : m),
    rows[0] ?? {}
  );

  const low = rows.reduce(
    (m, r) => (r.f < m.f ? r : m),
    rows[0] ?? {}
  );

  const gap = (k) => E(rows.map((r) => Math.max(0, demand - r[k])));
  const withA = rows.filter((r) => r.a != null);

  const forecastEnergy = E(withA.map((r) => r.f));
  const diff = withA.length && forecastEnergy
    ? ((E(withA.map((r) => r.a)) - forecastEnergy) / forecastEnergy) * 100
    : 0;

  const dmap = Object.fromEntries((s?.daily ?? []).map((d) => [d.k, d.v]));
  const brief = view === "brief";

  const status = (d, e) => {
    if (e) {
      return (
        <p className="lede">
          Could not load data. Check the backend connection and API configuration.
        </p>
      );
    }

    if (!d) return <p className="lede">Loading…</p>;
    return null;
  };

  const openDay = (k) => {
    setDay(shift(k, -1));
    setView("brief");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      className={`wrap${
        (brief ? bBusy : view === "score" && sBusy) ? " busy" : ""
      }`}
    >
      <header>
        <span className="brand">beaufort</span>

        <nav>
          {[
            ["brief", "Briefing"],
            ["score", "Scorecard"],
            ["method", "Method"],
          ].map(([k, t]) => (
            <button
              key={k}
              aria-current={view === k}
              onClick={() => setView(k)}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {view !== "method" && (
        <div className="controls">
          {brief && <DayStrip day={day} setDay={setDay} dmap={dmap} />}

          <div className="field">
            <span className="sm" id="dl">
              Buying deadline, UK time
            </span>

            <div className="seg" role="group" aria-labelledby="dl">
              {DEADLINES.map(([t, n]) => (
                <button
                  key={t}
                  aria-pressed={cut === t}
                  title={`${n} auction`}
                  onClick={() => setCut(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {brief && (
            <button className="ghost" onClick={() => setReveal(!reveal)}>
              {reveal ? "Hide actual output" : "Show what actually happened"}
            </button>
          )}
        </div>
      )}

      {brief && status(b, bErr)}

      {brief && rows.length > 1 && (
        <>
          <h1>
            Wind should supply about {n0(E(rows.map((r) => r.f)))} GWh on{" "}
            {long(day, 1)}.
          </h1>

          <p className="lede">
            Based on the forecast issued at {b.issued?.slice(11, 16) ?? "—"} on{" "}
            {b.issued ? long(b.issued.slice(0, 10)) : long(day)}, the last one
            before the {cut} auction closes. At this deadline, forecasts missed
            by {n0(b.mae)} MW on average in January.
          </p>

          {reveal && withA.length > 0 && (
            <p className="reveal">
              Actual output was {n0(E(withA.map((r) => r.a)))} GWh,{" "}
              {Math.abs(diff).toFixed(1)}% {diff >= 0 ? "above" : "below"} the
              forecast.
            </p>
          )}

          <div className="panel">
            <Chart rows={rows} vint={b.vint ?? []} reveal={reveal} />

            <div className="key">
              <span>
                <i style={{ background: "#EAF2F0" }} />
                Forecast used, GW
              </span>

              {(b.vint ?? []).length > 0 && (
                <span>
                  <i style={{ background: "#EAF2F0", opacity: 0.3 }} />
                  Earlier forecasts
                </span>
              )}

              <span>
                <i style={{ background: "var(--sea)", opacity: 0.5 }} />
                Likely range (80% of past misses)
              </span>

              {reveal && (
                <span>
                  <i style={{ background: "var(--sun)" }} />
                  Actual
                </span>
              )}
            </div>
          </div>

          <div className="stats">
            <div>
              <span className="big">{n0(peak.f)} MW</span>
              <span className="sm">Peak, at {peak.t?.slice(11, 16)}</span>
            </div>

            <div>
              <span className="big">{n0(low.f)} MW</span>
              <span className="sm">Lowest, at {low.t?.slice(11, 16)}</span>
            </div>

            <div>
              <span className="big">
                {n0(E(rows.map((r) => r.lo)))} to{" "}
                {n0(E(rows.map((r) => r.hi)))} GWh
              </span>
              <span className="sm">Likely range for the day</span>
            </div>
          </div>

          <div className="buy">
            <h2>What to buy from other sources</h2>

            <label>
              Your expected demand, MW
              <input
                type="number"
                min="0"
                step="500"
                value={demand}
                onChange={(e) => setDemand(Number(e.target.value))}
              />
            </label>

            <p>
              At a flat {n0(demand)} MW, you would buy about {n0(gap("f"))} GWh
              beyond wind. Allowing for forecast error, plan for{" "}
              {n0(gap("hi"))} to {n0(gap("lo"))} GWh. Demand is not part of
              this dataset, so this uses your figure.
            </p>
          </div>
        </>
      )}

      {view === "score" && status(s, sErr)}

      {view === "score" && s && (
        <>
          <h1>
            In January, the wind forecast missed by {n0(s.mae)} MW on average.
          </h1>

          <p className="lede">
            Across {n0(s.n)} hours, using the last forecast before the {cut}{" "}
            deadline. Actual output was{" "}
            {s.bias >= 0 ? "higher" : "lower"} than forecast by{" "}
            {n0(Math.abs(s.bias))} MW on average.
          </p>

          <div className="stats">
            <div>
              <span className="big">{n0(s.mae)} MW</span>
              <span className="sm">Mean absolute error</span>
            </div>

            <div>
              <span className="big">{n0(s.rmse)} MW</span>
              <span className="sm">
                Root mean square error, which weights big misses more
              </span>
            </div>

            <div>
              <span className="big">{n0(s.bias)} MW</span>
              <span className="sm">Bias, actual minus forecast</span>
            </div>

            <div>
              <span className="big">
                {s.mean_actual
                  ? ((s.mae / s.mean_actual) * 100).toFixed(1)
                  : "—"}
                %
              </span>
              <span className="sm">Error as a share of average output</span>
            </div>
          </div>

          <div className="cols">
            <div className="panel">
              <h2>Average miss by delivery day</h2>
              <p className="hint">Select a bar to open that day's briefing.</p>
              <Bars
                data={s.daily ?? []}
                label={(k) => short(k)}
                onPick={openDay}
              />
            </div>

            <div className="panel">
              <h2>Average miss by hour of day</h2>
              <p className="hint">Hours are UK time.</p>
              <Bars
                data={s.hourly ?? []}
                label={(k) => `${k}:00`}
              />
            </div>
          </div>
        </>
      )}

      {view === "method" && (
        <>
          <h1>How the numbers are made.</h1>

          <div className="method">
            <h2>The decision</h2>
            <p>
              Power for a delivery day is bought the day before. Each auction
              closes at a fixed time (09:20, 09:50 or 15:30 UK time), so only
              forecasts published before that moment could have informed the
              purchase.
            </p>

            <h2>The forecast we use</h2>
            <p>
              For every hour of the delivery day we take the newest WINDFOR
              forecast published before the deadline. Later forecasts are
              ignored, even if they are better, because the buyer could not
              have seen them. The faint lines on the chart are the earlier
              ones.
            </p>

            <h2>The comparison</h2>
            <p>
              We compare it with actual wind output from FUELHH, averaged to
              the same hour. A miss is actual minus forecast, so a negative
              number means the forecast was too high.
            </p>

            <h2>The likely range</h2>
            <p>
              For each hour of the day we take the 10th and 90th percentile of
              past misses and add them to the forecast. About 80% of January
              outcomes fell inside this band.
            </p>

            <h2>Limits</h2>
            <p>
              Only decisions made in January 2026 are covered. The range is
              built from the same month it is judged on, so it describes what
              happened and is not a promise. Demand is not in the dataset.
            </p>
          </div>
        </>
      )}

      <p className="note">
        Source: Elexon BMRS, datasets FUELHH (actual wind) and WINDFOR
        (forecast). All times UK. Decisions made 1 to 31 January 2026.
      </p>
    </div>
  );
}
