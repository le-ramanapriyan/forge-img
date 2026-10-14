(() => {
  "use strict";

  const F = window.ForgeIMG;

  const settingsHtml = `
    <div class="field">
      <span class="field-label">Resize mode</span>
      <div class="segmented" id="resizeModeTabs">
        <button type="button" class="mode-tab is-active" data-rmode="pixels">Pixels</button>
        <button type="button" class="mode-tab" data-rmode="percent">Percent</button>
      </div>
    </div>
    <div class="mode-panel is-active" data-panel="pixels">
      <div class="form-row">
        <div class="field">
          <label class="field-label" for="widthPx">Width (px)</label>
          <input id="widthPx" type="number" min="1" max="10000" value="1280" />
        </div>
        <div class="field">
          <label class="field-label" for="heightPx">Height (px)</label>
          <input id="heightPx" type="number" min="1" max="10000" value="720" />
        </div>
      </div>
      <label class="check-inline">
        <input id="lockAspect" type="checkbox" checked />
        <span>Lock aspect ratio</span>
      </label>
      <p class="field-help" id="pixelHelp">Height follows width. Each image keeps its own proportions. The height shown is for the first image.</p>
    </div>
    <div class="mode-panel" data-panel="percent">
      <label class="field-label" for="scalePct">Scale <strong id="scaleValue">100</strong>%</label>
      <input id="scalePct" type="range" min="1" max="400" value="100" />
      <p class="field-help">100% keeps the original size. Applied to both width and height.</p>
    </div>
    <div class="field">
      <span class="field-label">Output format</span>
      <div class="segmented" id="formatTabs">
        <button type="button" class="mode-tab is-active" data-format="image/webp">WebP</button>
        <button type="button" class="mode-tab" data-format="image/jpeg">JPEG</button>
        <button type="button" class="mode-tab" data-format="image/png">PNG</button>
      </div>
    </div>
  `;

  window.ForgeIMGToolShell.mount({
    title: "Resize images",
    convertLabel: "Resize images",
    settingsHtml,
    steps: { settings: "Set dimensions or a scale, then an output format." },
  });

  let rmode = "pixels";
  let format = "image/webp";
  let ratio = 1280 / 720;
  let seedToken = 0;
  const widthPx = document.getElementById("widthPx");
  const heightPx = document.getElementById("heightPx");
  const lockAspect = document.getElementById("lockAspect");
  const pixelHelp = document.getElementById("pixelHelp");

  function syncLock() {
    const locked = lockAspect.checked;
    heightPx.disabled = locked;
    pixelHelp.hidden = !locked;
    if (locked) {
      heightPx.value = String(Math.max(1, Math.round(Number(widthPx.value) / ratio)));
    }
  }

  widthPx.addEventListener("input", () => {
    widthPx.dataset.user = "1";
    if (lockAspect.checked) syncLock();
  });
  heightPx.addEventListener("input", () => {
    widthPx.dataset.user = "1";
    if (lockAspect.checked) return;
    const w = Number(widthPx.value);
    const h = Number(heightPx.value);
    if (w > 0 && h > 0) ratio = w / h;
  });
  lockAspect.addEventListener("change", syncLock);
  syncLock();

  document.getElementById("resizeModeTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-rmode]");
    if (!btn) return;
    rmode = btn.dataset.rmode;
    document.querySelectorAll("#resizeModeTabs .mode-tab").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
    });
    document.querySelectorAll(".mode-panel").forEach((p) => {
      p.classList.toggle(
        "is-active",
        p.dataset.panel === (rmode === "pixels" ? "pixels" : "percent")
      );
    });
  });

  document.getElementById("formatTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-format]");
    if (!btn) return;
    format = btn.dataset.format;
    document.querySelectorAll("#formatTabs .mode-tab").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
    });
  });

  document.getElementById("scalePct").addEventListener("input", (e) => {
    document.getElementById("scaleValue").textContent = e.target.value;
  });

  function extFor(mime) {
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/png") return "png";
    return "webp";
  }

  F.createToolApp({
    convertLabel: "Resize images",
    zipName: "forgeimg-resize.zip",
    onClear: () => {
      seedToken += 1;
      delete widthPx.dataset.user;
    },
    onFilesChanged: async (files) => {
      const token = ++seedToken;
      const imgFile = files.find((f) => F.isImageFile(f) && !F.isZipFile(f));
      if (!imgFile) return;
      try {
        const img = await F.loadImage(imgFile);
        if (token !== seedToken) return;
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return;
        ratio = w / h;
        if (widthPx.dataset.user !== "1") {
          widthPx.value = String(w);
          heightPx.value = String(h);
        } else if (lockAspect.checked) {
          syncLock();
        }
      } catch {
        /* keep the current numbers */
      }
    },
    async process(files, report) {
      if (!F.supportsFormat(format)) {
        throw new Error("This browser cannot encode the selected format.");
      }
      const lock = lockAspect.checked;
      const wIn = Math.max(1, Number(widthPx.value) || 1);
      const hIn = Math.max(1, Number(heightPx.value) || 1);
      const pct = Math.max(1, Number(document.getElementById("scalePct").value) || 100) / 100;
      const rows = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        report?.(i, files.length, file.name);
        try {
          const img = await F.loadImage(file);
          const srcW = img.naturalWidth || img.width;
          const srcH = img.naturalHeight || img.height;
          let tw;
          let th;
          if (rmode === "percent") {
            tw = Math.max(1, Math.round(srcW * pct));
            th = Math.max(1, Math.round(srcH * pct));
          } else if (lock) {
            tw = wIn;
            th = Math.max(1, Math.round((srcH / srcW) * wIn));
          } else {
            tw = wIn;
            th = hIn;
          }
          const canvas = F.canvasFromImage(img, tw, th);
          const quality = format === "image/png" ? undefined : 0.92;
          const blob = await F.canvasToBlob(canvas, format, quality);
          const url = URL.createObjectURL(blob);
          const saved = file.size - blob.size;
          rows.push({
            name: F.outName(file, extFor(format)),
            originalName: file.name,
            originalSize: file.size,
            outSize: blob.size,
            saved,
            savedPct: file.size ? (saved / file.size) * 100 : 0,
            detail: `${tw}×${th}`,
            meta: `${srcW}×${srcH} → ${tw}×${th}`,
            blob,
            url,
            ok: true,
          });
        } catch (err) {
          rows.push({
            name: F.outName(file, extFor(format)),
            originalName: file.name,
            originalSize: file.size,
            outSize: 0,
            saved: 0,
            ok: false,
            error: err.message || String(err),
          });
        }
      }
      const ok = rows.filter((r) => r.ok);
      return {
        rows,
        summary: `${ok.length}/${rows.length} resized · ${
          rmode === "percent" ? "by percent" : "by pixels"
        }`,
      };
    },
  });
})();
