(() => {
  "use strict";

  const F = window.ForgeIMG;

  const FORMATS = {
    "image/webp": { label: "WebP", ext: "webp" },
    "image/jpeg": { label: "JPEG", ext: "jpg" },
    "image/png": { label: "PNG", ext: "png" },
  };

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
      <div class="field" style="margin-top:1rem">
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
          <label class="chip"><input type="radio" name="preset" value="high" /><span>High</span><small>92%</small></label>
          <label class="chip"><input type="radio" name="preset" value="medium" checked /><span>Medium</span><small>75%</small></label>
          <label class="chip"><input type="radio" name="preset" value="low" /><span>Low</span><small>50%</small></label>
        </div>
      </div>
      <div class="mode-panel" data-panel="quality">
        <label class="field-label" for="qualityRange">Quality <strong id="qualityValue">75</strong>%</label>
        <input id="qualityRange" type="range" min="1" max="100" value="75" />
      </div>
      <div class="mode-panel" data-panel="size">
        <label class="field-label" for="sizeTarget">Max file size (KB)</label>
        <input id="sizeTarget" type="number" min="1" max="5000" value="80" step="1" />
        <p class="field-help">Uses the highest quality that still fits under this limit. Pixel size does not change.</p>
      </div>
    </div>
    <p class="field-help">
      Output is always the Lottie composition size (width × height).
    </p>
    <p class="field-help" id="pngNote" hidden>
      PNG is lossless. Use WebP or JPEG when you need a smaller file.
    </p>
  `;

  window.ForgeIMGToolShell.mount({
    title: "Lottie fallback",
    convertLabel: "Export fallback",
    settingsHtml,
    accept:
      ".json,application/json,.lottie,.zip,application/zip,application/x-zip-compressed,image/*",
    folderAccept: ".json,application/json,image/*",
    dropHint: "Lottie JSON, .lottie, a folder with assets, or a ZIP",
    selectLabel: "Select files",
    dropAria: "Drop a Lottie file, folder, or ZIP",
    emptySummary: "No Lottie files yet.",
    resultsEmpty: "Export fallbacks to see results here.",
  });

  let mode = "preset";
  let format = "image/webp";
  const lossyControls = document.getElementById("lossyControls");
  const pngNote = document.getElementById("pngNote");
  const convertBtn = document.getElementById("convertBtn");
  const modalTitle = document.getElementById("modalTitle");

  function currentFormat() {
    return format || "image/webp";
  }

  function formatMeta(mime) {
    return FORMATS[mime] || FORMATS["image/webp"];
  }

  function syncFormatUi() {
    const mime = currentFormat();
    const meta = formatMeta(mime);
    const isPng = mime === "image/png";
    lossyControls.hidden = isPng;
    pngNote.hidden = !isPng;
    const label = `Lottie → ${meta.label}`;
    if (modalTitle) modalTitle.textContent = label;
    if (convertBtn) convertBtn.textContent = `Export ${meta.label}`;
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
    document.querySelectorAll("#lossyControls .mode-panel").forEach((p) => {
      p.classList.toggle("is-active", p.dataset.panel === mode);
    });
  });

  document.getElementById("qualityRange").addEventListener("input", (e) => {
    document.getElementById("qualityValue").textContent = e.target.value;
  });

  function getSetting() {
    if (mode === "preset") {
      const key =
        document.querySelector('input[name="preset"]:checked')?.value ||
        "medium";
      return { kind: "quality", quality: F.PRESETS[key], label: key };
    }
    if (mode === "quality") {
      const q = Number(document.getElementById("qualityRange").value) / 100;
      return { kind: "quality", quality: q, label: `${Math.round(q * 100)}%` };
    }
    const kb = Number(document.getElementById("sizeTarget").value);
    return {
      kind: "size",
      maxBytes: Math.max(1, kb) * 1024,
      label: `≤ ${kb} KB`,
    };
  }

  syncFormatUi();

  function isJsonFile(file) {
    if (!file) return false;
    if (file.type === "application/json") return true;
    return /\.json$/i.test(file.name);
  }

  function acceptLottieInput(file) {
    return F.isZipFile(file) || isJsonFile(file) || F.isImageFile(file);
  }

  function normalizePath(path) {
    return String(path || "")
      .replace(/\\/g, "/")
      .replace(/^\.?\//, "")
      .replace(/\/+/g, "/");
  }

  function dirname(path) {
    const n = normalizePath(path);
    const i = n.lastIndexOf("/");
    return i === -1 ? "" : n.slice(0, i);
  }

  function basename(path) {
    const n = normalizePath(path);
    const i = n.lastIndexOf("/");
    return i === -1 ? n : n.slice(i + 1);
  }

  function joinPath(dir, rel) {
    const r = normalizePath(rel);
    if (!dir) return r;
    return normalizePath(`${dir}/${r}`);
  }

  function isLottieData(data) {
    return (
      data &&
      typeof data === "object" &&
      typeof data.w === "number" &&
      typeof data.h === "number" &&
      (Array.isArray(data.layers) || typeof data.v === "string")
    );
  }

  function guessMime(name) {
    const lower = name.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".svg")) return "image/svg+xml";
    if (lower.endsWith(".json")) return "application/json";
    return "application/octet-stream";
  }

  async function buildVirtualFs(files) {
    const map = new Map();
    let zips = 0;
    let fromZip = 0;
    let looseJson = 0;
    let folderFiles = 0;

    for (const file of files) {
      if (F.isZipFile(file)) {
        zips += 1;
        if (typeof JSZip === "undefined") {
          throw new Error("ZIP support failed to load. Refresh and try again.");
        }
        let zip;
        try {
          zip = await JSZip.loadAsync(file);
        } catch {
          throw new Error(
            `Could not read ${file.name}. Use a .zip or .lottie file.`
          );
        }
        for (const path of Object.keys(zip.files)) {
          const entry = zip.files[path];
          if (entry.dir) continue;
          const base = basename(path);
          if (base.startsWith(".")) continue;
          const blob = await entry.async("blob");
          const norm = normalizePath(path);
          map.set(
            norm,
            new File([blob], base, {
              type: guessMime(base),
              lastModified: Date.now(),
            })
          );
          fromZip += 1;
        }
        continue;
      }

      const path = normalizePath(file.webkitRelativePath || file.name);
      map.set(path, file);
      if (F.isFromFolder(file)) folderFiles += 1;
      else if (isJsonFile(file)) looseJson += 1;
    }

    return { map, stats: { zips, fromZip, looseJson, folderFiles } };
  }

  function lookupAsset(fs, jsonDir, u, p) {
    const rel = normalizePath(`${u || ""}${p || ""}`);
    if (!rel) return null;
    const candidates = [
      joinPath(jsonDir, rel),
      rel,
      joinPath(jsonDir, basename(rel)),
      basename(rel),
    ];
    for (const key of candidates) {
      if (fs.has(key)) return fs.get(key);
    }
    const lower = candidates.map((c) => c.toLowerCase());
    for (const [key, file] of fs) {
      if (lower.includes(key.toLowerCase())) return file;
    }
    return null;
  }

  async function prepareAnimationData(raw, fs, jsonDir) {
    const data = JSON.parse(JSON.stringify(raw));
    const blobUrls = [];
    if (!Array.isArray(data.assets)) {
      return { data, blobUrls };
    }
    for (const asset of data.assets) {
      // e === 1 means already embedded (data URI) — leave alone
      if (!asset || asset.e === 1 || !asset.p) continue;
      // Skip layer refs (no w/h image assets)
      if (asset.layers) continue;
      const file = lookupAsset(fs, jsonDir, asset.u, asset.p);
      if (!file) continue;
      const url = URL.createObjectURL(file);
      blobUrls.push(url);
      // Full URL in p; do NOT set e=1 (that means base64 embed and breaks blob:)
      asset.u = "";
      asset.p = url;
      if ("e" in asset) delete asset.e;
    }
    return { data, blobUrls };
  }

  function waitForAnimReady(anim, timeoutMs) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let softTimer;

      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimer);
        clearTimeout(softTimer);
        fn(arg);
      };

      const hardTimer = setTimeout(
        () => finish(reject, new Error("Lottie load timed out")),
        timeoutMs
      );

      const readySoon = (ms) => {
        clearTimeout(softTimer);
        softTimer = setTimeout(() => finish(resolve), ms);
      };

      anim.addEventListener("DOMLoaded", () => readySoon(120));
      anim.addEventListener("loaded_images", () => readySoon(80));
      anim.addEventListener("data_ready", () => readySoon(150));
      anim.addEventListener("data_failed", () =>
        finish(reject, new Error("Lottie data failed to load"))
      );

      if (anim.isLoaded) readySoon(80);
      // Safety: never hang if events were missed
      softTimer = setTimeout(() => finish(resolve), Math.min(2500, timeoutMs));
    });
  }

  async function inlineSvgImages(svg) {
    const nodes = Array.from(svg.querySelectorAll("image"));
    await Promise.all(
      nodes.map(async (el) => {
        const href =
          el.getAttribute("href") ||
          el.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (!href || href.startsWith("data:")) return;
        try {
          const res = await fetch(href);
          const blob = await res.blob();
          const dataUrl = await new Promise((resFn, rej) => {
            const reader = new FileReader();
            reader.onload = () => resFn(reader.result);
            reader.onerror = () => rej(new Error("read failed"));
            reader.readAsDataURL(blob);
          });
          el.setAttribute("href", dataUrl);
          el.setAttributeNS(
            "http://www.w3.org/1999/xlink",
            "href",
            dataUrl
          );
        } catch {
          /* keep original href */
        }
      })
    );
  }

  function nextPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not rasterize SVG frame"));
      img.src = url;
    });
  }

  function firstFrameIndex(data) {
    const ip = typeof data.ip === "number" ? data.ip : 0;
    return Math.max(0, ip);
  }

  function isFlatBlack(canvas) {
    const ctx = canvas.__forgeCtx || canvas.getContext("2d");
    if (!ctx) return false;
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    const step = Math.max(4, Math.floor(data.length / 64) * 4);
    for (let i = 0; i < data.length; i += step) {
      if (data[i] > 12 || data[i + 1] > 12 || data[i + 2] > 12) return false;
      if (data[i + 3] < 250) return false;
    }
    return true;
  }

  function canvasHasInk(canvas, mime) {
    try {
      // Reuse the context created for drawing. A second getContext() with
      // different attributes returns null and used to mark blank frames as filled.
      const ctx =
        canvas.__forgeCtx ||
        canvas.getContext("2d", { willReadFrequently: true }) ||
        canvas.getContext("2d");
      if (!ctx) return false;
      const { width, height } = canvas;
      if (!width || !height) return false;
      const ignoreWhite = mime === "image/jpeg";
      const stepX = Math.max(1, Math.floor(width / 24));
      const stepY = Math.max(1, Math.floor(height / 24));
      const sample = ctx.getImageData(0, 0, width, height).data;
      for (let y = 0; y < height; y += stepY) {
        for (let x = 0; x < width; x += stepX) {
          const i = (y * width + x) * 4;
          const a = sample[i + 3];
          if (a <= 8) continue;
          if (
            ignoreWhite &&
            sample[i] > 248 &&
            sample[i + 1] > 248 &&
            sample[i + 2] > 248
          ) {
            continue;
          }
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  function makeHost(w, h) {
    const host = document.createElement("div");
    // Keep in-viewport — offscreen (left:-99999) often yields a blank canvas
    host.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      `width:${w}px`,
      `height:${h}px`,
      "overflow:hidden",
      "pointer-events:none",
      "opacity:0.01",
      "z-index:-1",
    ].join(";");
    document.body.appendChild(host);
    return host;
  }

  function exportCanvas(w, h, mime) {
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d", {
      alpha: mime !== "image/jpeg",
      willReadFrequently: true,
    });
    out.__forgeCtx = ctx;
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
    return { out, ctx };
  }

  async function renderViaSvg(animationData, w, h, mime, frame) {
    const host = makeHost(w, h);
    let anim;
    try {
      anim = lottie.loadAnimation({
        container: host,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData,
        rendererSettings: {
          // Exact composition box — do not letterbox / scale away from w×h
          preserveAspectRatio: "xMidYMid slice",
          progressiveLoad: false,
          hideOnTransparent: false,
        },
      });
      await waitForAnimReady(anim, 30000);
      anim.resize();
      anim.goToAndStop(frame, true);
      await nextPaint();

      const svg = host.querySelector("svg");
      if (!svg) throw new Error("No SVG from Lottie renderer");
      svg.setAttribute("width", String(w));
      svg.setAttribute("height", String(h));
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
      if (!svg.getAttribute("xmlns")) {
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }
      await inlineSvgImages(svg);

      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob(
        ['<?xml version="1.0" encoding="UTF-8"?>', xml],
        { type: "image/svg+xml;charset=utf-8" }
      );
      const url = URL.createObjectURL(blob);
      try {
        const img = await loadImageFromUrl(url);
        const { out, ctx } = exportCanvas(w, h, mime);
        ctx.drawImage(img, 0, 0, w, h);
        return out;
      } finally {
        URL.revokeObjectURL(url);
      }
    } finally {
      try {
        anim?.destroy();
      } catch {
        /* ignore */
      }
      host.remove();
    }
  }

  async function renderViaCanvas(animationData, w, h, mime, frame) {
    const host = makeHost(w, h);
    let anim;
    try {
      anim = lottie.loadAnimation({
        container: host,
        renderer: "canvas",
        loop: false,
        autoplay: false,
        animationData,
        rendererSettings: {
          clearCanvas: true,
          preserveAspectRatio: "xMidYMid slice",
          progressiveLoad: false,
          hideOnTransparent: false,
        },
      });
      await waitForAnimReady(anim, 30000);
      anim.resize();
      anim.goToAndStop(frame, true);
      await nextPaint();
      anim.goToAndStop(frame, true);
      await nextPaint();

      const src =
        anim.renderer?.canvas || host.querySelector("canvas");
      if (!src) throw new Error("No canvas from Lottie renderer");
      // Force bitmap buffer to composition size when lottie used CSS-only sizing
      if (src.width !== w || src.height !== h) {
        src.width = w;
        src.height = h;
        anim.resize();
        anim.goToAndStop(frame, true);
        await nextPaint();
      }

      const { out, ctx } = exportCanvas(w, h, mime);
      ctx.drawImage(src, 0, 0, w, h);
      if (out.width !== w || out.height !== h) {
        throw new Error(`Size mismatch: got ${out.width}×${out.height}, expected ${w}×${h}`);
      }
      if (isFlatBlack(out)) {
        throw new Error("Canvas renderer returned an empty frame");
      }
      return out;
    } finally {
      try {
        anim?.destroy();
      } catch {
        /* ignore */
      }
      host.remove();
    }
  }

  async function renderFirstFrame(animationData, w, h, mime) {
    if (typeof lottie === "undefined" || !lottie.loadAnimation) {
      throw new Error("lottie-web failed to load. Refresh and try again.");
    }

    const start = firstFrameIndex(animationData);
    const op =
      typeof animationData.op === "number" ? animationData.op : start + 1;
    const mid = Math.floor((start + op) / 2);
    const candidates = [...new Set([start, start + 1, mid, 0])].filter(
      (f) => f >= 0 && (op <= start || f < op)
    );

    let lastErr;
    let lastCanvas = null;
    for (const frame of candidates) {
      for (const render of [renderViaSvg, renderViaCanvas]) {
        try {
          const canvas = await render(animationData, w, h, mime, frame);
          lastCanvas = canvas;
          if (canvasHasInk(canvas, mime)) return canvas;
        } catch (err) {
          lastErr = err;
        }
      }
    }
    if (lastCanvas && canvasHasInk(lastCanvas, mime)) return lastCanvas;
    throw (
      lastErr ||
      new Error(
        "The frame rendered empty. Include the image assets in the folder or ZIP, then try again."
      )
    );
  }

  function queueLabel(files) {
    let json = 0;
    let zips = 0;
    let assets = 0;
    let folder = 0;
    for (const f of files) {
      if (F.isZipFile(f)) zips += 1;
      else if (isJsonFile(f)) {
        json += 1;
        if (F.isFromFolder(f)) folder += 1;
      } else if (F.isImageFile(f)) {
        assets += 1;
      }
    }
    const parts = [];
    if (json) parts.push(`${json} JSON`);
    if (zips) parts.push(`${zips} ZIP`);
    if (assets) parts.push(`${assets} asset${assets === 1 ? "" : "s"}`);
    if (folder && !zips) parts.push("from folder");
    return parts.length ? parts.join(" · ") : "Nothing selected";
  }

  F.createToolApp({
    convertLabel: () => `Export ${formatMeta(currentFormat()).label}`,
    zipName: () => {
      const meta = formatMeta(currentFormat());
      return `forgeimg-lottie-fallback-${meta.ext}.zip`;
    },
    acceptFile: acceptLottieInput,
    emptySummary: "No Lottie files yet.",
    rejectMessage: "Add a Lottie JSON, a .lottie file, image assets, or a ZIP.",
    queueLabel,
    emptyQueueError: (stats) =>
      stats?.zips
        ? "No Lottie JSON was found in that ZIP."
        : "No Lottie JSON found to process.",
    async resolveQueue(files) {
      const { map, stats } = await buildVirtualFs(files);
      const items = [];
      for (const [path, file] of map) {
        if (!/\.json$/i.test(path)) continue;
        let data;
        try {
          const text = await file.text();
          data = JSON.parse(text);
        } catch {
          continue;
        }
        if (!isLottieData(data)) continue;
        items.push({
          name: basename(path),
          path,
          dir: dirname(path),
          data,
          originalSize: file.size,
          fs: map,
        });
      }
      const noteParts = [];
      if (stats.looseJson) noteParts.push(`${stats.looseJson} JSON`);
      if (stats.folderFiles) {
        noteParts.push(`${stats.folderFiles} folder file(s)`);
      }
      if (stats.zips) {
        noteParts.push(
          `${stats.zips} ZIP → ${stats.fromZip} entr${
            stats.fromZip === 1 ? "y" : "ies"
          }`
        );
      }
      noteParts.push(`${items.length} Lottie`);
      return {
        items,
        stats: {
          ...stats,
          note: `sources: ${noteParts.join(", ")}`,
        },
      };
    },
    async process(items, report) {
      const mime = currentFormat();
      const meta = formatMeta(mime);
      if (!F.supportsFormat(mime)) {
        throw new Error(`This browser cannot encode ${meta.label}.`);
      }

      const isPng = mime === "image/png";
      const setting = isPng
        ? { kind: "quality", quality: 1, label: "lossless" }
        : getSetting();

      const rows = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        report?.(i, items.length, item.name);
        const blobUrls = [];
        try {
          const w = Math.max(1, Math.round(item.data.w));
          const h = Math.max(1, Math.round(item.data.h));
          const prepared = await prepareAnimationData(
            item.data,
            item.fs,
            item.dir
          );
          blobUrls.push(...prepared.blobUrls);
          const canvas = await renderFirstFrame(prepared.data, w, h, mime);
          if (canvas.width !== w || canvas.height !== h) {
            throw new Error(
              `Size mismatch: got ${canvas.width}×${canvas.height}, expected ${w}×${h}`
            );
          }

          let encoded;
          if (isPng) {
            encoded = await F.encodeAtQuality(canvas, mime, 1);
          } else if (setting.kind === "size") {
            encoded = await F.encodeToSize(canvas, mime, setting.maxBytes);
          } else {
            encoded = await F.encodeAtQuality(
              canvas,
              mime,
              setting.quality
            );
          }

          const url = URL.createObjectURL(encoded.blob);
          const outName = F.outName({ name: item.name }, meta.ext);
          const saved = item.originalSize - encoded.blob.size;
          const detail = isPng
            ? "PNG"
            : setting.kind === "size"
              ? `${setting.label} · q${Math.round(encoded.quality * 100)}`
              : `${Math.round(encoded.quality * 100)}%`;

          rows.push({
            name: outName,
            originalName: item.name,
            originalSize: item.originalSize,
            outSize: encoded.blob.size,
            saved,
            savedPct: item.originalSize
              ? (saved / item.originalSize) * 100
              : 0,
            detail: `first frame · ${detail}`,
            meta: `${w}×${h} · ${meta.label}`,
            blob: encoded.blob,
            url,
            ok: true,
          });
        } catch (err) {
          rows.push({
            name: F.outName({ name: item.name }, meta.ext),
            originalName: item.name,
            originalSize: item.originalSize,
            outSize: 0,
            saved: 0,
            ok: false,
            error: err.message || String(err),
          });
        } finally {
          blobUrls.forEach((u) => URL.revokeObjectURL(u));
        }
      }

      const ok = rows.filter((r) => r.ok);
      const totalIn = rows.reduce((s, r) => s + r.originalSize, 0);
      const totalOut = ok.reduce((s, r) => s + r.outSize, 0);
      return {
        rows,
        summary: `${ok.length}/${rows.length} → ${meta.label} · ${setting.label} · ${F.humanBytes(
          totalIn
        )} → ${F.humanBytes(totalOut)}`,
      };
    },
  });
})();
