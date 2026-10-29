"""Compare Haar face counts across minNeighbors 3-9 for a folder of test images.

Put poorly lit and angled-face photos in backend/test_images/, then run:
    python tune_min_neighbors.py [folder]
Pick the lowest minNeighbors that removes false boxes without losing real faces.
Annotated copies are written to test_images/out/ so you can check each box.
"""

import os
import sys

import cv2

from app import SCALE_FACTOR, detect_haar, draw_boxes

folder = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "test_images")
out_dir = os.path.join(folder, "out")
os.makedirs(out_dir, exist_ok=True)
values = range(3, 10)

print(f"scaleFactor={SCALE_FACTOR}")
print(f"{'image':<32}" + "".join(f"mn={n:<4}" for n in values))
for name in sorted(os.listdir(folder)):
    if not name.lower().endswith((".jpg", ".jpeg", ".png")):
        continue
    image = cv2.imread(os.path.join(folder, name))
    if image is None:
        continue
    counts = []
    for n in values:
        boxes = detect_haar(image, n)
        counts.append(len(boxes))
        cv2.imwrite(os.path.join(out_dir, f"{os.path.splitext(name)[0]}_mn{n}.jpg"), draw_boxes(image, boxes))
    print(f"{name[:31]:<32}" + "".join(f"{c:<7}" for c in counts))
