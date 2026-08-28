from __future__ import annotations

import tkinter as tk


def _create_root() -> tk.Tk:
    """
    Prefer a TkinterDnD root when available so folder drag-drop can work.
    """
    try:
        from tkinterdnd2 import TkinterDnD  # type: ignore

        return TkinterDnD.Tk()  # type: ignore[no-any-return]
    except Exception:
        return tk.Tk()


def main() -> None:
    from src.ui import run_app

    run_app(create_root=_create_root)


if __name__ == "__main__":
    main()

