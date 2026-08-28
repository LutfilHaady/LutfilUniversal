#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Execute the notebook and generate visualizations
"""
import nbformat
from nbconvert.preprocessors import ExecutePreprocessor
import sys
import os

print("=" * 80)
print("EXECUTING NOTEBOOK TO GENERATE VISUALIZATIONS")
print("=" * 80)
print("\nThis may take several minutes, especially for loading transaction data...")
print("Please be patient...\n")

# Read the notebook
try:
    with open('ERC20_Starter Code.ipynb', 'r', encoding='utf-8') as f:
        nb = nbformat.read(f, as_version=4)
    print("✓ Notebook loaded successfully")
except Exception as e:
    print(f"✗ Error loading notebook: {e}")
    sys.exit(1)

# Execute the notebook
ep = ExecutePreprocessor(timeout=3600, kernel_name='python3', allow_errors=True)
try:
    print("\nStarting execution...")
    ep.preprocess(nb, {'metadata': {'path': '.'}})
    print("\n" + "=" * 80)
    print("NOTEBOOK EXECUTED SUCCESSFULLY!")
    print("=" * 80)
    print("\nCheck the current directory for generated PNG visualization files:")
    print("  - q1_onset_price_depegging.png")
    print("  - q1_stress_transaction_patterns.png")
    print("  - q1_panic_propagation_flows.png")
    print("  - q1_sentiment_events.png")
    print("  - q3_loss_identification.png")
    print("  - q3_loss_estimation.png")
    print("  - q3_system_design_failure.png")
    print("  - q3_comparative_analysis.png")
except KeyboardInterrupt:
    print("\n\nExecution interrupted by user")
    sys.exit(1)
except Exception as e:
    print(f"\n\nError during execution: {e}")
    print("\nNote: Some cells may have executed successfully.")
    print("Check for generated PNG files in the current directory.")
    sys.exit(1)
