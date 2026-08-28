"""
Tests for the evaluation module (scripts.evaluate).

Tests the discrepancy comparison and metrics computation functions.
"""

import sys
from pathlib import Path

import pytest

# Add repo root to path so we can import scripts
repo_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(repo_root))

from scripts.evaluate import compare_discrepancies, compute_metrics


class TestCompareDiscrepancies:
    """Test the compare_discrepancies matching logic."""

    def test_clean_match_no_discrepancies(self):
        """Test a pair with 0 expected and 0 detected discrepancies."""
        detected = []
        expected = []
        tp, fp, fn = compare_discrepancies(detected, expected)
        assert tp == 0
        assert fp == 0
        assert fn == 0

    def test_all_expected_detected(self):
        """Test a pair where all expected discrepancies are detected."""
        expected = [
            {"type": "price_mismatch", "line_item": "USB-C Cable 2m", "invoice_value": "9.50", "po_value": "8.50"}
        ]
        detected = [
            type("Discrepancy", (), {
                "type": "price_mismatch",
                "line_item": "USB-C Cable 2m",
                "severity": "high",
                "justification": "Price differs",
                "invoice_value": "9.50",
                "po_value": "8.50",
                "financial_impact": 1.0,
            })()
        ]
        tp, fp, fn = compare_discrepancies(detected, expected)
        assert tp == 1
        assert fp == 0
        assert fn == 0

    def test_false_positive_detected(self):
        """Test when there's a detected discrepancy not in expected."""
        expected = []
        detected = [
            type("Discrepancy", (), {
                "type": "price_mismatch",
                "line_item": "USB-C Cable 2m",
                "severity": "high",
                "justification": "Price differs",
                "invoice_value": "9.50",
                "po_value": "8.50",
                "financial_impact": 1.0,
            })()
        ]
        tp, fp, fn = compare_discrepancies(detected, expected)
        assert tp == 0
        assert fp == 1
        assert fn == 0

    def test_false_negative_not_detected(self):
        """Test when expected discrepancy is not detected."""
        expected = [
            {"type": "price_mismatch", "line_item": "USB-C Cable 2m", "invoice_value": "9.50", "po_value": "8.50"}
        ]
        detected = []
        tp, fp, fn = compare_discrepancies(detected, expected)
        assert tp == 0
        assert fp == 0
        assert fn == 1

    def test_mixed_results(self):
        """Test with mix of TP, FP, and FN."""
        expected = [
            {"type": "price_mismatch", "line_item": "USB-C Cable 2m", "invoice_value": "9.50", "po_value": "8.50"},
            {"type": "quantity_mismatch", "line_item": "A4 Paper", "invoice_value": "100", "po_value": "50"},
        ]
        detected = [
            type("Discrepancy", (), {
                "type": "price_mismatch",
                "line_item": "USB-C Cable 2m",
                "severity": "high",
                "justification": "Price differs",
                "invoice_value": "9.50",
                "po_value": "8.50",
                "financial_impact": 1.0,
            })(),
            type("Discrepancy", (), {
                "type": "tax_mismatch",
                "line_item": None,
                "severity": "medium",
                "justification": "Tax differs",
                "invoice_value": "100",
                "po_value": "90",
                "financial_impact": 10.0,
            })(),
        ]
        tp, fp, fn = compare_discrepancies(detected, expected)
        assert tp == 1  # price_mismatch matched
        assert fp == 1  # tax_mismatch not in expected
        assert fn == 1  # quantity_mismatch not detected

    def test_case_insensitive_line_item_matching(self):
        """Test that line_item matching is case-insensitive."""
        expected = [
            {"type": "price_mismatch", "line_item": "USB-C CABLE 2M", "invoice_value": "9.50", "po_value": "8.50"}
        ]
        detected = [
            type("Discrepancy", (), {
                "type": "price_mismatch",
                "line_item": "usb-c cable 2m",
                "severity": "high",
                "justification": "Price differs",
                "invoice_value": "9.50",
                "po_value": "8.50",
                "financial_impact": 1.0,
            })()
        ]
        tp, fp, fn = compare_discrepancies(detected, expected)
        assert tp == 1
        assert fp == 0
        assert fn == 0

    def test_whitespace_normalized_line_item(self):
        """Test that whitespace in line_item is normalized."""
        expected = [
            {"type": "price_mismatch", "line_item": "USB-C  Cable   2m", "invoice_value": "9.50", "po_value": "8.50"}
        ]
        detected = [
            type("Discrepancy", (), {
                "type": "price_mismatch",
                "line_item": "usb-c cable 2m",
                "severity": "high",
                "justification": "Price differs",
                "invoice_value": "9.50",
                "po_value": "8.50",
                "financial_impact": 1.0,
            })()
        ]
        tp, fp, fn = compare_discrepancies(detected, expected)
        assert tp == 1
        assert fp == 0
        assert fn == 0


class TestComputeMetrics:
    """Test the compute_metrics function."""

    def test_perfect_score(self):
        """Test perfect precision, recall, and F1 when TP=1, FP=0, FN=0."""
        metrics = compute_metrics(tp=1, fp=0, fn=0)
        assert metrics["precision"] == 1.0
        assert metrics["recall"] == 1.0
        assert metrics["f1"] == 1.0

    def test_zero_division_all_zero(self):
        """Test handling of zero-division when all metrics are zero."""
        metrics = compute_metrics(tp=0, fp=0, fn=0)
        assert metrics["precision"] == 0.0
        assert metrics["recall"] == 0.0
        assert metrics["f1"] == 0.0

    def test_precision_only(self):
        """Test precision with some false positives."""
        # precision = TP / (TP + FP) = 1 / (1 + 1) = 0.5
        metrics = compute_metrics(tp=1, fp=1, fn=0)
        assert metrics["precision"] == 0.5

    def test_recall_only(self):
        """Test recall with some false negatives."""
        # recall = TP / (TP + FN) = 1 / (1 + 1) = 0.5
        metrics = compute_metrics(tp=1, fp=0, fn=1)
        assert metrics["recall"] == 0.5

    def test_f1_calculation(self):
        """Test F1 score calculation."""
        # tp=2, fp=1, fn=1
        # precision = 2 / (2 + 1) = 2/3 ≈ 0.667
        # recall = 2 / (2 + 1) = 2/3 ≈ 0.667
        # f1 = 2 * (precision * recall) / (precision + recall) = 0.667
        metrics = compute_metrics(tp=2, fp=1, fn=1)
        assert abs(metrics["precision"] - 2/3) < 0.01
        assert abs(metrics["recall"] - 2/3) < 0.01
        assert abs(metrics["f1"] - 2/3) < 0.01
