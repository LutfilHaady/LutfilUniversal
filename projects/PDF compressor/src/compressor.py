from __future__ import annotations

import dataclasses
import os
import shutil
import subprocess
from pathlib import Path
from typing import Iterable

import fitz  # PyMuPDF


@dataclasses.dataclass(frozen=True)
class CompressionResult:
    input_path: Path
    output_path: Path
    used_method: str
    input_bytes: int
    output_bytes: int


class CompressionError(Exception):
    pass


_QUALITY_TO_GS_PDFSETTINGS: dict[str, str] = {
    "Smallest": "/screen",
    "Small": "/ebook",
    "Medium": "/printer",
    "High": "/prepress",
}


def compress_pdf(
    *,
    input_path: Path,
    output_path: Path,
    quality_preset: str,
) -> CompressionResult:
    if quality_preset not in _QUALITY_TO_GS_PDFSETTINGS:
        raise ValueError(
            f"Unknown quality preset '{quality_preset}'. "
            f"Expected one of: {', '.join(_QUALITY_TO_GS_PDFSETTINGS.keys())}"
        )

    input_path = input_path.resolve()
    output_path = output_path.resolve()

    if not input_path.exists():
        raise CompressionError(f"Input file not found: {input_path}")
    if input_path.suffix.lower() != ".pdf":
        raise CompressionError(f"Input is not a PDF: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    input_bytes = input_path.stat().st_size

    ghostscript_executable = _find_ghostscript_executable()
    if ghostscript_executable is not None:
        _compress_with_ghostscript(
            ghostscript_executable=ghostscript_executable,
            input_path=input_path,
            output_path=output_path,
            quality_preset=quality_preset,
        )
        output_bytes = output_path.stat().st_size
        return CompressionResult(
            input_path=input_path,
            output_path=output_path,
            used_method=f"ghostscript({_QUALITY_TO_GS_PDFSETTINGS[quality_preset]})",
            input_bytes=input_bytes,
            output_bytes=output_bytes,
        )

    _compress_with_pymupdf(
        input_path=input_path,
        output_path=output_path,
        quality_preset=quality_preset,
    )
    output_bytes = output_path.stat().st_size
    return CompressionResult(
        input_path=input_path,
        output_path=output_path,
        used_method="pymupdf(deflate)",
        input_bytes=input_bytes,
        output_bytes=output_bytes,
    )


def _find_ghostscript_executable() -> str | None:
    candidates: Iterable[str] = (
        "gswin64c",
        "gswin32c",
        "gs",
    )
    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    return None


def _compress_with_ghostscript(
    *,
    ghostscript_executable: str,
    input_path: Path,
    output_path: Path,
    quality_preset: str,
) -> None:
    pdfsettings = _QUALITY_TO_GS_PDFSETTINGS[quality_preset]

    arguments: list[str] = [
        ghostscript_executable,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={pdfsettings}",
        "-dNOPAUSE",
        "-dBATCH",
        "-dSAFER",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        "-dSubsetFonts=true",
        "-sColorConversionStrategy=LeaveColorUnchanged",
        "-dDownsampleColorImages=true",
        "-dDownsampleGrayImages=true",
        "-dDownsampleMonoImages=true",
        f"-sOutputFile={str(output_path)}",
        str(input_path),
    ]

    completed = subprocess.run(
        arguments,
        capture_output=True,
        text=True,
        check=False,
        env=_build_subprocess_env(),
        cwd=str(input_path.parent),
    )
    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip()
        stdout = (completed.stdout or "").strip()
        details = "\n".join(line for line in [stdout, stderr] if line)
        raise CompressionError(
            "Ghostscript compression failed"
            + (f":\n{details}" if details else ".")
        )


def _compress_with_pymupdf(
    *,
    input_path: Path,
    output_path: Path,
    quality_preset: str,
) -> None:
    """
    Pure-Python fallback compression.

    This primarily deflates streams and performs garbage collection. It does not
    aggressively downsample images like Ghostscript, but is reliable and keeps
    the app working even when Ghostscript isn't installed.
    """

    garbage_setting = 3
    if quality_preset == "Smallest":
        garbage_setting = 4

    document = fitz.open(str(input_path))
    try:
        document.save(
            str(output_path),
            garbage=garbage_setting,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
        )
    finally:
        document.close()


def _build_subprocess_env() -> dict[str, str]:
    env = dict(os.environ)
    env.setdefault("GS_OPTIONS", "")
    return env
