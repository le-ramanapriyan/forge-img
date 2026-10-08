(() => {
  "use strict";

  const IMAGE_TYPES = /^(image\/(png|jpeg|jpg|gif|webp|bmp|avif))$/i;
  const PRESETS = { high: 0.92, medium: 0.75, low: 0.5 };

  function humanBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function isImageFile(file) {
    if (IMAGE_TYPES.test(file.type)) return true;
    return /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(file.name);
  }

  function isZipFile(file) {
    if (!file) return false;
    if (
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed" ||
      file.type === "multipart/x-zip"
    ) {
      return true;
    }
    return /\.zip$/i.test(file.name);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function outName(file, ext) {
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return `${base}.${ext.replace(/^\./, "")}`;
  }

  function supportsFormat(mime) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL(mime).startsWith(`data:${mime}`);
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

  function canvasFromImage(img, w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w || img.naturalWidth || img.width;
    canvas.height = h || img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d", { alpha: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      const q = mime === "image/png" ? undefined : quality;
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error("Encode failed"));
          else resolve(blob);
        },
        mime,
        q
      );
    });
  }

  async function encodeAtQuality(canvas, mime, quality) {
    const blob = await canvasToBlob(canvas, mime, quality);
    return { blob, quality };
  }

  async function encodeToSize(canvas, mime, maxBytes) {
    if (mime === "image/png") {
      const blob = await canvasToBlob(canvas, mime);
      if (blob.size <= maxBytes) return { blob, quality: 1 };
      throw new Error(
        `PNG is ${humanBytes(blob.size)}; cannot meet ${humanBytes(maxBytes)} without resize`
      );
    }

    let lo = 0.01;
    let hi = 1;
    let best = null;
    for (let i = 0; i < 10; i++) {
      const q = (lo + hi) / 2;
      const blob = await canvasToBlob(canvas, mime, q);
      if (blob.size <= maxBytes) {
        best = { blob, quality: q };
        lo = q;
      } else {
        hi = q;
      }
    }
    if (best) return best;
    const fallback = await canvasToBlob(canvas, mime, 0.01);
    if (fallback.size <= maxBytes) return { blob: fallback, quality: 0.01 };
    throw new Error(
      `Cannot fit under ${humanBytes(maxBytes)} (got ${humanBytes(fallback.size)})`
    );
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function zipDownload(files, zipName) {
    if (typeof JSZip === "undefined") {
      alert("Zip library failed to load. Download files one by one.");
      return;
    }
    const zip = new JSZip();
    const used = new Map();
    for (const f of files) {
      let name = f.name;
      const n = (used.get(name) || 0) + 1;
      used.set(name, n);
      if (n > 1) {
        const parts = name.split(".");
        const ext = parts.pop();
        name = `${parts.join(".")}-${n}.${ext}`;
      }
      zip.file(name, f.blob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, zipName || "forgeimg.zip");
  }

  function fileKey(f) {
    return `${f.name}|${f.size}|${f.lastModified || 0}`;
  }

  function isAcceptableInput(file) {
    return isImageFile(file) || isZipFile(file);
  }

  function isFromFolder(file) {
    return Boolean(
      file &&
        file.webkitRelativePath &&
        String(file.webkitRelativePath).includes("/")
    );
  }

  function mergeFiles(existing, fileList) {
    const incoming = Array.from(fileList || []).filter(isAcceptableInput);
    const map = new Map(existing.map((f) => [fileKey(f), f]));
    for (const f of incoming) {
      map.set(fileKey(f), f);
    }
    return Array.from(map.values());
  }

  function summarizeQueue(fileList) {
    const list = Array.from(fileList || []);
    let images = 0;
    let zips = 0;
    let folderFiles = 0;
    for (const f of list) {
      if (isZipFile(f)) zips += 1;
      else if (isImageFile(f)) {
        if (isFromFolder(f)) folderFiles += 1;
        else images += 1;
      }
    }
    return { images, zips, folderFiles, total: list.length };
  }

  async function unzipToImages(zipFile) {
    if (typeof JSZip === "undefined") {
      throw new Error("ZIP support failed to load. Refresh and try again.");
    }
    const zip = await JSZip.loadAsync(zipFile);
    const images = [];
    const entries = Object.keys(zip.files);
    for (const path of entries) {
      const entry = zip.files[path];
      if (entry.dir) continue;
      const base = path.split("/").pop() || path;
      if (base.startsWith(".")) continue;
      if (!isImageFile({ name: base, type: "" })) continue;
      const blob = await entry.async("blob");
      const mime = guessMime(base);
      images.push(
        new File([blob], base, {
          type: mime,
          lastModified: Date.now(),
        })
      );
    }
    return images;
  }

  function guessMime(name) {
    const lower = name.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".bmp")) return "image/bmp";
    if (lower.endsWith(".avif")) return "image/avif";
    return "application/octet-stream";
  }

  /**
   * Process-time resolver: detect file vs folder image vs ZIP, unzip ZIPs.
   */
  async function resolveProcessQueue(fileList) {
    const list = Array.from(fileList || []);
    const images = [];
    const stats = {
      looseFiles: 0,
      folderFiles: 0,
      zips: 0,
      fromZip: 0,
      skipped: 0,
    };

    for (const file of list) {
      if (isZipFile(file)) {
        stats.zips += 1;
        const fromZip = await unzipToImages(file);
        stats.fromZip += fromZip.length;
        images.push(...fromZip);
        continue;
      }
      if (isImageFile(file)) {
        if (isFromFolder(file)) stats.folderFiles += 1;
        else stats.looseFiles += 1;
        images.push(file);
        continue;
      }
      stats.skipped += 1;
    }

    return { images, stats };
  }

  /** Upload-time helper (same rules; used if early expand needed). */
  async function expandIncoming(fileList) {
    const { images, stats } = await resolveProcessQueue(fileList);
    return { images, zipCount: stats.zips, stats };
  }

  function bindDropzone(dropzone, fileInput, folderInput, onFiles) {
    const add = (list) => {
      if (list?.length) onFiles(list);
    };

    fileInput?.addEventListener("change", () => add(fileInput.files));
    folderInput?.addEventListener("change", () => add(folderInput.files));

    const folderBtn = document.getElementById("folderPickBtn");
    folderBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      folderInput?.click();
    });

    dropzone.addEventListener("click", (e) => {
      if (e.target.closest("label") || e.target.closest("#folderPickBtn")) return;
      fileInput?.click();
    });

    dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput?.click();
      }
    });

    ["dragenter", "dragover"].forEach((type) => {
      dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((type) => {
      dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        dropzone.classList.remove("is-dragover");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      add(e.dataTransfer?.files);
    });
  }

  /**
   * Shared modal step machine for ForgeIMG tools.
   */
  function createToolApp(config) {
    const STEPS = ["upload", "settings", "results"];
    const state = {
      step: "upload",
      files: [],
      results: [],
    };

    const els = {
      dropzone: document.getElementById("dropzone"),
      fileInput: document.getElementById("fileInput"),
      folderInput: document.getElementById("folderInput"),
      convertBtn: document.getElementById("convertBtn"),
      clearBtn: document.getElementById("clearBtn"),
      nextBtn: document.getElementById("nextBtn"),
      backBtn: document.getElementById("backBtn"),
      fileSummary: document.getElementById("fileSummary"),
      resultsEmpty: document.getElementById("resultsEmpty"),
      resultsContent: document.getElementById("resultsContent"),
      resultsBody: document.getElementById("resultsBody"),
      resultsSummary: document.getElementById("resultsSummary"),
      downloadAllBtn: document.getElementById("downloadAllBtn"),
    };

    let busy = false;

    function queueLabel(files) {
      const s = summarizeQueue(files);
      const parts = [];
      if (s.images) parts.push(`${s.images} file${s.images === 1 ? "" : "s"}`);
      if (s.folderFiles) {
        parts.push(
          `${s.folderFiles} from folder${s.folderFiles === 1 ? "" : "s"}`
        );
      }
      if (s.zips) parts.push(`${s.zips} ZIP${s.zips === 1 ? "" : "s"}`);
      return parts.length ? parts.join(" · ") : "Nothing selected";
    }

    function updateSummary() {
      if (!els.fileSummary) return;
      if (!state.files.length) {
        els.fileSummary.textContent = "No images selected yet.";
        return;
      }
      const total = state.files.reduce((s, f) => s + f.size, 0);
      els.fileSummary.textContent = `${queueLabel(state.files)} · ${humanBytes(
        total
      )} · ZIP unpacks on process`;
    }

    function setFiles(list) {
      if (!list?.length || busy) return;
      const before = state.files.length;
      state.files = mergeFiles(state.files, list);
      if (state.files.length === before) {
        alert("No supported images or ZIP files found.");
      }
      renderDropCount(els.dropzone, state.files.length, queueLabel(state.files));
      updateSummary();
      syncFooter();
      config.onFilesChanged?.(state.files);
    }

    function syncFooter() {
      const idx = STEPS.indexOf(state.step);
      const hasFiles = state.files.length > 0;
      const hasOkResults = state.results.some((r) => r.ok);
      const hasAnyWork = hasFiles || state.results.length > 0;

      // Only show buttons that are useful for the current step/state
      els.clearBtn.hidden = !hasAnyWork;
      els.backBtn.hidden = idx === 0;
      els.nextBtn.hidden = !(state.step === "upload" && hasFiles);
      els.convertBtn.hidden = !(state.step === "settings" && hasFiles);
      els.downloadAllBtn.hidden = !(state.step === "results" && hasOkResults);

      els.clearBtn.disabled = false;
      els.backBtn.disabled = false;
      els.nextBtn.disabled = false;
      els.convertBtn.disabled = busy;
      els.downloadAllBtn.disabled = false;

      document.querySelectorAll("[data-step-btn]").forEach((btn) => {
        const step = btn.dataset.stepBtn;
        const stepIdx = STEPS.indexOf(step);
        btn.classList.toggle("is-active", step === state.step);
        btn.classList.toggle("is-done", stepIdx < idx);
      });
    }

    function setStep(step) {
      if (step === "settings" && !state.files.length) return;
      if (step === "results" && !state.results.length && state.step !== "settings") {
        /* allow after convert */
      }
      state.step = step;
      document.querySelectorAll(".step-view").forEach((view) => {
        view.classList.toggle("is-active", view.dataset.step === step);
      });
      syncFooter();
      config.onStep?.(step, state);
    }

    function clearAll() {
      state.results.forEach((r) => r.url && URL.revokeObjectURL(r.url));
      state.files = [];
      state.results = [];
      if (els.fileInput) els.fileInput.value = "";
      if (els.folderInput) els.folderInput.value = "";
      els.resultsBody.innerHTML = "";
      els.resultsEmpty.hidden = false;
      els.resultsContent.hidden = true;
      renderDropCount(els.dropzone, 0);
      updateSummary();
      setStep("upload");
      config.onClear?.();
    }

    function renderResults(summaryText) {
      els.resultsBody.innerHTML = "";
      if (!state.results.length) {
        els.resultsEmpty.hidden = false;
        els.resultsContent.hidden = true;
        return;
      }
      els.resultsEmpty.hidden = true;
      els.resultsContent.hidden = false;
      els.resultsSummary.textContent = summaryText || "";

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
          (r.savedPct != null
            ? ` (${Math.abs(r.savedPct).toFixed(0)}%)`
            : "");

        tr.innerHTML = `
          <td>
            <div>${escapeHtml(r.name)}</div>
            <small style="color:var(--ink-faint)">${escapeHtml(r.meta || "")}</small>
          </td>
          <td>${humanBytes(r.originalSize)}</td>
          <td>${humanBytes(r.outSize)}</td>
          <td class="${savedClass}">${savedText}</td>
          <td>${escapeHtml(String(r.detail ?? "—"))}</td>
          <td></td>`;

        const a = document.createElement("a");
        a.className = "btn btn-secondary btn-tiny";
        a.href = r.url;
        a.download = r.name;
        a.textContent = "Download";
        tr.lastElementChild.appendChild(a);
        els.resultsBody.appendChild(tr);
      }
    }

    async function runConvert() {
      if (!state.files.length || busy) return;
      busy = true;
      els.convertBtn.textContent = "Checking inputs…";
      syncFooter();
      state.results.forEach((r) => r.url && URL.revokeObjectURL(r.url));
      state.results = [];

      try {
        // Detect file / folder / ZIP, unzip ZIPs, then process images only
        const { images, stats } = await resolveProcessQueue(state.files);
        if (!images.length) {
          throw new Error(
            stats.zips
              ? "ZIP checked — no images found inside."
              : "No images found to process."
          );
        }

        els.convertBtn.textContent = "Working…";
        const { rows, summary } = await config.process(images);
        const sourceBits = [];
        if (stats.looseFiles) sourceBits.push(`${stats.looseFiles} file(s)`);
        if (stats.folderFiles) sourceBits.push(`${stats.folderFiles} folder file(s)`);
        if (stats.zips) {
          sourceBits.push(
            `${stats.zips} ZIP → ${stats.fromZip} image(s)`
          );
        }
        const sourceNote = sourceBits.length
          ? ` · sources: ${sourceBits.join(", ")}`
          : "";
        state.results = rows;
        renderResults((summary || "") + sourceNote);
        setStep("results");
      } catch (err) {
        alert(err.message || String(err));
      }

      busy = false;
      els.convertBtn.textContent = config.convertLabel || "Process";
      syncFooter();
    }

    document.querySelectorAll("[data-step-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const step = btn.dataset.stepBtn;
        if (step === "settings" && !state.files.length) return;
        if (step === "results" && !state.results.length) return;
        setStep(step);
      });
    });

    els.nextBtn.addEventListener("click", () => {
      if (state.step === "upload" && state.files.length) setStep("settings");
    });
    els.backBtn.addEventListener("click", () => {
      const idx = STEPS.indexOf(state.step);
      if (idx > 0) setStep(STEPS[idx - 1]);
    });
    els.convertBtn.addEventListener("click", () => runConvert());
    els.clearBtn.addEventListener("click", () => clearAll());
    els.downloadAllBtn.addEventListener("click", () => {
      const ok = state.results.filter((r) => r.ok && r.blob);
      zipDownload(
        ok.map((r) => ({ name: r.name, blob: r.blob })),
        config.zipName || "forgeimg.zip"
      );
    });

    bindDropzone(els.dropzone, els.fileInput, els.folderInput, setFiles);
    syncFooter();

    return { state, setStep, els };
  }

  function renderDropCount(dropzone, count, customText) {
    let el = dropzone.querySelector(".file-count");
    if (!count && !customText) {
      el?.remove();
      dropzone.classList.remove("has-files");
      return;
    }
    dropzone.classList.add("has-files");
    if (!el) {
      el = document.createElement("p");
      el.className = "file-count";
      dropzone.querySelector(".dropzone-inner")?.appendChild(el);
    }
    el.textContent =
      customText ||
      `${count} item${count === 1 ? "" : "s"} ready`;
  }

  window.ForgeIMG = {
    PRESETS,
    humanBytes,
    isImageFile,
    isZipFile,
    isFromFolder,
    escapeHtml,
    outName,
    supportsFormat,
    loadImage,
    canvasFromImage,
    canvasToBlob,
    encodeAtQuality,
    encodeToSize,
    downloadBlob,
    zipDownload,
    mergeFiles,
    summarizeQueue,
    resolveProcessQueue,
    expandIncoming,
    unzipToImages,
    bindDropzone,
    renderDropCount,
    createToolApp,
  };
})();


