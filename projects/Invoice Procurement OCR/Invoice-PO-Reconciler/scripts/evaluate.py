"""
Evaluation script for invoice-PO reconciliation ground truth pairs.

Runs all ground truth pairs through the reconciliation pipeline, compares
detected discrepancies against expected ones, and outputs accuracy metrics
and OCR engine comparison statistics.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image

# Add parent directory to path for imports
repo_root = Path(__file__).parent.parent
sys.path.insert(0, str(repo_root / "backend"))

from app.data_loader import load_ground_truth, load_po
from app.services.reconciler import reconcile
from app.models.schemas import Discrepancy


def compare_discrepancies(
    detected: list[Discrepancy],
    expected: list[dict[str, Any]],
) -> tuple[int, int, int]:
    """
    Match detected discrepancies against expected ones.

    Matching logic:
    - Match by type (exact)
    - If multiple detected have the same type, also match by line_item
      (case-insensitive, whitespace-normalized)
    - A detected discrepancy matching an expected = true positive
    - A detected discrepancy with no match = false positive
    - An expected discrepancy with no match = false negative

    Args:
        detected: List of Discrepancy objects from reconciliation
        expected: List of expected discrepancy dicts from ground truth

    Returns:
        (true_positives, false_positives, false_negatives)
    """
    tp = 0
    fp = 0
    fn = 0

    # Track which expected discrepancies have been matched
    matched_expected = set()

    for det in detected:
        # Normalize detected line_item for matching
        det_line_normalized = (
            " ".join(det.line_item.lower().split()) if det.line_item else None
        )

        found_match = False
        for i, exp in enumerate(expected):
            if i in matched_expected:
                continue

            # Match by type (exact)
            if det.type != exp.get("type"):
                continue

            # If line_item is present in both, match by normalized line_item too
            exp_line = exp.get("line_item")
            if exp_line:
                exp_line_normalized = " ".join(exp_line.lower().split())
                if det_line_normalized != exp_line_normalized:
                    continue

            # Found a match
            tp += 1
            matched_expected.add(i)
            found_match = True
            break

        if not found_match:
            fp += 1

    # Any expected that wasn't matched is a false negative
    fn = len(expected) - len(matched_expected)

    return tp, fp, fn


def compute_metrics(tp: int, fp: int, fn: int) -> dict[str, float]:
    """
    Compute precision, recall, and F1 score.

    Handles zero-division by returning 0.0 for any metric.

    Args:
        tp: True positives
        fp: False positives
        fn: False negatives

    Returns:
        Dictionary with keys: precision, recall, f1
    """
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0

    if precision + recall > 0:
        f1 = 2 * (precision * recall) / (precision + recall)
    else:
        f1 = 0.0

    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def main(
    data_dir: Path,
    output_path: Path | None = None,
    output_format: str = "text",
) -> None:
    """
    Run evaluation on all ground truth pairs and output results.

    Args:
        data_dir: Path to data directory containing ground_truth.json
        output_path: Path to output file (None = stdout)
        output_format: Output format: 'text' or 'json'
    """
    # Load ground truth
    gt_path = data_dir / "ground_truth.json"
    pairs = load_ground_truth(gt_path)

    # Track results
    pair_results = []
    all_tp = 0
    all_fp = 0
    all_fn = 0
    tesseract_confidences = []
    paddleocr_confidences = []
    all_field_agreements = []

    # Process each pair
    for pair in pairs:
        invoice_path = data_dir / pair.invoice
        po_path = data_dir / pair.po

        # Load PO
        po = load_po(po_path)

        # Load and process invoice image
        image = Image.open(invoice_path)
        result = reconcile(image, po, seen_invoices=[])

        # Compare discrepancies
        tp, fp, fn = compare_discrepancies(result.discrepancies, pair.expected_discrepancies)
        all_tp += tp
        all_fp += fp
        all_fn += fn

        # Determine pass/fail (perfect match = no FP or FN)
        status = "PASS" if (fp == 0 and fn == 0) else "FAIL"

        # Collect OCR metrics
        if result.ocr_comparison:
            tesseract_confidences.append(result.ocr_comparison.tesseract_confidence)
            paddleocr_confidences.append(result.ocr_comparison.paddleocr_confidence)
            agreement_count = sum(result.ocr_comparison.field_agreement.values())
            all_field_agreements.append((agreement_count, len(result.ocr_comparison.field_agreement)))

        pair_results.append({
            "id": pair.id,
            "label": pair.label,
            "expected_count": len(pair.expected_discrepancies),
            "detected_count": len(result.discrepancies),
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "status": status,
            "ocr_comparison": result.ocr_comparison,
        })

    # Compute aggregate metrics
    aggregate_metrics = compute_metrics(all_tp, all_fp, all_fn)

    # Compute OCR stats
    avg_tesseract = (
        sum(tesseract_confidences) / len(tesseract_confidences)
        if tesseract_confidences
        else 0.0
    )
    avg_paddleocr = (
        sum(paddleocr_confidences) / len(paddleocr_confidences)
        if paddleocr_confidences
        else 0.0
    )
    paddleocr_preferred = sum(
        1 for t, p in zip(tesseract_confidences, paddleocr_confidences)
        if p > t
    )
    total_agreement = sum(a for a, _ in all_field_agreements)
    total_fields = sum(t for _, t in all_field_agreements)
    field_agreement_rate = (total_agreement / total_fields * 100) if total_fields > 0 else 0.0

    # Format output
    if output_format == "json":
        output = {
            "pairs": pair_results,
            "aggregate_metrics": aggregate_metrics,
            "pairs_evaluated": len(pairs),
            "ocr_comparison": {
                "avg_tesseract_confidence": avg_tesseract,
                "avg_paddleocr_confidence": avg_paddleocr,
                "paddleocr_preferred": f"{paddleocr_preferred}/{len(pairs)}",
                "field_agreement_rate": f"{field_agreement_rate:.1f}% ({total_agreement}/{total_fields})",
            },
        }
        output_str = json.dumps(output, indent=2, default=str)
    else:
        # Text format
        output_lines = ["=== Invoice-PO Reconciler Evaluation ===", ""]

        for result in pair_results:
            output_lines.append(f"Pair: {result['id']} ({result['label']})")
            output_lines.append(f"  Expected discrepancies: {result['expected_count']}")
            output_lines.append(f"  Detected discrepancies: {result['detected_count']}")
            output_lines.append(
                f"  TP: {result['tp']}  FP: {result['fp']}  FN: {result['fn']}  → {result['status']}"
            )

            if result["ocr_comparison"]:
                ocr = result["ocr_comparison"]
                agreement_count = sum(ocr.field_agreement.values())
                output_lines.append(
                    f"  OCR: Tesseract {ocr.tesseract_confidence:.2f} | "
                    f"PaddleOCR {ocr.paddleocr_confidence:.2f} | "
                    f"Agreement: {agreement_count}/{len(ocr.field_agreement)} fields"
                )
            output_lines.append("")

        output_lines.extend([
            "=== Aggregate Metrics ===",
            f"Pairs evaluated: {len(pairs)}",
            f"Precision: {aggregate_metrics['precision']:.3f}",
            f"Recall: {aggregate_metrics['recall']:.3f}",
            f"F1 Score: {aggregate_metrics['f1']:.3f}",
            "",
            "=== OCR Engine Comparison ===",
            f"Avg Tesseract confidence: {avg_tesseract:.3f}",
            f"Avg PaddleOCR confidence: {avg_paddleocr:.3f}",
            f"PaddleOCR preferred: {paddleocr_preferred}/{len(pairs)} pairs",
            f"Field agreement rate: {field_agreement_rate:.1f}% ({total_agreement}/{total_fields})",
        ])
        output_str = "\n".join(output_lines)

    # Write output
    if output_path:
        output_path.write_text(output_str)
    else:
        print(output_str)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evaluate invoice-PO reconciliation on ground truth pairs."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default="data",
        help="Path to data directory (default: data/)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output file path (default: stdout)",
    )
    parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Output format (default: text)",
    )

    args = parser.parse_args()
    main(args.data_dir, args.output, args.format)
