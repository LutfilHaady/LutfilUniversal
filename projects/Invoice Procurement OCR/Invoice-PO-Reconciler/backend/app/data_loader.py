"""
Data loader for purchase orders and ground truth configuration.

Provides helpers to deserialize PO JSON files into Pydantic models
and to load the ground truth pairing manifest used by evaluation.
"""

import json
from pathlib import Path

from pydantic import BaseModel

from app.models.schemas import PurchaseOrderData


class PairConfig(BaseModel):
    """A single invoice-PO test pair from ground_truth.json."""

    id: str
    invoice: str
    po: str
    expected_discrepancies: list[dict]
    label: str


def load_po(path: Path) -> PurchaseOrderData:
    """Load a purchase order JSON file and return a validated PurchaseOrderData.

    Args:
        path: Path to the PO JSON file.

    Returns:
        A PurchaseOrderData instance.

    Raises:
        FileNotFoundError: If the file does not exist.
        json.JSONDecodeError: If the file is not valid JSON.
        pydantic.ValidationError: If the data does not match the schema.
    """
    with open(path) as f:
        data = json.load(f)
    return PurchaseOrderData(**data)


def load_ground_truth(path: Path) -> list[PairConfig]:
    """Load ground truth pairing manifest.

    Args:
        path: Path to ground_truth.json.

    Returns:
        A list of PairConfig instances, one per invoice-PO pair.
    """
    with open(path) as f:
        data = json.load(f)
    return [PairConfig(**pair) for pair in data["pairs"]]
