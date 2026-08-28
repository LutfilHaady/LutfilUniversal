import os
import shutil

import pytesseract
from PIL import Image

from app.ocr import OcrResult

# Auto-detect Tesseract on Windows if not already on PATH
if not shutil.which("tesseract"):
    _win_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.isfile(_win_path):
        pytesseract.pytesseract.tesseract_cmd = _win_path


def run_tesseract(image: Image.Image) -> OcrResult:
    text = pytesseract.image_to_string(image)
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    confidences = [int(c) for c in data["conf"] if int(c) > 0]
    avg_confidence = sum(confidences) / len(confidences) / 100.0 if confidences else 0.0
    return OcrResult(text=text.strip(), confidence=avg_confidence)
