import logging
import tempfile
import os

import numpy as np
from PIL import Image

from app.ocr import OcrResult

logger = logging.getLogger(__name__)

_ocr_engine = None
_paddle_available = True


def _get_engine():
    """Lazily initialize PaddleOCR engine.

    Handles API differences between PaddleOCR v2.x (use_angle_cls, show_log)
    and v3.x (use_textline_orientation, no show_log).
    """
    global _ocr_engine, _paddle_available
    if not _paddle_available:
        return None
    if _ocr_engine is None:
        try:
            from paddleocr import PaddleOCR

            # PaddleOCR v3.7+ removed show_log and deprecated use_angle_cls
            try:
                _ocr_engine = PaddleOCR(
                    use_angle_cls=True, lang="en", show_log=False
                )
            except (TypeError, ValueError):
                # v3.7+ API: use_textline_orientation replaces use_angle_cls,
                # show_log is no longer a valid kwarg
                _ocr_engine = PaddleOCR(lang="en")
        except ImportError:
            logger.warning("paddleocr is not installed; PaddleOCR will be unavailable")
            _paddle_available = False
            return None
    return _ocr_engine


def run_paddleocr(image: Image.Image) -> OcrResult:
    """Run PaddleOCR on an image and return extracted text with confidence.

    Falls back to empty result if PaddleOCR is not available or fails at runtime.
    """
    engine = _get_engine()
    if engine is None:
        return OcrResult(text="", confidence=0.0)

    img_array = np.array(image)

    try:
        # Try the legacy .ocr() API first (PaddleOCR v2.x)
        results = engine.ocr(img_array, cls=True)
    except (TypeError, AttributeError):
        # v3.7+ uses .predict() instead of .ocr()
        try:
            fd, tmp_path = tempfile.mkstemp(suffix=".png")
            os.close(fd)
            image.save(tmp_path)
            try:
                raw = list(engine.predict(tmp_path))
                # v3.7 predict returns result objects with rec_texts/rec_scores
                lines = []
                confidences = []
                for result_obj in raw:
                    if hasattr(result_obj, "rec_texts"):
                        for text, score in zip(
                            result_obj.rec_texts, result_obj.rec_scores
                        ):
                            lines.append(text)
                            confidences.append(float(score))
                full_text = "\n".join(lines)
                avg_conf = (
                    sum(confidences) / len(confidences) if confidences else 0.0
                )
                return OcrResult(text=full_text, confidence=avg_conf)
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
        except Exception as e:
            logger.warning("PaddleOCR predict() failed: %s", e)
            return OcrResult(text="", confidence=0.0)
    except Exception as e:
        logger.warning("PaddleOCR ocr() failed: %s", e)
        return OcrResult(text="", confidence=0.0)

    # Parse legacy .ocr() results
    if not results or not results[0]:
        return OcrResult(text="", confidence=0.0)
    lines = []
    confidences = []
    for line in results[0]:
        text = line[1][0]
        conf = line[1][1]
        lines.append(text)
        confidences.append(conf)
    full_text = "\n".join(lines)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return OcrResult(text=full_text, confidence=avg_confidence)
