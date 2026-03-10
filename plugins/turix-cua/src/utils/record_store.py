from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Optional

from PIL import Image


class RecordStore:
    def __init__(self, base_dir: str | Path, encoding: str = "utf-8", max_name_len: int = 80) -> None:
        self.base_dir = Path(base_dir)
        self.encoding = encoding or "utf-8"
        self.max_name_len = max_name_len

    def save(self, text: str, file_name: str, screenshot: Optional[Image.Image] = None, step: Optional[int] = None) -> str:
        self.base_dir.mkdir(parents=True, exist_ok=True)
        safe_name = self._sanitize_filename(file_name)
        if not safe_name:
            step_label = step if step is not None else "unknown"
            safe_name = f"record_step_{step_label}.txt"
        text_path = self._ensure_unique_path(self.base_dir / safe_name)
        text_path.write_text(text or "", encoding=self.encoding)
        if screenshot:
            screenshot.save(text_path.with_suffix(".png"))
        return text_path.name

    def read_files(self, file_names: list[str]) -> str:
        if not file_names:
            return "No files requested."
        base_dir = self.base_dir.resolve()
        contents = []
        for raw_name in file_names:
            name = (raw_name or "").strip()
            if not name:
                continue
            candidates = [name]
            if not name.lower().endswith(".txt"):
                candidates.append(f"{name}.txt")
            file_path = None
            for candidate in candidates:
                candidate_path = (self.base_dir / candidate).resolve()
                try:
                    candidate_path.relative_to(base_dir)
                except ValueError:
                    continue
                if candidate_path.exists():
                    file_path = candidate_path
                    break
            if not file_path:
                contents.append(f"FILE: {name}\n[Not found]")
                continue
            try:
                text = file_path.read_text(encoding=self.encoding)
            except Exception as e:
                contents.append(f"FILE: {file_path.name}\n[Read error: {e}]")
                continue
            contents.append(f"FILE: {file_path.name}\n{text}")
        if not contents:
            return "No valid files requested."
        return "\n\n".join(contents)

    def _sanitize_filename(self, file_name: str) -> str:
        cleaned = (file_name or "").strip()
        if not cleaned:
            return ""
        for sep in [os.path.sep, os.path.altsep]:
            if sep:
                cleaned = cleaned.replace(sep, "_")
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", cleaned)
        cleaned = cleaned.strip("._-")
        if cleaned and not cleaned.lower().endswith(".txt"):
            cleaned += ".txt"
        return cleaned[: self.max_name_len]

    def _ensure_unique_path(self, path: Path) -> Path:
        if not path.exists():
            return path
        stem = path.stem
        suffix = path.suffix
        for i in range(1, 1000):
            candidate = path.with_name(f"{stem}_{i}{suffix}")
            if not candidate.exists():
                return candidate
        return path
