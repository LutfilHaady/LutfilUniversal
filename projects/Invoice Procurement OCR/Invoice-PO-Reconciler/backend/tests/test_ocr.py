from PIL import Image, ImageDraw
import pytest
from app.ocr.tesseract import run_tesseract
from app.ocr.paddle import run_paddleocr
from app.ocr.compare import run_dual_ocr, OcrResult, DualOcrResult


def _paddleocr_works():
    """Check if PaddleOCR can actually produce output on this platform."""
    try:
        img = Image.new("RGB", (200, 50), "white")
        draw = ImageDraw.Draw(img)
        draw.text((5, 5), "test", fill="black")
        result = run_paddleocr(img)
        return len(result.text) > 0
    except Exception:
        return False


@pytest.fixture
def test_image():
    """Create a simple image with known text for OCR testing."""
    img = Image.new("RGB", (400, 100), "white")
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), "Invoice Number: INV-001", fill="black")
    draw.text((10, 50), "Total: $100.00", fill="black")
    return img


def test_run_tesseract_returns_ocr_result(test_image):
    result = run_tesseract(test_image)
    assert isinstance(result, OcrResult)
    assert isinstance(result.text, str)
    assert len(result.text) > 0
    assert 0.0 <= result.confidence <= 1.0


@pytest.mark.skipif(
    not _paddleocr_works(),
    reason="PaddleOCR runtime unavailable (PaddlePaddle oneDNN bug on this platform)",
)
def test_run_paddleocr_returns_ocr_result(test_image):
    result = run_paddleocr(test_image)
    assert isinstance(result, OcrResult)
    assert isinstance(result.text, str)
    assert len(result.text) > 0
    assert 0.0 <= result.confidence <= 1.0


def test_run_paddleocr_returns_ocr_result_type(test_image):
    """Verify PaddleOCR returns a valid OcrResult even when engine is unavailable."""
    result = run_paddleocr(test_image)
    assert isinstance(result, OcrResult)
    assert isinstance(result.text, str)
    assert 0.0 <= result.confidence <= 1.0


def test_run_dual_ocr_returns_both(test_image):
    result = run_dual_ocr(test_image)
    assert isinstance(result, DualOcrResult)
    assert isinstance(result.tesseract, OcrResult)
    assert isinstance(result.paddleocr, OcrResult)
    assert result.best_source in ("tesseract", "paddleocr")
    assert result.best_text == (
        result.tesseract.text
        if result.best_source == "tesseract"
        else result.paddleocr.text
    )


def test_run_dual_ocr_picks_higher_confidence(test_image):
    result = run_dual_ocr(test_image)
    if result.tesseract.confidence >= result.paddleocr.confidence:
        assert result.best_source == "tesseract"
    else:
        assert result.best_source == "paddleocr"
