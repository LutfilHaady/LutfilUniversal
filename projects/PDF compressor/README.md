# Local PDF Compressor (runs offline)

A lightweight local PDF compressor with a simple UI:

- Select PDFs from anywhere (multi-select) or select a folder (recursive scan)
- Choose a quality/size preset
- Outputs compressed PDFs next to the originals (keeps originals)

## Requirements

- Python 3.9+

Optional (best compression):

- Ghostscript installed and available on `PATH` (Windows executable is usually `gswin64c.exe`)

## Install

From `c:\Users\lutfi\OneDrive\Desktop\Coding\PDF compressor`:

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
```

## Run

```bash
python main.py
```

## How compression works

- **If Ghostscript is available**: the app uses it for the selected preset:
  - `Smallest` → `/screen`
  - `Small` → `/ebook`
  - `Medium` → `/printer`
  - `High` → `/prepress`
- **If Ghostscript is not available**: the app falls back to **PyMuPDF** stream deflation + cleanup. This still reduces many PDFs but may not shrink image-heavy PDFs as much as Ghostscript.

## Output

Choose one of:

- Create a `Compressed` subfolder next to each input (folder mode: under the selected folder; file mode: under each file’s folder)
- Create a sibling folder `<folder>_compressed` next to each input folder (file mode uses each PDF’s parent folder)

The folder structure is preserved.

## Optional: drag-and-drop folders

On Windows, drag-and-drop can work if `tkinterdnd2` installs successfully. If drag-and-drop is not enabled, the app still works via the folder picker.

## Optional: build an EXE (PyInstaller)

```bash
pip install pyinstaller
pyinstaller --noconsole --onefile main.py
```

The executable will appear under `dist\\main.exe`.
