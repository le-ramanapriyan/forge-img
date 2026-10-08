"""CLI entry point for png2webp."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from .backends import cwebp_available
from .convert import collect_inputs, human_kb, process_one


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="png2webp",
        description=(
            "Convert PNG → WebP with hard size budgets "
            "(default WebP ≤100KB, PNG ≤150KB)."
        ),
    )
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    p.add_argument("--input", required=True, help="PNG file or folder of PNGs")
    p.add_argument("--output", help="Destination .webp (single-file mode)")
    p.add_argument("--outdir", help="Output directory (batch mode)")
    p.add_argument("--webp-max-kb", type=float, default=100.0)
    p.add_argument("--png-max-kb", type=float, default=150.0)
    p.add_argument("--start-quality", type=int, default=100)
    p.add_argument(
        "--lossless-try",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Try lossless WebP first if it fits under budget (default: on)",
    )
    p.add_argument("--dry-run", action="store_true", help="Report only; write nothing")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    src_path = Path(args.input).expanduser().resolve()
    inputs = collect_inputs(src_path)
    webp_max = int(args.webp_max_kb * 1024)
    png_max = int(args.png_max_kb * 1024)

    if len(inputs) == 1 and args.output:
        dests = [Path(args.output).expanduser().resolve()]
    elif args.outdir:
        outdir = Path(args.outdir).expanduser().resolve()
        dests = [outdir / (src.stem + ".webp") for src in inputs]
    elif len(inputs) == 1:
        dests = [inputs[0].with_suffix(".webp")]
    else:
        print("batch mode requires --outdir", file=sys.stderr)
        return 2

    backend_hint = "cwebp" if cwebp_available() else "pillow"
    print(
        f"png2webp {__version__} | budgets: WebP ≤ {human_kb(webp_max)}, "
        f"PNG ≤ {human_kb(png_max)} | start quality {args.start_quality} | "
        f"backend prefer {backend_hint} | lossless-try "
        f"{'on' if args.lossless_try else 'off'}"
        + (" | DRY RUN" if args.dry_run else "")
    )
    print(
        f"{'File':<36} {'PNG':>8} {'WebP':>8} {'Quality':>10} "
        f"{'Mode':>8} {'Backend':>8} {'Dims':>10} Status"
    )
    print("-" * 110)

    failed = 0
    for src, dest in zip(inputs, dests):
        r = process_one(
            src,
            dest,
            webp_max=webp_max,
            png_max=png_max,
            start_quality=args.start_quality,
            lossless_try=args.lossless_try,
            dry_run=args.dry_run,
        )
        png_s = human_kb(r["png_size"])
        webp_s = human_kb(r["webp_size"]) if r["webp_size"] is not None else "-"
        q = str(r["quality"]) if r["quality"] is not None else "-"
        mode = r["mode"] or "-"
        backend = r["backend"] or "-"
        status = "OK" if r["ok"] else f"FAIL: {r['error']}"
        if r["png_optimized"]:
            status += " (png optimized)"
        if not r["ok"]:
            failed += 1
        print(
            f"{r['file']:<36} {png_s:>8} {webp_s:>8} {q:>10} "
            f"{mode:>8} {backend:>8} {r['dims']:>10} {status}"
        )

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
