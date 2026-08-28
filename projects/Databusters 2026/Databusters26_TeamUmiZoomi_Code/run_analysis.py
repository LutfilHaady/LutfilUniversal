"""
Standalone script to run the financial run dynamics analysis
This extracts and runs the key analysis code from the notebook
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Now import and run the analysis
exec(open('ERC20_Starter Code.ipynb').read())
