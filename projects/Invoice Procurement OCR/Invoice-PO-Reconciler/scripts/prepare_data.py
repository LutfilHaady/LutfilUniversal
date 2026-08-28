"""
Data preparation script.
Downloads invoice images from HuggingFace dataset and saves selected ones locally.

Usage:
    cd Invoice-PO-Reconciler
    python scripts/prepare_data.py

Requires: pip install datasets Pillow
"""

import json
from pathlib import Path


def main():
    data_dir = Path(__file__).resolve().parent.parent / "data"
    invoices_dir = data_dir / "invoices"
    invoices_dir.mkdir(parents=True, exist_ok=True)

    try:
        from datasets import load_dataset
    except ImportError:
        print("ERROR: 'datasets' package not installed.")
        print("Install it with: pip install datasets Pillow")
        print()
        print("This script browses the HuggingFace invoice dataset so you can")
        print("manually pick images for testing. It is not needed for running")
        print("the main application.")
        return

    print("Loading dataset from HuggingFace...")
    ds = load_dataset("mychen76/invoices-and-receipts_ocr_v1", split="train")
    print(f"Dataset loaded: {len(ds)} rows")

    # Browse and filter: look for rows with clear invoice formatting
    # Print first 20 rows' text to help manual selection
    for i in range(min(20, len(ds))):
        row = ds[i]
        text = row.get("text", "")[:200] if row.get("text") else "NO TEXT"
        print(f"\n--- Row {i} ---")
        print(f"Text preview: {text}")
        if row.get("image"):
            print("Has image: yes")

    print("\n\nReview the rows above.")
    print("Then manually pick 10-15 rows by index and save their images.")
    print("Example: to save row 5's image:")
    print(f'  ds[5]["image"].save("{invoices_dir / "inv_001.png"}")')
    print()
    print("After saving images, author matching PO JSON files in")
    print(f"  {data_dir / 'purchase_orders'}/")
    print("and update data/ground_truth.json with the pairing manifest.")


if __name__ == "__main__":
    main()
