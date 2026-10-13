#!/usr/bin/env python3
"""
vision.py - screenshot + tesseract OCR to locate UI anchors in Android Studio.

All returned coordinates are LOGICAL (1280x720) so they can be passed straight
to VirtualPointer.click().
"""
import csv
import io
import os
import subprocess
import sys
import time

SHOT_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "../../../.agent/autopilot/shots"))
os.makedirs(SHOT_DIR, exist_ok=True)


def screenshot(name="shot"):
    path = os.path.join(SHOT_DIR, "%s_%d.png" % (name, int(time.time())))
    subprocess.run(["spectacle", "-b", "-n", "-o", path], check=True, capture_output=True)
    return path


def _image_size(path):
    out = subprocess.run(["identify", "-format", "%w %h", path],
                         capture_output=True, text=True).stdout.split()
    return int(out[0]), int(out[1])


def ocr_words(path):
    """Return [{text, x, y, w, h, conf}] in logical coordinates (center x/y)."""
    from uinput_input import LOGICAL_W, LOGICAL_H
    iw, ih = _image_size(path)
    sx, sy = LOGICAL_W / float(iw), LOGICAL_H / float(ih)
    tsv = subprocess.run(["tesseract", path, "stdout", "--psm", "11", "tsv"],
                         capture_output=True, text=True).stdout
    words = []
    for row in csv.DictReader(io.StringIO(tsv), delimiter="\t", quoting=csv.QUOTE_NONE):
        text = (row.get("text") or "").strip()
        if not text:
            continue
        try:
            conf = float(row["conf"])
            l, t, w, h = (int(row[k]) for k in ("left", "top", "width", "height"))
        except (KeyError, ValueError):
            continue
        words.append({"text": text, "conf": conf,
                      "x": (l + w / 2) * sx, "y": (t + h / 2) * sy,
                      "w": w * sx, "h": h * sy})
    return words


def find(words, text, region=None, min_conf=30):
    """Find best word match (case-insensitive substring). region=(x0,y0,x1,y1) logical."""
    text = text.lower()
    hits = [w for w in words if text in w["text"].lower() and w["conf"] >= min_conf]
    if region:
        x0, y0, x1, y1 = region
        hits = [w for w in hits if x0 <= w["x"] <= x1 and y0 <= w["y"] <= y1]
    return sorted(hits, key=lambda w: -w["conf"])[0] if hits else None


def dump(path=None):
    path = path or screenshot("dump")
    words = ocr_words(path)
    print("screenshot:", path)
    for w in words:
        if w["conf"] >= 50:
            print("%-28s x=%6.1f y=%6.1f conf=%3.0f" % (w["text"], w["x"], w["y"], w["conf"]))
    return words


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(__file__))
    if len(sys.argv) > 1 and sys.argv[1] == "--dump":
        dump(sys.argv[2] if len(sys.argv) > 2 else None)
