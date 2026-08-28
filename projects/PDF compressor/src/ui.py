from __future__ import annotations

import queue
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from .compressor import CompressionError, CompressionResult, compress_pdf
from .discovery import DiscoveryResult, discover_pdfs


QualityPreset = Literal["Smallest", "Small", "Medium", "High"]
InputMode = Literal["files", "folder"]


@dataclass(frozen=True)
class UiConfig:
    quality_presets: tuple[QualityPreset, ...] = ("Smallest", "Small", "Medium", "High")


@dataclass(frozen=True)
class BatchSettings:
    input_mode: InputMode
    root_folder: Path | None
    input_files: tuple[Path, ...]
    quality_preset: QualityPreset


class PdfCompressorApp:
    def __init__(self, root: tk.Tk, config: UiConfig) -> None:
        self._root = root
        self._config = config

        self._status_queue: queue.Queue[tuple[str, object]] = queue.Queue()
        self._worker_thread: threading.Thread | None = None

        self._input_mode = tk.StringVar(value="files")
        self._selected_folder = tk.StringVar(value="")
        self._selected_files: list[Path] = []
        self._output_mode = tk.StringVar(value="subfolder")  # subfolder | sibling
        self._quality_preset = tk.StringVar(value="Small")

        self._progress_value = tk.IntVar(value=0)
        self._progress_max = tk.IntVar(value=100)

        self._build_ui()
        self._try_enable_drag_drop()

        self._root.after(100, self._process_queue)

    def _build_ui(self) -> None:
        self._root.title("Local PDF Compressor")
        self._root.minsize(820, 520)

        main_frame = ttk.Frame(self._root, padding=12)
        main_frame.pack(fill=tk.BOTH, expand=True)

        input_frame = ttk.LabelFrame(main_frame, text="Input", padding=10)
        input_frame.pack(fill=tk.X)

        mode_row = ttk.Frame(input_frame)
        mode_row.pack(fill=tk.X)

        ttk.Label(mode_row, text="Mode:").pack(side=tk.LEFT)
        ttk.Radiobutton(
            mode_row, text="PDF files", value="files", variable=self._input_mode, command=self._sync_input_mode_ui
        ).pack(side=tk.LEFT, padx=(8, 12))
        ttk.Radiobutton(
            mode_row, text="Folder", value="folder", variable=self._input_mode, command=self._sync_input_mode_ui
        ).pack(side=tk.LEFT)

        self._files_frame = ttk.Frame(input_frame)
        self._files_frame.pack(fill=tk.X, pady=(10, 0))

        files_row = ttk.Frame(self._files_frame)
        files_row.pack(fill=tk.X)

        ttk.Label(files_row, text="PDFs:").pack(side=tk.LEFT)

        self._files_entry = ttk.Entry(self._files_frame, state="readonly")
        self._files_entry.pack(fill=tk.X, padx=(0, 0), pady=(6, 0))

        files_buttons = ttk.Frame(self._files_frame)
        files_buttons.pack(fill=tk.X, pady=(6, 0))

        ttk.Button(files_buttons, text="Add PDFs…", command=self._add_files).pack(side=tk.LEFT)
        ttk.Button(files_buttons, text="Clear", command=self._clear_files).pack(side=tk.LEFT, padx=(8, 0))

        self._folder_frame = ttk.Frame(input_frame)
        self._folder_frame.pack(fill=tk.X, pady=(10, 0))

        folder_row = ttk.Frame(self._folder_frame)
        folder_row.pack(fill=tk.X)

        ttk.Label(folder_row, text="Folder:").pack(side=tk.LEFT)
        self._folder_entry = ttk.Entry(
            folder_row, textvariable=self._selected_folder, state="readonly"
        )
        self._folder_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(8, 8))

        ttk.Button(folder_row, text="Select folder…", command=self._select_folder).pack(side=tk.LEFT)

        self._drop_hint = ttk.Label(
            input_frame,
            text="Tip: Drag-and-drop PDF files (or a folder) into the input field, if drag-drop is available.",
            foreground="#666666",
        )
        self._drop_hint.pack(anchor="w", pady=(8, 0))

        options_frame = ttk.LabelFrame(main_frame, text="Options", padding=10)
        options_frame.pack(fill=tk.X, pady=(12, 0))

        options_row = ttk.Frame(options_frame)
        options_row.pack(fill=tk.X)

        ttk.Label(options_row, text="Quality / Size:").pack(side=tk.LEFT)
        self._quality_combo = ttk.Combobox(
            options_row,
            state="readonly",
            values=list(self._config.quality_presets),
            textvariable=self._quality_preset,
            width=12,
        )
        self._quality_combo.pack(side=tk.LEFT, padx=(8, 18))

        ttk.Label(options_row, text="Output:").pack(side=tk.LEFT)
        ttk.Radiobutton(
            options_row,
            text="Create 'Compressed' subfolder",
            value="subfolder",
            variable=self._output_mode,
        ).pack(side=tk.LEFT, padx=(8, 10))
        ttk.Radiobutton(
            options_row,
            text="Create sibling folder '<name>_compressed'",
            value="sibling",
            variable=self._output_mode,
        ).pack(side=tk.LEFT)

        action_frame = ttk.Frame(main_frame)
        action_frame.pack(fill=tk.X, pady=(12, 0))

        self._compress_button = ttk.Button(
            action_frame, text="Compress PDFs", command=self._on_compress_clicked
        )
        self._compress_button.pack(side=tk.LEFT)

        self._cancel_button = ttk.Button(
            action_frame, text="Cancel", command=self._on_cancel_clicked, state="disabled"
        )
        self._cancel_button.pack(side=tk.LEFT, padx=(10, 0))

        progress_frame = ttk.Frame(main_frame)
        progress_frame.pack(fill=tk.X, pady=(10, 0))

        self._progress_bar = ttk.Progressbar(
            progress_frame,
            maximum=100,
            variable=self._progress_value,
            mode="determinate",
        )
        self._progress_bar.pack(fill=tk.X)

        self._progress_label = ttk.Label(progress_frame, text="Idle")
        self._progress_label.pack(anchor="w", pady=(6, 0))

        log_frame = ttk.LabelFrame(main_frame, text="Log", padding=10)
        log_frame.pack(fill=tk.BOTH, expand=True, pady=(12, 0))

        self._log_text = tk.Text(log_frame, height=14, wrap="word")
        self._log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        scrollbar = ttk.Scrollbar(log_frame, command=self._log_text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self._log_text.configure(yscrollcommand=scrollbar.set)

        self._log_text.configure(state="disabled")
        self._sync_input_mode_ui()

    def _try_enable_drag_drop(self) -> None:
        try:
            from tkinterdnd2 import DND_FILES, TkinterDnD  # type: ignore
        except Exception:
            self._drop_hint.configure(
                text="Drag-and-drop is not enabled (optional dependency). Use “Select folder…”."
            )
            return

        current_root = self._root
        if not isinstance(current_root, TkinterDnD.Tk):  # type: ignore[attr-defined]
            self._drop_hint.configure(
                text="Drag-and-drop requires a TkinterDnD root. Use “Select folder…”."
            )
            return

        def handle_drop(event: object) -> None:
            dropped = getattr(event, "data", "")
            if not dropped:
                return

            paths = self._parse_dnd_paths(str(dropped))
            if not paths:
                return

            mode = self._input_mode.get()
            if mode == "folder":
                folder_candidate = next((p for p in paths if p.exists() and p.is_dir()), None)
                if folder_candidate is not None:
                    self._selected_folder.set(str(folder_candidate.resolve()))
                    self._append_log(f"Selected folder (drop): {folder_candidate.resolve()}")
                else:
                    self._append_log("Ignored drop: no folder detected.")
                return

            # files mode
            added = 0
            for p in paths:
                if p.exists() and p.is_file() and p.suffix.lower() == ".pdf":
                    self._add_file_path(p)
                    added += 1
            self._sync_files_entry()
            if added:
                self._append_log(f"Added {added} PDF(s) via drag-drop.")
            else:
                self._append_log("Ignored drop: no PDF files detected.")

        self._folder_entry.drop_target_register(DND_FILES)  # type: ignore[attr-defined]
        self._folder_entry.dnd_bind("<<Drop>>", handle_drop)  # type: ignore[attr-defined]
        self._files_entry.drop_target_register(DND_FILES)  # type: ignore[attr-defined]
        self._files_entry.dnd_bind("<<Drop>>", handle_drop)  # type: ignore[attr-defined]
        self._drop_hint.configure(
            text="Drag-and-drop enabled: drop PDFs in “PDF files” mode or a folder in “Folder” mode."
        )

    @staticmethod
    def _parse_dnd_paths(raw: str) -> list[Path]:
        text = raw.strip()
        if not text:
            return []

        # TkDND often uses a brace-wrapped list: {C:\path one} {C:\path two}
        if "}" in text and "{" in text:
            paths: list[str] = []
            current = ""
            in_brace = False
            for char in text:
                if char == "{":
                    in_brace = True
                    current = ""
                    continue
                if char == "}":
                    in_brace = False
                    if current:
                        paths.append(current)
                    current = ""
                    continue
                if in_brace:
                    current += char
            if paths:
                return [Path(p) for p in paths]

        # Fallback: split by whitespace
        return [Path(part) for part in text.split()]

    def _select_folder(self) -> None:
        selected = filedialog.askdirectory(title="Select a folder containing PDFs")
        if not selected:
            return
        self._selected_folder.set(str(Path(selected).resolve()))
        self._append_log(f"Selected folder: {Path(selected).resolve()}")

    def _add_files(self) -> None:
        selected = filedialog.askopenfilenames(
            title="Select PDF files",
            filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")],
        )
        if not selected:
            return
        for file_path in selected:
            self._add_file_path(Path(file_path))
        self._sync_files_entry()
        self._append_log(f"Selected {len(selected)} PDF(s).")

    def _add_file_path(self, path: Path) -> None:
        resolved = path.resolve()
        if resolved.suffix.lower() != ".pdf":
            return
        if resolved not in self._selected_files:
            self._selected_files.append(resolved)
            self._selected_files.sort(key=lambda p: str(p).lower())

    def _clear_files(self) -> None:
        self._selected_files.clear()
        self._sync_files_entry()

    def _sync_files_entry(self) -> None:
        if not self._selected_files:
            summary = ""
        elif len(self._selected_files) == 1:
            summary = str(self._selected_files[0])
        else:
            summary = f"{len(self._selected_files)} PDF(s) selected"

        self._files_entry.configure(state="normal")
        self._files_entry.delete(0, "end")
        self._files_entry.insert(0, summary)
        self._files_entry.configure(state="readonly")

    def _sync_input_mode_ui(self) -> None:
        mode = self._input_mode.get()
        if mode == "folder":
            self._files_frame.pack_forget()
            self._folder_frame.pack(fill=tk.X, pady=(10, 0))
        else:
            self._folder_frame.pack_forget()
            self._files_frame.pack(fill=tk.X, pady=(10, 0))

    def _on_compress_clicked(self) -> None:
        if self._worker_thread is not None and self._worker_thread.is_alive():
            messagebox.showinfo("Busy", "Compression is already running.")
            return

        mode = self._input_mode.get()
        root_folder: Path | None = None
        input_files: tuple[Path, ...] = ()
        if mode == "folder":
            selected_folder = self._selected_folder.get().strip()
            if not selected_folder:
                messagebox.showwarning("Select a folder", "Please select a folder first.")
                return

            root_folder = Path(selected_folder)
            if not root_folder.exists() or not root_folder.is_dir():
                messagebox.showerror("Invalid folder", f"Not a folder:\n{root_folder}")
                return
        else:
            if not self._selected_files:
                messagebox.showwarning("Select PDFs", "Please add at least one PDF file.")
                return
            input_files = tuple(self._selected_files)

        quality_preset = self._quality_preset.get()
        if quality_preset not in self._config.quality_presets:
            messagebox.showerror("Invalid preset", f"Unknown preset: {quality_preset}")
            return

        settings = BatchSettings(
            input_mode=mode,  # type: ignore[arg-type]
            root_folder=root_folder,
            input_files=input_files,
            quality_preset=quality_preset,  # type: ignore[arg-type]
        )

        self._set_running_state(is_running=True)
        self._clear_log()
        if settings.input_mode == "folder":
            assert settings.root_folder is not None
            output_folder = self._compute_output_folder(settings.root_folder)
            self._append_log(f"Input folder: {settings.root_folder.resolve()}")
            self._append_log(f"Output folder: {output_folder.resolve()}")
        else:
            self._append_log(f"Selected files: {len(settings.input_files)}")
        self._append_log(f"Quality preset: {settings.quality_preset}")
        self._append_log("")

        self._worker_thread = threading.Thread(
            target=self._run_batch, args=(settings,), daemon=True
        )
        self._worker_thread.start()

    def _on_cancel_clicked(self) -> None:
        messagebox.showinfo(
            "Cancel",
            "Cancel is not implemented in v1.\n\n"
            "You can close the app to stop processing.",
        )

    def _compute_output_folder(self, root_folder: Path) -> Path:
        mode = self._output_mode.get()
        resolved = root_folder.resolve()
        if mode == "subfolder":
            return resolved / "Compressed"
        if mode == "sibling":
            return resolved.parent / f"{resolved.name}_compressed"
        return resolved / "Compressed"

    def _compute_output_path_for_file(self, input_file: Path) -> Path:
        parent = input_file.parent.resolve()
        mode = self._output_mode.get()
        if mode == "subfolder":
            return (parent / "Compressed" / input_file.name).resolve()
        sibling_folder = parent.parent / f"{parent.name}_compressed"
        return (sibling_folder / input_file.name).resolve()

    def _run_batch(self, settings: BatchSettings) -> None:
        try:
            if settings.input_mode == "folder":
                assert settings.root_folder is not None
                discovery_result = discover_pdfs(settings.root_folder)
                self._status_queue.put(("discovery", discovery_result))

                if not discovery_result.pdf_paths:
                    self._status_queue.put(("done_no_files", None))
                    return

                output_folder = self._compute_output_folder(settings.root_folder)
                total = len(discovery_result.pdf_paths)
                for index, input_path in enumerate(discovery_result.pdf_paths, start=1):
                    relative_path = input_path.relative_to(discovery_result.root_folder)
                    output_path = output_folder / relative_path
                    output_path.parent.mkdir(parents=True, exist_ok=True)

                    try:
                        result = compress_pdf(
                            input_path=input_path,
                            output_path=output_path,
                            quality_preset=settings.quality_preset,
                        )
                        self._status_queue.put(("file_ok", (index, total, result)))
                    except CompressionError as error:
                        self._status_queue.put(
                            ("file_error", (index, total, input_path, str(error)))
                        )
                    except Exception as error:  # noqa: BLE001
                        self._status_queue.put(
                            ("file_error", (index, total, input_path, repr(error)))
                        )

                self._status_queue.put(("done", None))
                return

            # files mode
            files = [p for p in settings.input_files if p.exists() and p.is_file()]
            self._status_queue.put(("files_selected", len(files)))
            if not files:
                self._status_queue.put(("done_no_files", None))
                return

            total = len(files)
            for index, input_path in enumerate(files, start=1):
                output_path = self._compute_output_path_for_file(input_path)
                output_path.parent.mkdir(parents=True, exist_ok=True)

                try:
                    result = compress_pdf(
                        input_path=input_path,
                        output_path=output_path,
                        quality_preset=settings.quality_preset,
                    )
                    self._status_queue.put(("file_ok", (index, total, result)))
                except CompressionError as error:
                    self._status_queue.put(
                        ("file_error", (index, total, input_path, str(error)))
                    )
                except Exception as error:  # noqa: BLE001
                    self._status_queue.put(
                        ("file_error", (index, total, input_path, repr(error)))
                    )

            self._status_queue.put(("done", None))
        except Exception as error:  # noqa: BLE001
            self._status_queue.put(("fatal", repr(error)))

    def _process_queue(self) -> None:
        try:
            while True:
                event_type, payload = self._status_queue.get_nowait()
                self._handle_event(event_type, payload)
        except queue.Empty:
            pass
        self._root.after(100, self._process_queue)

    def _handle_event(self, event_type: str, payload: object) -> None:
        if event_type == "discovery":
            discovery_result = payload  # type: ignore[assignment]
            assert isinstance(discovery_result, DiscoveryResult)
            count = len(discovery_result.pdf_paths)
            self._set_progress(total=max(count, 1), current=0)
            self._progress_label.configure(text=f"Found {count} PDF(s).")
            self._append_log(f"Found {count} PDF(s).")
            return

        if event_type == "files_selected":
            count = int(payload) if payload is not None else 0
            self._set_progress(total=max(count, 1), current=0)
            self._progress_label.configure(text=f"{count} PDF(s) selected.")
            self._append_log(f"{count} PDF(s) selected.")
            return

        if event_type == "file_ok":
            index, total, result = payload  # type: ignore[misc]
            assert isinstance(index, int)
            assert isinstance(total, int)
            assert isinstance(result, CompressionResult)
            self._set_progress(total=total, current=index)
            self._progress_label.configure(text=f"Compressing {index}/{total}…")
            self._append_log(
                f"[{index}/{total}] OK: {result.input_path.name} "
                f"({self._format_bytes(result.input_bytes)} -> {self._format_bytes(result.output_bytes)}) "
                f"via {result.used_method}"
            )
            return

        if event_type == "file_error":
            index, total, input_path, error_message = payload  # type: ignore[misc]
            assert isinstance(index, int)
            assert isinstance(total, int)
            assert isinstance(input_path, Path)
            assert isinstance(error_message, str)
            self._set_progress(total=total, current=index)
            self._progress_label.configure(text=f"Compressing {index}/{total}…")
            self._append_log(f"[{index}/{total}] ERROR: {input_path.name}: {error_message}")
            return

        if event_type == "done_no_files":
            self._progress_label.configure(text="No PDFs found.")
            self._append_log("No PDFs found in the selected folder.")
            self._set_running_state(is_running=False)
            return

        if event_type == "done":
            self._progress_label.configure(text="Done.")
            self._append_log("")
            self._append_log("Done.")
            self._set_running_state(is_running=False)
            return

        if event_type == "fatal":
            self._append_log(f"Fatal error: {payload}")
            messagebox.showerror("Fatal error", str(payload))
            self._set_running_state(is_running=False)
            return

    def _set_running_state(self, *, is_running: bool) -> None:
        if is_running:
            self._compress_button.configure(state="disabled")
            self._cancel_button.configure(state="normal")
        else:
            self._compress_button.configure(state="normal")
            self._cancel_button.configure(state="disabled")
            self._set_progress(total=1, current=0)

    def _set_progress(self, *, total: int, current: int) -> None:
        safe_total = max(int(total), 1)
        safe_current = max(min(int(current), safe_total), 0)
        self._progress_bar.configure(maximum=safe_total)
        self._progress_value.set(safe_current)

    def _append_log(self, message: str) -> None:
        self._log_text.configure(state="normal")
        self._log_text.insert("end", message + "\n")
        self._log_text.see("end")
        self._log_text.configure(state="disabled")

    def _clear_log(self) -> None:
        self._log_text.configure(state="normal")
        self._log_text.delete("1.0", "end")
        self._log_text.configure(state="disabled")

    @staticmethod
    def _format_bytes(num_bytes: int) -> str:
        value = float(num_bytes)
        for unit in ["B", "KB", "MB", "GB"]:
            if value < 1024.0 or unit == "GB":
                if unit == "B":
                    return f"{int(value)} {unit}"
                return f"{value:.2f} {unit}"
            value /= 1024.0
        return f"{num_bytes} B"


def run_app(
    *,
    create_root: Callable[[], tk.Tk],
) -> None:
    root = create_root()
    style = ttk.Style(root)
    if "vista" in style.theme_names():
        style.theme_use("vista")
    elif "clam" in style.theme_names():
        style.theme_use("clam")

    app = PdfCompressorApp(root, UiConfig())
    _ = app
    root.mainloop()

