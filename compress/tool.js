(() => {
  "use strict";

  const F = window.ForgeIMG;

  const settingsHtml = `
    <div class="field">
      <span class="field-label">Output format</span>
      <div class="segmented" id="formatTabs">
        <button type="button" class="mode-tab is-active" data-format="image/webp">WebP</button>
        <button type="button" class="mode-tab" data-format="image/jpeg">JPEG</button>
        <button type="button" class="mode-tab" data-format="image/png">PNG</button>
      </div>
    </div>
    <div id="lossyControls">
      <div class="field">
        <span class="field-label">Compression</span>
        <div class="segmented" id="modeTabs">
          <button type="button" class="mode-tab is-active" data-mode="preset">Preset</button>
          <button type="button" class="mode-tab" data-mode="quality">Percentage</button>
          <button type="button" class="mode-tab" data-mode="size">Size</button>
        </div>
      </div>
      <div class="mode-panel is-active" data-panel="preset">
        <span class="field-label">Quality preset</span>
        <div class="preset-row">
          <label class="chip"><input type="radio" name="preset" value="high" checked /><span>High</span><small>92%</small></label>
          <label class="chip"><input type="radio" name="preset" value="medium" /><span>Medium</span><small>75%</small></label>
          <label class="chip"><input type="radio" name="preset" value="low" /><span>Low</span><small>50%</small></label>
        </div>
      </div>
      <div class="mode-panel" data-panel="quality">
        <label class="field-label" for="qualityRange">Quality <strong id="qualityValue">80</strong>%</label>
        <input id="qualityRange" type="range" min="1" max="100" value="80" />
      </div>
      <div class="mode-panel" data-panel="size">
        <label class="field-label" for="sizeTarget">Max file size (KB)</label>
        <input id="sizeTarget" type="number" min="1" max="5000" value="100" step="1" />
        <p class="field-help">Uses the highest quality that still fits under this limit. Width and height do not change.</p>
      </div>
    </div>
    <p class="field-help" id="pngNote" hidden>
      PNG is lossless, so quality and size targets do not apply. Dimensions stay the same.
    </p>
  `;

  window.ForgeIMGToolShell.mount({
    title: "Compress images",
    convertLabel: "Compress",
    settingsHtml,
  });

  let format = "image/webp";
  let mode = "preset";
  const lossyControls = document.getElementById("lossyControls");
  const pngNote = document.getElementById("pngNote");

  function syncFormatUi() {
    const isPng = format === "image/png";
    lossyControls.hidden = isPng;
    pngNote.hidden = !isPng;
  }

  document.getElementById("formatTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-format]");
    if (!btn) return;
    format = btn.dataset.format;
    document.querySelectorAll("#formatTabs .mode-tab").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
    });
    syncFormatUi();
  });

  document.getElementById("modeTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mode]");
    if (!btn) return;
    mode = btn.dataset.mode;
    document.querySelectorAll("#modeTabs .mode-tab").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
    });
    document.querySelectorAll(".mode-panel").forEach((p) => {
      p.classList.toggle("is-active", p.dataset.panel === mode);
    });
  });

  document.getElementById("qualityRange").addEventListener("input", (e) => {
    document.getElementById("qualityValue").textContent = e.target.value;
  });

  function extFor(mime) {
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/png") return "png";
    return "webp";
  }

  function getSetting() {
    if (format === "image/png") {
      return { kind: "quality", quality: 1, label: "lossless" };
    }
    if (mode === "preset") {
      const key =
        document.querySelector('input[name="preset"]:checked')?.value || "high";
      return { kind: "quality", quality: F.PRESETS[key], label: key };
    }
    if (mode === "quality") {
      const q = Number(document.getElementById("qualityRange").value) / 100;
      return { kind: "quality", quality: q, label: `${Math.round(q * 100)}%` };
    }
    const kb = Number(document.getElementById("sizeTarget").value);
    return { kind: "size", maxBytes: Math.max(1, kb) * 1024, label: `≤ ${kb} KB` };
  }

  F.createToolApp({
    convertLabel: "Compress",
    zipName: "forgeimg-compress.zip",
    async process(files, report) {
      if (!F.supportsFormat(format)) {
        throw new Error("This browser cannot encode the selected format.");
      }
      const setting = getSetting();
      const rows = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        report?.(i, files.length, file.name);
        try {
          const img = await F.loadImage(file);
          const canvas = F.canvasFromImage(img);
          let encoded;
          if (format === "image/png") {
            encoded = await F.encodeAtQuality(canvas, format, 1);
          } else if (setting.kind === "size") {
            encoded = await F.encodeToSize(canvas, format, setting.maxBytes);
          } else {
            encoded = await F.encodeAtQuality(canvas, format, setting.quality);
          }
          const url = URL.createObjectURL(encoded.blob);
          const saved = file.size - encoded.blob.size;
          rows.push({
            name: F.outName(file, extFor(format)),
            originalName: file.name,
            originalSize: file.size,
            outSize: encoded.blob.size,
            saved,
            savedPct: file.size ? (saved / file.size) * 100 : 0,
            detail:
              format === "image/png"
                ? "PNG"
                : `${Math.round(encoded.quality * 100)}%`,
            meta: `${canvas.width}×${canvas.height}`,
            blob: encoded.blob,
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
      const totalIn = rows.reduce((s, r) => s + r.originalSize, 0);
      const totalOut = ok.reduce((s, r) => s + r.outSize, 0);
      return {
        rows,
        summary: `${ok.length}/${rows.length} compressed · ${extFor(format)} · ${
          setting.label
        } · ${F.humanBytes(totalIn)} → ${F.humanBytes(totalOut)}`,
      };
    },
  });
})();
