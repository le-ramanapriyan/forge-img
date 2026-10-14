(() => {
  "use strict";

  const F = window.ForgeIMG;

  const settingsHtml = `
    <div class="field">
      <span class="field-label">Crop frame</span>
      <div class="segmented" id="aspectTabs">
        <button type="button" class="mode-tab is-active" data-aspect="free">Free</button>
        <button type="button" class="mode-tab" data-aspect="1">1:1</button>
        <button type="button" class="mode-tab" data-aspect="1.333">4:3</button>
        <button type="button" class="mode-tab" data-aspect="1.777">16:9</button>
      </div>
    </div>
    <div class="crop-stage">
      <div class="crop-canvas-wrap">
        <canvas id="cropCanvas" width="640" height="360"></canvas>
      </div>
      <div class="crop-placeholder">
        <img class="icon" src="../assets/icons/crop-32-dark.svg" width="32" height="32" alt="" />
        <p class="crop-placeholder-title">Add images to begin your crop</p>
        <p class="crop-placeholder-note">The first image will appear here.</p>
      </div>
    </div>
    <p class="field-help" id="cropHint">Drag on the preview to choose what to keep. The same crop is applied to the whole batch.</p>
    <div class="field">
      <span class="field-label">Output format</span>
      <div class="segmented" id="formatTabs">
        <button type="button" class="mode-tab is-active" data-format="image/webp">WebP</button>
        <button type="button" class="mode-tab" data-format="image/jpeg">JPEG</button>
        <button type="button" class="mode-tab" data-format="image/png">PNG</button>
      </div>
    </div>
    <p class="field-help">WebP and JPEG are saved at 92% quality. PNG is also available.</p>
  `;

  window.ForgeIMGToolShell.mount({
    title: "Crop images",
    convertLabel: "Crop images",
    settingsHtml,
    steps: { settings: "Draw your selection or choose a fixed frame ratio." },
  });

  let aspect = "free";
  let format = "image/webp";
  let previewImg = null;
  let scale = 1;
  let selection = null; // image-space coords {x,y,w,h}
  let drag = null;
  let beforeDrag = null;
  let previewToken = 0;

  const canvas = document.getElementById("cropCanvas");
  const ctx = canvas.getContext("2d");

  document.getElementById("aspectTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-aspect]");
    if (!btn) return;
    aspect = btn.dataset.aspect;
    document.querySelectorAll("#aspectTabs .mode-tab").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
    });
    if (previewImg) resetDefaultSelection();
    draw();
  });

  document.getElementById("formatTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-format]");
    if (!btn) return;
    format = btn.dataset.format;
    document.querySelectorAll("#formatTabs .mode-tab").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
    });
  });

  function extFor(mime) {
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/png") return "png";
    return "webp";
  }

  function resetDefaultSelection() {
    if (!previewImg) return;
    const iw = previewImg.naturalWidth;
    const ih = previewImg.naturalHeight;
    if (aspect === "free") {
      selection = {
        x: Math.round(iw * 0.1),
        y: Math.round(ih * 0.1),
        w: Math.round(iw * 0.8),
        h: Math.round(ih * 0.8),
      };
      return;
    }
    const ratio = Number(aspect);
    let w = iw * 0.8;
    let h = w / ratio;
    if (h > ih * 0.8) {
      h = ih * 0.8;
      w = h * ratio;
    }
    selection = {
      x: Math.round((iw - w) / 2),
      y: Math.round((ih - h) / 2),
      w: Math.round(w),
      h: Math.round(h),
    };
  }

  function draw() {
    if (!previewImg) {
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#a3a3a3";
      ctx.font = "14px Inter, sans-serif";
      ctx.fillText("No preview yet", 24, 40);
      return;
    }

    const iw = previewImg.naturalWidth;
    const ih = previewImg.naturalHeight;
    const maxW = 720;
    const maxH = 420;
    scale = Math.min(maxW / iw, maxH / ih, 1);
    canvas.width = Math.round(iw * scale);
    canvas.height = Math.round(ih * scale);

    ctx.drawImage(previewImg, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!selection) return;
    const sx = selection.x * scale;
    const sy = selection.y * scale;
    const sw = selection.w * scale;
    const sh = selection.h * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.clip();
    ctx.drawImage(previewImg, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.strokeStyle = "#fb4446";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);

    document.getElementById("cropHint").textContent =
      `Crop ${selection.w}×${selection.h}px · drag to adjust`;
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x: x / scale, y: y / scale };
  }

  function clampSelection(sel) {
    if (!previewImg) return sel;
    const iw = previewImg.naturalWidth;
    const ih = previewImg.naturalHeight;
    let { x, y, w, h } = sel;
    w = Math.max(8, w);
    h = Math.max(8, h);
    if (aspect !== "free") {
      const ratio = Number(aspect);
      h = w / ratio;
    }
    if (w > iw) {
      w = iw;
      if (aspect !== "free") h = w / Number(aspect);
    }
    if (h > ih) {
      h = ih;
      if (aspect !== "free") w = h * Number(aspect);
    }
    w = Math.max(8, Math.min(w, iw));
    h = Math.max(8, Math.min(h, ih));
    x = Math.min(Math.max(0, x), Math.max(0, iw - w));
    y = Math.min(Math.max(0, y), Math.max(0, ih - h));
    return {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h),
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!previewImg) return;
    canvas.setPointerCapture(e.pointerId);
    const p = canvasPoint(e);
    beforeDrag = selection ? { ...selection } : null;
    drag = { x0: p.x, y0: p.y };
    selection = { x: p.x, y: p.y, w: 1, h: 1 };
    draw();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drag || !previewImg) return;
    const p = canvasPoint(e);
    let x = Math.min(drag.x0, p.x);
    let y = Math.min(drag.y0, p.y);
    let w = Math.abs(p.x - drag.x0);
    let h = Math.abs(p.y - drag.y0);
    if (aspect !== "free") {
      const ratio = Number(aspect);
      if (w / h > ratio) w = h * ratio;
      else h = w / ratio;
      if (p.x < drag.x0) x = drag.x0 - w;
      if (p.y < drag.y0) y = drag.y0 - h;
    }
    selection = clampSelection({ x, y, w, h });
    draw();
  });

  canvas.addEventListener("pointerup", () => {
    if (selection && beforeDrag && selection.w < 12 && selection.h < 12) {
      selection = beforeDrag;
      draw();
    }
    drag = null;
    beforeDrag = null;
  });

  async function loadPreview(files) {
    const token = ++previewToken;
    if (!files.length) {
      previewImg = null;
      selection = null;
      draw();
      return;
    }
    let previewFile = files.find((f) => F.isImageFile(f) && !F.isZipFile(f));
    try {
      if (!previewFile) {
        const zip = files.find((f) => F.isZipFile(f));
        if (zip) {
          const { images } = await F.resolveProcessQueue([zip]);
          previewFile = images[0];
        }
      }
      if (token !== previewToken) return;
      if (!previewFile) {
        previewImg = null;
        selection = null;
        draw();
        return;
      }
      previewImg = await F.loadImage(previewFile);
      if (token !== previewToken) return;
      resetDefaultSelection();
      draw();
    } catch {
      if (token !== previewToken) return;
      previewImg = null;
      selection = null;
      draw();
    }
  }

  F.createToolApp({
    convertLabel: "Crop images",
    zipName: "forgeimg-crop.zip",
    onFilesChanged: (files) => {
      loadPreview(files);
    },
    onStep: (step, state) => {
      if (step === "settings" && state.files.length) loadPreview(state.files);
    },
    onClear: () => {
      previewToken += 1;
      previewImg = null;
      selection = null;
      draw();
    },
    async process(files, report) {
      if (!F.supportsFormat(format)) {
        throw new Error("This browser cannot encode the selected format.");
      }
      if (!selection || selection.w < 2 || selection.h < 2) {
        throw new Error("Draw a crop region on the preview first.");
      }

      const rows = [];
      const cropBox = { ...selection };

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        report?.(i, files.length, file.name);
        try {
          const img = await F.loadImage(file);
          const iw = img.naturalWidth;
          const ih = img.naturalHeight;

          // Scale crop from first-image space if dimensions differ
          let box = { ...cropBox };
          if (previewImg && (iw !== previewImg.naturalWidth || ih !== previewImg.naturalHeight)) {
            const sx = iw / previewImg.naturalWidth;
            const sy = ih / previewImg.naturalHeight;
            box = {
              x: Math.round(cropBox.x * sx),
              y: Math.round(cropBox.y * sy),
              w: Math.round(cropBox.w * sx),
              h: Math.round(cropBox.h * sy),
            };
          }
          box.x = Math.max(0, Math.min(box.x, iw - 1));
          box.y = Math.max(0, Math.min(box.y, ih - 1));
          box.w = Math.max(1, Math.min(box.w, iw - box.x));
          box.h = Math.max(1, Math.min(box.h, ih - box.y));

          const out = document.createElement("canvas");
          out.width = box.w;
          out.height = box.h;
          const octx = out.getContext("2d", { alpha: true });
          octx.drawImage(
            img,
            box.x,
            box.y,
            box.w,
            box.h,
            0,
            0,
            box.w,
            box.h
          );
          const quality = format === "image/png" ? undefined : 0.92;
          const blob = await F.canvasToBlob(out, format, quality);
          const url = URL.createObjectURL(blob);
          const saved = file.size - blob.size;
          rows.push({
            name: F.outName(file, extFor(format)),
            originalName: file.name,
            originalSize: file.size,
            outSize: blob.size,
            saved,
            savedPct: file.size ? (saved / file.size) * 100 : 0,
            detail: `${box.w}×${box.h}`,
            meta: `from ${iw}×${ih}`,
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
        summary: `${ok.length}/${rows.length} cropped · ${
          aspect === "free"
            ? "free"
            : aspect === "1"
              ? "1:1"
              : aspect === "1.777"
                ? "16:9"
                : "4:3"
        }`,
      };
    },
  });

  draw();
})();
