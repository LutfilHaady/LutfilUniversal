import nbformat
from nbconvert.preprocessors import ExecutePreprocessor
import sys

# Read the notebook
with open('ERC20_Starter Code.ipynb', 'r', encoding='utf-8') as f:
    nb = nbformat.read(f, as_version=4)

# Execute the notebook
ep = ExecutePreprocessor(timeout=600, kernel_name='python3')
try:
    ep.preprocess(nb, {'metadata': {'path': '.'}})
    print("Notebook executed successfully!")
except Exception as e:
    print(f"Error executing notebook: {e}")
    sys.exit(1)

# Save the executed notebook (optional)
# with open('ERC20_Starter Code_executed.ipynb', 'w', encoding='utf-8') as f:
#     nbformat.write(nb, f)
