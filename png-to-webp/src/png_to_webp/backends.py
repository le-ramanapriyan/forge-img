"""WebP encode backends: cwebp (preferred) with Pillow fallback."""

from __future__ import annotations

import io
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

_cwebp_status: bool | None = None


def cwebp_available() -> bool:
    """Return True if a working cwebp binary is on PATH."""
    global _cwebp_status
    if _cwebp_status is not None:
        return _cwebp_status
    path = shutil.which("cwebp")
    if not path:
        _cwebp_status = False
        return False
    try:
        # -version fails on broken Homebrew dylibs (e.g. missing libtiff).
        r = subprocess.run(
            [path, "-version"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        _cwebp_status = r.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        _cwebp_status = False
    return _cwebp_status


def encode_webp_pillow(img: Image.Image, *, quality: int, lossless: bool) -> bytes:
    buf = io.BytesIO()
    if lossless:
        img.save(buf, format="WEBP", lossless=True, method=6)
    else:
        img.save(buf, format="WEBP", quality=quality, method=6)
    return buf.getvalue()


def encode_webp_cwebp(
    img: Image.Image, *, quality: int, lossless: bool, method: int = 6
) -> bytes:
    cwebp = shutil.which("cwebp")
    if not cwebp:
        raise RuntimeError("cwebp not found")

    with tempfile.TemporaryDirectory(prefix="png2webp-") as tmp:
        tmp_path = Path(tmp)
        src = tmp_path / "in.png"
        dest = tmp_path / "out.webp"
        img.save(src, format="PNG")

        cmd = [cwebp, "-quiet", "-m", str(method)]
        if lossless:
            cmd += ["-lossless", "-q", "100"]
        else:
            cmd += ["-q", str(quality)]
        cmd += [str(src), "-o", str(dest)]

        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120, check=False)
        if r.returncode != 0 or not dest.is_file():
            err = (r.stderr or r.stdout or "unknown cwebp error").strip()
            raise RuntimeError(f"cwebp failed: {err}")
        return dest.read_bytes()


def encode_webp(
    img: Image.Image, *, quality: int, lossless: bool = False
) -> tuple[bytes, str]:
    """Encode WebP. Returns (data, backend_name)."""
    if cwebp_available():
        try:
            return encode_webp_cwebp(img, quality=quality, lossless=lossless), "cwebp"
        except RuntimeError:
            pass
    return encode_webp_pillow(img, quality=quality, lossless=lossless), "pillow"
