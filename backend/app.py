"""G1 Smart Attendance System - detection API.

Counts faces in a photo or a sampled video/webcam frame with either an OpenCV
Haar cascade or a hosted Roboflow model, draws numbered boxes, and appends a
row to a CSV log. It counts faces only; it never identifies anyone.
"""

import base64
import csv
import os
import threading
from datetime import datetime, timezone

import cv2
import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

load_dotenv()

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "")
ROBOFLOW_MODEL_ID = os.getenv("ROBOFLOW_MODEL_ID", "face-detection-bj0ij/1")
ROBOFLOW_API_URL = os.getenv("ROBOFLOW_API_URL", "https://serverless.roboflow.com")
ROBOFLOW_CONFIDENCE = float(os.getenv("ROBOFLOW_CONFIDENCE", "0.4"))
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")
LOG_PATH = os.getenv("LOG_PATH", os.path.join(os.path.dirname(__file__), "logs", "attendance_log.csv"))

SCALE_FACTOR = 1.1
DEFAULT_MIN_NEIGHBORS = 5
MAX_SIDE = 1280  # downscale big photos so Haar stays fast on a small Render instance
CSV_HEADER = ["date", "time", "source", "method", "face_count"]
SOURCES = {"photo", "video", "webcam"}
METHODS = {"haar", "roboflow"}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024
# ALLOWED_ORIGIN may hold several comma-separated origins (e.g. prod + localhost).
CORS(app, origins=[origin.strip() for origin in ALLOWED_ORIGIN.split(",") if origin.strip()])

cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
if cascade.empty():
    raise RuntimeError("haarcascade_frontalface_default.xml could not be loaded")

_log_lock = threading.Lock()
_roboflow_client = None


def get_roboflow_client():
    global _roboflow_client
    if not ROBOFLOW_API_KEY:
        raise ValueError("Roboflow is not configured on the server (ROBOFLOW_API_KEY is missing).")
    if _roboflow_client is None:
        from inference_sdk import InferenceConfiguration, InferenceHTTPClient

        client = InferenceHTTPClient(api_url=ROBOFLOW_API_URL, api_key=ROBOFLOW_API_KEY)
        client.configure(InferenceConfiguration(confidence_threshold=ROBOFLOW_CONFIDENCE))
        _roboflow_client = client
    return _roboflow_client


def detect_haar(image, min_neighbors):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=SCALE_FACTOR, minNeighbors=min_neighbors, minSize=(30, 30))
    return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]


def roboflow_to_boxes(result):
    """Convert Roboflow centre-based predictions to (left, top, width, height).

    The model's only class is literally "Face Detection - v21 YOLOv5s", so every
    prediction counts as a face; we do not filter on class == "face".
    """
    boxes = []
    for p in result.get("predictions", []):
        width, height = float(p["width"]), float(p["height"])
        left = float(p["x"]) - width / 2
        top = float(p["y"]) - height / 2
        boxes.append((int(round(left)), int(round(top)), int(round(width)), int(round(height))))
    return boxes


def detect_roboflow(image):
    result = get_roboflow_client().infer(image, model_id=ROBOFLOW_MODEL_ID)
    if isinstance(result, list):
        result = result[0]
    return roboflow_to_boxes(result)


def draw_boxes(image, boxes):
    annotated = image.copy()
    thickness = max(2, round(max(image.shape[:2]) / 400))
    for index, (x, y, w, h) in enumerate(boxes, start=1):
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (131, 255, 217), thickness)
        label = f"#{index}"
        (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        label_top = max(0, y - th - baseline - 6)
        cv2.rectangle(annotated, (x, label_top), (x + tw + 8, label_top + th + baseline + 6), (131, 255, 217), -1)
        cv2.putText(annotated, label, (x + 4, label_top + th + 3), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (36, 52, 24), 2)
    return annotated


def append_log(source, method, face_count):
    now = datetime.now(timezone.utc)
    row = [now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S"), source, method, face_count]
    with _log_lock:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        new_file = not os.path.exists(LOG_PATH) or os.path.getsize(LOG_PATH) == 0
        with open(LOG_PATH, "a", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            if new_file:
                writer.writerow(CSV_HEADER)
            writer.writerow(row)
    return dict(zip(CSV_HEADER, row))


def read_logs(limit):
    if not os.path.exists(LOG_PATH):
        return []
    with _log_lock, open(LOG_PATH, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    return rows[-limit:][::-1]


def decode_image(file_storage):
    data = np.frombuffer(file_storage.read(), dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        return None
    height, width = image.shape[:2]
    if max(height, width) > MAX_SIDE:
        scale = MAX_SIDE / max(height, width)
        image = cv2.resize(image, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
    return image


@app.get("/health")
def health():
    return jsonify(ok=True, roboflow_configured=bool(ROBOFLOW_API_KEY), model_id=ROBOFLOW_MODEL_ID)


@app.post("/detect")
def detect():
    upload = request.files.get("image")
    if upload is None:
        return jsonify(error="Send the image as multipart form field 'image'."), 400

    method = request.form.get("method", "haar").lower()
    source = request.form.get("source", "photo").lower()
    should_log = request.form.get("log", "true").lower() != "false"
    if method not in METHODS:
        return jsonify(error="method must be 'haar' or 'roboflow'."), 400
    if source not in SOURCES:
        return jsonify(error="source must be 'photo', 'video' or 'webcam'."), 400
    try:
        min_neighbors = int(request.form.get("min_neighbors", DEFAULT_MIN_NEIGHBORS))
    except ValueError:
        return jsonify(error="min_neighbors must be a whole number."), 400
    min_neighbors = max(3, min(9, min_neighbors))

    image = decode_image(upload)
    if image is None:
        return jsonify(error="The file could not be read as an image."), 400

    try:
        boxes = detect_haar(image, min_neighbors) if method == "haar" else detect_roboflow(image)
    except ValueError as error:
        return jsonify(error=str(error)), 503
    except Exception as error:  # network/API errors from Roboflow
        app.logger.exception("Detection failed")
        return jsonify(error=f"Detection failed: {error}"), 502

    annotated = draw_boxes(image, boxes)
    ok, jpeg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        return jsonify(error="The result image could not be encoded."), 500

    record = append_log(source, method, len(boxes)) if should_log else None
    return jsonify(
        face_count=len(boxes),
        boxes=[{"x": x, "y": y, "width": w, "height": h} for (x, y, w, h) in boxes],
        image_width=image.shape[1],
        image_height=image.shape[0],
        image="data:image/jpeg;base64," + base64.b64encode(jpeg.tobytes()).decode("ascii"),
        method=method,
        source=source,
        min_neighbors=min_neighbors if method == "haar" else None,
        record=record,
    )


@app.get("/logs")
def logs():
    """Download the CSV, or ?format=json for the most recent rows (newest first)."""
    if request.args.get("format") == "json":
        limit = max(1, min(500, request.args.get("limit", 100, type=int)))
        return jsonify(records=read_logs(limit))
    if not os.path.exists(LOG_PATH):
        with _log_lock:
            os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
            with open(LOG_PATH, "w", newline="", encoding="utf-8") as handle:
                csv.writer(handle).writerow(CSV_HEADER)
    return send_file(LOG_PATH, mimetype="text/csv", as_attachment=True, download_name="attendance_log.csv")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
