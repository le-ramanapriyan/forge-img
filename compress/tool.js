(() => {
  "use strict";

  const F = window.ForgeIMG;

  const settingsHtml = `
    <div class="field">
      <span class="field-label">Compression control</span>
      <div class="segmented" id="modeTabs">
        <button type="button" class="mode-tab is-active" data-mode="preset">Preset</button>
        <button type="button" class="mode-tab" data-mode="quality">Percentage</button>
        <button type="button" class="mode-tab" data-mode="size">Max size</button>
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
    <p class="field-help">
      Original formats and dimensions are preserved. PNG files use lossless
      optimization, so the quality and size settings apply only to JPEG and WebP.
    </p>
  `;

  window.ForgeIMGToolShell.mount({
    title: "Compress images",
    convertLabel: "Compress images",
    settingsHtml,
    steps: { settings: "Choose a quality control." },
  });

  let mode = "preset";

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

  function getSetting() {
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
    convertLabel: "Compress images",
    zipName: "forgeimg-compress.zip",
    acceptFile: (file) => F.isZipFile(file) || Boolean(F.sourceImageFormat(file)),
    rejectMessage:
      "Compress supports JPEG, PNG, and WebP. Use Convert for other image formats.",
    async process(files, report) {
      const setting = getSetting();
      const rows = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        report?.(i, files.length, file.name);
        try {
          const source = F.sourceImageFormat(file);
          if (!source) {
            throw new Error(
              "This format cannot be compressed without changing it. Use Convert instead."
            );
          }
          if (source.mime !== "image/png" && !F.supportsFormat(source.mime)) {
            throw new Error(`This browser cannot encode ${source.label}.`);
          }
          const img = await F.loadImage(file);
          const canvas = F.canvasFromImage(img);
          let encoded;
          if (source.mime === "image/png") {
            encoded = F.encodePngLossless(canvas);
          } else if (setting.kind === "size") {
            encoded = await F.encodeToSize(
              canvas,
              source.mime,
              setting.maxBytes
            );
          } else {
            encoded = await F.encodeAtQuality(
              canvas,
              source.mime,
              setting.quality
            );
          }
          const unchanged = encoded.blob.size >= file.size;
          const output = unchanged ? file : encoded.blob;
          const url = URL.createObjectURL(output);
          const saved = file.size - output.size;
          rows.push({
            name: file.name,
            originalName: file.name,
            originalSize: file.size,
            outSize: output.size,
            saved,
            savedPct: file.size ? (saved / file.size) * 100 : 0,
            detail: unchanged
              ? `${source.label} · original kept`
              : source.mime === "image/png"
                ? "PNG · lossless"
                : `${source.label} · ${Math.round(encoded.quality * 100)}%`,
            meta: `${canvas.width}×${canvas.height}`,
            blob: output,
            url,
            ok: true,
          });
        } catch (err) {
          rows.push({
            name: file.name,
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
      const formats = files
        .map((file) => F.sourceImageFormat(file)?.mime)
        .filter(Boolean);
      const settingParts = [];
      if (formats.some((mime) => mime !== "image/png")) {
        settingParts.push(setting.label);
      }
      if (formats.includes("image/png")) settingParts.push("PNG lossless");
      return {
        rows,
        summary: `${ok.length}/${rows.length} compressed · same format · ${
          settingParts.join(" · ") || "original kept"
        } · ${F.humanBytes(totalIn)} → ${F.humanBytes(totalOut)}`,
      };
    },
  });
})();
