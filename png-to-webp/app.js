(() => {
  "use strict";

  const PRESETS = { high: 0.92, medium: 0.75, low: 0.5 };
  const IMAGE_TYPES = /^(image\/(png|jpeg|jpg|gif|webp|bmp|avif))$/i;

  const state = {
    mode: "preset",
    files: [],
    results: [],
  };

  const els = {
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    folderInput: document.getElementById("folderInput"),
    convertBtn: document.getElementById("convertBtn"),
    clearBtn: document.getElementById("clearBtn"),
    qualityRange: document.getElementById("qualityRange"),
    qualityValue: document.getElementById("qualityValue"),
    sizeTarget: document.getElementById("sizeTarget"),
    keepNames: document.getElementById("keepNames"),
    resultsSection: document.getElementById("resultsSection"),
    resultsBody: document.getElementById("resultsBody"),
    resultsSummary: document.getElementById("resultsSummary"),
    downloadAllBtn: document.getElementById("downloadAllBtn"),
  };

  function humanBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function supportsWebPEncode() {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not decode image"));
      };
      img.src = url;
    });
  }

  function canvasFromImage(img) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d", { alpha: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  function blobToWebP(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error("WebP encode failed"));
          else resolve(blob);
        },
        "image/webp",
        quality
      );
    });
  }

  async function encodeAtQuality(canvas, quality) {
    const blob = await blobToWebP(canvas, quality);
    return { blob, quality };
  }

  async function encodeToSize(canvas, maxBytes) {
    let lo = 0.01;
    let hi = 1;
    let best = null;

    for (let i = 0; i < 10; i++) {
      const q = (lo + hi) / 2;
      const blob = await blobToWebP(canvas, q);
      if (blob.size <= maxBytes) {
        best = { blob, quality: q };
        lo = q;
      } else {
        hi = q;
      }
    }

    if (best) return best;

    const fallback = await blobToWebP(canvas, 0.01);
    if (fallback.size <= maxBytes) {
      return { blob: fallback, quality: 0.01 };
    }
    throw new Error(
      `Cannot fit under ${humanBytes(maxBytes)} (got ${humanBytes(fallback.size)})`
    );
  }

  function getQualitySetting() {
    if (state.mode === "preset") {
      const selected = document.querySelector('input[name="preset"]:checked');
      const key = selected ? selected.value : "high";
      return { kind: "quality", quality: PRESETS[key], label: key };
    }
    if (state.mode === "quality") {
      const q = Number(els.qualityRange.value) / 100;
      return { kind: "quality", quality: q, label: `${Math.round(q * 100)}%` };
    }
    const kb = Number(els.sizeTarget.value);
    return {
      kind: "size",
      maxBytes: Math.max(1, kb) * 1024,
      label: `≤ ${kb} KB`,
    };
  }

  function outName(file) {
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    if (els.keepNames.checked) return `${base}.webp`;
    return `${base}-compressed.webp`;
  }

  function isImageFile(file) {
    if (IMAGE_TYPES.test(file.type)) return true;
    return /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(file.name);
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []).filter(isImageFile);
    if (!incoming.length) return;

    const map = new Map(state.files.map((f) => [f.name + f.size + f.lastModified, f]));
    for (const f of incoming) {
      map.set(f.name + f.size + f.lastModified, f);
    }
    state.files = Array.from(map.values());
    renderDropzoneCount();
    els.convertBtn.disabled = state.files.length === 0;
    els.clearBtn.disabled = state.files.length === 0;
  }

  function renderDropzoneCount() {
    let countEl = els.dropzone.querySelector(".file-count");
    if (!state.files.length) {
      countEl?.remove();
      els.dropzone.classList.remove("has-files");
      return;
    }
    els.dropzone.classList.add("has-files");
    if (!countEl) {
      countEl = document.createElement("p");
      countEl.className = "file-count";
      els.dropzone.querySelector(".dropzone-inner").appendChild(countEl);
    }
    countEl.textContent = `${state.files.length} image${
      state.files.length === 1 ? "" : "s"
    } ready`;
  }

  async function convertOne(file, setting) {
    const img = await loadImage(file);
    const canvas = canvasFromImage(img);
    let encoded;
    if (setting.kind === "size") {
      encoded = await encodeToSize(canvas, setting.maxBytes);
    } else {
      encoded = await encodeAtQuality(canvas, setting.quality);
    }
    const url = URL.createObjectURL(encoded.blob);
    const saved = file.size - encoded.blob.size;
    const savedPct = file.size ? (saved / file.size) * 100 : 0;
    return {
      name: outName(file),
      originalName: file.name,
      originalSize: file.size,
      webpSize: encoded.blob.size,
      saved,
      savedPct,
      quality: Math.round(encoded.quality * 100),
      blob: encoded.blob,
      url,
      ok: true,
      error: null,
      dims: `${canvas.width}×${canvas.height}`,
    };
  }

  async function convertAll() {
    if (!supportsWebPEncode()) {
      alert(
        "This browser cannot encode WebP. Try the latest Chrome, Edge, or Firefox."
      );
      return;
    }
    if (!state.files.length) return;

    els.convertBtn.disabled = true;
    els.convertBtn.textContent = "Converting…";
    state.results.forEach((r) => r.url && URL.revokeObjectURL(r.url));
    state.results = [];

    const setting = getQualitySetting();
    const rows = [];

    for (const file of state.files) {
      try {
        rows.push(await convertOne(file, setting));
      } catch (err) {
        rows.push({
          name: outName(file),
          originalName: file.name,
          originalSize: file.size,
          webpSize: 0,
          saved: 0,
          savedPct: 0,
          quality: "—",
          blob: null,
          url: null,
          ok: false,
          error: err.message || String(err),
          dims: "—",
        });
      }
    }

    state.results = rows;
    renderResults(setting);
    els.convertBtn.disabled = false;
    els.convertBtn.textContent = "Convert to WebP";
  }

  function renderResults(setting) {
    els.resultsSection.hidden = false;
    els.resultsBody.innerHTML = "";

    const ok = state.results.filter((r) => r.ok);
    const totalIn = state.results.reduce((s, r) => s + r.originalSize, 0);
    const totalOut = ok.reduce((s, r) => s + r.webpSize, 0);
    const saved = totalIn - totalOut;

    els.resultsSummary.textContent = `${ok.length}/${state.results.length} converted · mode: ${
      state.mode
    } (${setting.label}) · ${humanBytes(totalIn)} → ${humanBytes(totalOut)} (${
      saved >= 0 ? "saved" : "grew"
    } ${humanBytes(Math.abs(saved))})`;

    els.downloadAllBtn.disabled = ok.length === 0;

    for (const r of state.results) {
      const tr = document.createElement("tr");
      if (!r.ok) {
        tr.innerHTML = `
          <td>${escapeHtml(r.originalName)}</td>
          <td>${humanBytes(r.originalSize)}</td>
          <td colspan="3" class="status-err">${escapeHtml(r.error)}</td>
          <td></td>`;
        els.resultsBody.appendChild(tr);
        continue;
      }

      const savedClass = r.saved >= 0 ? "saved-pos" : "saved-neg";
      const savedText =
        (r.saved >= 0 ? "−" : "+") +
        humanBytes(Math.abs(r.saved)) +
        ` (${Math.abs(r.savedPct).toFixed(0)}%)`;

      tr.innerHTML = `
        <td>
          <div>${escapeHtml(r.name)}</div>
          <small style="color:var(--ink-soft)">${escapeHtml(r.dims)}</small>
        </td>
        <td>${humanBytes(r.originalSize)}</td>
        <td>${humanBytes(r.webpSize)}</td>
        <td class="${savedClass}">${savedText}</td>
        <td>${r.quality}%</td>
        <td></td>`;

      const td = tr.lastElementChild;
      const a = document.createElement("a");
      a.className = "btn btn-ghost btn-tiny";
      a.href = r.url;
      a.download = r.name;
      a.textContent = "Download";
      td.appendChild(a);
      els.resultsBody.appendChild(tr);
    }

    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function downloadZip() {
    if (typeof JSZip === "undefined") {
      alert("Zip library failed to load. Download files one by one.");
      return;
    }
    const zip = new JSZip();
    const ok = state.results.filter((r) => r.ok && r.blob);
    if (!ok.length) return;

    const used = new Map();
    for (const r of ok) {
      let name = r.name;
      const n = (used.get(name) || 0) + 1;
      used.set(name, n);
      if (n > 1) {
        const stem = name.replace(/\.webp$/i, "");
        name = `${stem}-${n}.webp`;
      }
      zip.file(name, r.blob);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "webp-compressed.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function clearAll() {
    state.results.forEach((r) => r.url && URL.revokeObjectURL(r.url));
    state.files = [];
    state.results = [];
    els.fileInput.value = "";
    els.folderInput.value = "";
    els.resultsSection.hidden = true;
    els.resultsBody.innerHTML = "";
    els.downloadAllBtn.disabled = true;
    els.convertBtn.disabled = true;
    els.clearBtn.disabled = true;
    renderDropzoneCount();
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".mode-tab").forEach((btn) => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.panel === mode);
    });
  }

  // Events
  document.querySelectorAll(".mode-tab").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  els.qualityRange.addEventListener("input", () => {
    els.qualityValue.textContent = els.qualityRange.value;
  });

  els.fileInput.addEventListener("change", () => addFiles(els.fileInput.files));
  els.folderInput.addEventListener("change", () => addFiles(els.folderInput.files));

  els.dropzone.addEventListener("click", (e) => {
    if (e.target.closest("label")) return;
    els.fileInput.click();
  });

  els.dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      els.fileInput.click();
    }
  });

  ["dragenter", "dragover"].forEach((type) => {
    els.dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      els.dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    els.dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("is-dragover");
    });
  });

  els.dropzone.addEventListener("drop", (e) => {
    const items = e.dataTransfer?.files;
    if (items?.length) addFiles(items);
  });

  els.convertBtn.addEventListener("click", () => convertAll());
  els.clearBtn.addEventListener("click", () => clearAll());
  els.downloadAllBtn.addEventListener("click", () => downloadZip());
})();
