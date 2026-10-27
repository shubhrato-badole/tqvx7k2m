# Beaufort

Wind forecast briefing and scorecard for a day-ahead power buyer. Uses Elexon BMRS data only
(FUELHH actual wind, WINDFOR forecasts) for purchase decisions made in January 2026.

**How it decides:** for each delivery day, it takes the latest WINDFOR forecast published before the
chosen day-ahead deadline (09:20, 09:50 or 15:30 UK time) on the day before, then compares it with the actual.
The "likely range" is the 10th to 90th percentile of past misses at that hour of day.

## Files
- `backend/fetch_data.py` downloads and filters the Elexon data into `backend/data/`
- `backend/main.py` FastAPI: `/api/briefing`, `/api/accuracy`; serves the built UI
- `frontend/` React (Vite) UI; `Dockerfile` builds UI + API into one image; `heroku.yml` for Heroku

## Run locally
```bash
cd backend && pip install -r requirements.txt && python fetch_data.py   # once; commit backend/data
cd .. && docker build -t beaufort . && docker run -p 8000:8000 beaufort   # http://localhost:8000
```
Without Docker: `uvicorn main:app --port 8000` in `backend/`, then `npm install && npm run dev` in `frontend/`.

## Deploy (Heroku, container stack)
```bash
heroku create && heroku stack:set container && git push heroku main
```
Live app: _add link here_

## Assumptions
Winter time means UK time equals UTC. "Decisions in January" means delivery days 2 Jan to 1 Feb.
Demand is not in the dataset, so the buy estimate uses a user-entered flat figure.

## AI use
Built with assistance from Claude (Anthropic).
