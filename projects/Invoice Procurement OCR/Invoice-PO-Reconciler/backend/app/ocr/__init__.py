from pydantic import BaseModel


class OcrResult(BaseModel):
    text: str
    confidence: float


class DualOcrResult(BaseModel):
    tesseract: OcrResult
    paddleocr: OcrResult
    best_source: str
    best_text: str
