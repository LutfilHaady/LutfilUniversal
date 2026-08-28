from PIL import Image

from app.ocr import OcrResult, DualOcrResult
from app.ocr.tesseract import run_tesseract
from app.ocr.paddle import run_paddleocr


def run_dual_ocr(image: Image.Image) -> DualOcrResult:
    tess_result = run_tesseract(image)
    paddle_result = run_paddleocr(image)
    if tess_result.confidence >= paddle_result.confidence:
        best_source = "tesseract"
        best_text = tess_result.text
    else:
        best_source = "paddleocr"
        best_text = paddle_result.text
    return DualOcrResult(
        tesseract=tess_result,
        paddleocr=paddle_result,
        best_source=best_source,
        best_text=best_text,
    )
