# png-to-webp

Browser + CLI tool to convert images to WebP.

**Author:** RAMANAPRIYAN M R V ([le-ramanapriyan](https://github.com/le-ramanapriyan))

Private repo: [le-ramanapriyan/private-repo](https://github.com/le-ramanapriyan/private-repo)

## Web app (GitHub Pages)

HTML / CSS / JS compressor — runs in your browser. Files never upload to a server.

**Live path (after Pages is enabled on this private repo):**  
https://le-ramanapriyan.github.io/private-repo/png-to-webp/

### Features

- Drop **files** or choose a **folder**
- Compression types:
  - **Preset** — High (~92%) / Medium (~75%) / Low (~50%)
  - **Percentage** — quality slider 1–100%
  - **Size based** — target max KB (binary-searches highest quality that fits)
- Download one file or **all as ZIP**
- Keeps original dimensions; alpha preserved when the browser supports it

### Enable GitHub Pages

1. Open [repo Settings → Pages](https://github.com/le-ramanapriyan/private-repo/settings/pages)
2. Source: **Deploy from a branch**
3. Branch: `main` → folder `/ (root)` → Save
4. Wait a minute, then open:  
   `https://le-ramanapriyan.github.io/private-repo/png-to-webp/`

### Local preview

```bash
cd png-to-webp
python3 -m http.server 8080
# open http://localhost:8080
```

---

## CLI (optional, Python)

Hard budgets: WebP ≤ 100 KB, PNG ≤ 150 KB.

```bash
cd png-to-webp
python3 -m pip install -e .
png2webp --input ./hero.png --output ./hero.webp
# or
python3 -m png_to_webp.cli --input ./pngs --outdir ./webps
```

Prefers `cwebp` when available; otherwise Pillow. See `src/png_to_webp/`.

## License

MIT — see [LICENSE](LICENSE).
