from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DiscoveryResult:
    root_folder: Path
    pdf_paths: list[Path]


def discover_pdfs(root_folder: Path) -> DiscoveryResult:
    resolved_root = root_folder.resolve()
    if not resolved_root.exists():
        raise FileNotFoundError(f"Folder not found: {resolved_root}")
    if not resolved_root.is_dir():
        raise NotADirectoryError(f"Not a folder: {resolved_root}")

    pdf_paths: list[Path] = []
    for path in resolved_root.rglob("*.pdf"):
        if path.is_file():
            pdf_paths.append(path.resolve())

    pdf_paths.sort(key=lambda file_path: str(file_path).lower())
    return DiscoveryResult(root_folder=resolved_root, pdf_paths=pdf_paths)
