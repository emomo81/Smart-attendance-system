# Rollcall — G1 Smart Attendance System

Counts faces in classroom photos, videos and webcam frames, draws a box and a numbered label (#1, #2, …) on each face, and appends `date, time, source, method, face_count` to a CSV. It counts faces only — it does **not** identify people.

Two detection methods, switchable in the UI:
- **Haar cascade** — OpenCV `haarcascade_frontalface_default.xml`, frame converted to grayscale, `detectMultiScale(scaleFactor=1.1, minNeighbors=3–9, default 5)`.
- **Roboflow** — public Universe model `face-detection-bj0ij/1` on `https://serverless.roboflow.com` via `inference-sdk` (confidence 40%). Centre boxes are converted to top-left (`left = x - w/2`, `top = y - h/2`). Every prediction is counted (the model's only class is `"Face Detection - v21 YOLOv5s"`).

## Layout
```
/                     Next.js 16 frontend (React 19, TypeScript)  → Vercel
  src/components/attendance-dashboard.tsx   UI: tabs, method picker, slider, results, CSV download
backend/              Flask API (Python 3.12, OpenCV)              → Render
  app.py              /detect, /logs, /health; Haar + Roboflow; CSV logging (csv module)
  tune_min_neighbors.py   compare counts for minNeighbors 3–9 on backend/test_images/
legacy-postgres/      the old Next.js API routes + Drizzle schema (not built; kept for reference)
```

Video and webcam are sampled at **one frame every 2 seconds** in the browser (video capped at 60 samples) to save Roboflow credits. Each sampled frame is a separate CSV row when "Log every scan" is on.

## API
| Route | What it does |
|---|---|
| `GET /health` | `{ok, roboflow_configured, model_id}` |
| `POST /detect` | multipart: `image`, `method` (haar/roboflow), `source` (photo/video/webcam), `min_neighbors` (3–9), `log` (true/false). Returns `face_count`, `boxes`, annotated `image` (base64 JPEG), `record` |
| `GET /logs` | downloads `attendance_log.csv`; `?format=json&limit=100` returns recent rows |

## Run locally
Backend (from `backend/`):
```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt          # macOS/Linux: .venv/bin/pip
.venv/Scripts/pip uninstall -y opencv-python
.venv/Scripts/pip install --no-deps --force-reinstall opencv-python-headless==4.12.0.88
cp .env.example .env    # then put your Roboflow key in backend/.env
.venv/Scripts/python app.py                              # http://localhost:5000
```
Frontend (repo root): `npm install`, create `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:5000`, then `npm run dev`.

## Tuning minNeighbors (poor light / angled faces)
Put test photos in `backend/test_images/` and run `python tune_min_neighbors.py`. It prints a count per minNeighbors value and writes boxed images to `test_images/out/`. On the sample classroom photo (10 people): mn=3 → 12, mn=5 → 11 (one false box on the doorway), mn=9 → 10.

## Deployment
See the Render and Vercel settings below. The Roboflow key lives only in Render's environment — never in the frontend or a `NEXT_PUBLIC_` variable.

**Render (Web Service, backend)**
- Root Directory: `backend`
- Runtime: Python 3 (`PYTHON_VERSION=3.12.10`; `inference-sdk` requires Python < 3.14)
- Build Command: `pip install -r requirements.txt && pip uninstall -y opencv-python && pip install --no-deps --force-reinstall opencv-python-headless==4.12.0.88`
- Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120`
- Health Check Path: `/health`
- Env vars: `ROBOFLOW_API_KEY`, `ROBOFLOW_MODEL_ID=face-detection-bj0ij/1`, `ROBOFLOW_API_URL=https://serverless.roboflow.com`, `ALLOWED_ORIGIN=https://<your-app>.vercel.app`, `PYTHON_VERSION=3.12.10`

**Vercel (frontend)**
- Root Directory: `./` (repo root), Framework: Next.js, Build: `npm run build`, Install: `npm install`
- Env var: `NEXT_PUBLIC_API_URL=https://<your-service>.onrender.com` (redeploy after changing it — it's baked in at build time)

**Note on the CSV:** Render's free tier has no persistent disk, so `attendance_log.csv` is wiped on every redeploy/restart. Download it before redeploying, or move logging to a database (e.g. free Postgres on Neon/Supabase/Render) and generate the CSV from it in `/logs`.
