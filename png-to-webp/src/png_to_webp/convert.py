"""PNG → WebP conversion with hard size budgets."""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image

from .backends import encode_webp


def human_kb(n: int) -> str:
    return f"{n / 1024:.1f}KB"


def encode_png(img: Image.Image, compress_level: int = 9) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True, compress_level=compress_level)
    return buf.getvalue()


def fit_png(img: Image.Image, max_bytes: int) -> bytes:
    data = encode_png(img, compress_level=9)
    if len(data) <= max_bytes:
        return data
    quantized = img.convert("RGBA").quantize(
        colors=256, method=Image.Quantize.MEDIANCUT
    )
    data = encode_png(quantized.convert("RGBA"), compress_level=9)
    if len(data) <= max_bytes:
        return data
    raise ValueError(
        f"PNG cannot fit under {human_kb(max_bytes)} (got {human_kb(len(data))})"
    )


def fit_webp_lossy(
    img: Image.Image, max_bytes: int, start_quality: int
) -> tuple[bytes, int, str]:
    """Return (data, quality_used, backend). Raises ValueError if impossible."""
    lo, hi = 1, max(1, min(100, start_quality))
    best: tuple[bytes, int, str] | None = None

    while lo <= hi:
        q = (lo + hi) // 2
        data, backend = encode_webp(img, quality=q, lossless=False)
        if len(data) <= max_bytes:
            best = (data, q, backend)
            lo = q + 1
        else:
            hi = q - 1

    if best is None:
        data, backend = encode_webp(img, quality=1, lossless=False)
        if len(data) <= max_bytes:
            return data, 1, backend
        raise ValueError(
            f"cannot fit under {human_kb(max_bytes)} even at quality 1 "
            f"(got {human_kb(len(data))})"
        )
    return best


def fit_webp(
    img: Image.Image,
    max_bytes: int,
    start_quality: int,
    *,
    lossless_try: bool,
) -> tuple[bytes, int | str, str, str]:
    """Return (data, quality_or_mode, backend, mode).

    quality_or_mode is int for lossy, or 'lossless' for lossless.
    mode is 'lossless' or 'lossy'.
    """
    if lossless_try:
        data, backend = encode_webp(img, quality=100, lossless=True)
        if len(data) <= max_bytes:
            return data, "lossless", backend, "lossless"

    data, quality, backend = fit_webp_lossy(img, max_bytes, start_quality)
    return data, quality, backend, "lossy"


def collect_inputs(path: Path) -> list[Path]:
    if path.is_file():
        if path.suffix.lower() != ".png":
            raise SystemExit(f"not a PNG: {path}")
        return [path]
    if path.is_dir():
        files = sorted(path.glob("*.png")) + sorted(path.glob("*.PNG"))
        seen: set[str] = set()
        out: list[Path] = []
        for f in files:
            key = f.name.lower()
            if key not in seen:
                seen.add(key)
                out.append(f)
        if not out:
            raise SystemExit(f"no PNGs in {path}")
        return out
    raise SystemExit(f"input not found: {path}")


def process_one(
    src: Path,
    dest: Path,
    *,
    webp_max: int,
    png_max: int,
    start_quality: int,
    lossless_try: bool,
    dry_run: bool,
) -> dict:
    img = Image.open(src).convert("RGBA")
    src_size = src.stat().st_size
    result: dict = {
        "file": dest.name,
        "src": str(src),
        "dest": str(dest),
        "dims": f"{img.size[0]}x{img.size[1]}",
        "png_size": src_size,
        "webp_size": None,
        "quality": None,
        "mode": None,
        "backend": None,
        "png_optimized": False,
        "ok": True,
        "error": None,
        "warning": None,
    }

    try:
        if src_size > png_max:
            png_data = fit_png(img, png_max)
            result["png_size"] = len(png_data)
            result["png_optimized"] = True
            if not dry_run:
                src.write_bytes(png_data)
                img = Image.open(src).convert("RGBA")

        webp_data, quality, backend, mode = fit_webp(
            img,
            webp_max,
            start_quality,
            lossless_try=lossless_try,
        )
        result["webp_size"] = len(webp_data)
        result["quality"] = quality
        result["mode"] = mode
        result["backend"] = backend
        if not dry_run:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(webp_data)
    except Exception as e:  # noqa: BLE001 — report per-file
        result["ok"] = False
        result["error"] = str(e)

    return result
