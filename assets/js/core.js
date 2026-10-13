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
    return /\.(zip|lottie)$/i.test(file.name);
  }

  function sourceImageFormat(file) {
    if (!file) return null;
    const fromName = guessMime(file.name || "");
    const rawMime =
      fromName !== "application/octet-stream"
        ? fromName
        : String(file.type || "").toLowerCase();
    const mime = rawMime === "image/jpg" ? "image/jpeg" : rawMime;
    if (mime === "image/jpeg") {
      const ext = /\.jpeg$/i.test(file.name || "") ? "jpeg" : "jpg";
      return { mime, ext, label: "JPEG" };
    }
    if (mime === "image/png") return { mime, ext: "png", label: "PNG" };
    if (mime === "image/webp") return { mime, ext: "webp", label: "WebP" };
    return null;
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
      let target = canvas;
      // JPEG has no alpha. Composite onto white so transparent pixels
      // do not turn black.
      if (mime === "image/jpeg") {
        target = document.createElement("canvas");
        target.width = canvas.width;
        target.height = canvas.height;
        const ctx = target.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, target.width, target.height);
        ctx.drawImage(canvas, 0, 0);
      }
      const q = mime === "image/png" ? undefined : quality;
      target.toBlob(
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

  function encodePngLossless(canvas) {
    if (typeof UPNG === "undefined" || typeof UPNG.encode !== "function") {
      throw new Error("PNG optimizer failed to load. Refresh and try again.");
    }
    const ctx = canvas.getContext("2d");
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels = new Uint8Array(rgba);
    const buffer = UPNG.encode([pixels.buffer], canvas.width, canvas.height, 0);
    return {
      blob: new Blob([buffer], { type: "image/png" }),
      quality: 1,
    };
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
      zip.file(uniqueZipName(f.name, used), f.blob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, zipName || "forgeimg.zip");
  }

  function uniqueZipName(name, used) {
    const count = (used.get(name) || 0) + 1;
    used.set(name, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf(".");
    if (dot <= 0) return `${name}-${count}`;
    return `${name.slice(0, dot)}-${count}${name.slice(dot)}`;
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
        try {
          const fromZip = await unzipToImages(file);
          stats.fromZip += fromZip.length;
          if (!fromZip.length) stats.emptyZips = (stats.emptyZips || 0) + 1;
          images.push(...fromZip);
        } catch (err) {
          stats.zipErrors = (stats.zipErrors || 0) + 1;
          stats.zipErrorMessage = err.message || String(err);
        }
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

  function withRelativePath(file, rel) {
    if (!rel || rel === file.name) return file;
    try {
      Object.defineProperty(file, "webkitRelativePath", {
        value: rel,
        configurable: true,
      });
      return file;
    } catch {
      return file;
    }
  }

  function readAllEntries(reader) {
    return new Promise((resolve, reject) => {
      const all = [];
      const next = () => {
        reader.readEntries((batch) => {
          if (!batch.length) resolve(all);
          else {
            all.push(...batch);
            next();
          }
        }, reject);
      };
      next();
    });
  }

  async function walkEntry(entry, prefix, out) {
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      const rel = prefix ? `${prefix}/${file.name}` : file.name;
      out.push(withRelativePath(file, rel));
      return;
    }
    if (!entry.isDirectory) return;
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const children = await readAllEntries(entry.createReader());
    for (const child of children) {
      await walkEntry(child, nextPrefix, out);
    }
  }

  async function filesFromDataTransfer(dt) {
    const items = Array.from(dt?.items || []);
    const entries = items
      .map((item) => item.webkitGetAsEntry?.())
      .filter(Boolean);
    if (!entries.length) return Array.from(dt?.files || []);
    const out = [];
    for (const entry of entries) {
      await walkEntry(entry, "", out);
    }
    return out;
  }

  function bindDropzone(dropzone, fileInput, folderInput, onFiles) {
    const add = (list) => {
      if (list?.length) onFiles(list);
    };

    fileInput?.addEventListener("change", () => {
      add(fileInput.files);
      fileInput.value = "";
    });
    folderInput?.addEventListener("change", () => {
      add(folderInput.files);
      folderInput.value = "";
    });

    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => {
      if (e.target instanceof Node && dropzone.contains(e.target)) return;
      e.preventDefault();
    });

    const folderBtn = document.getElementById("folderPickBtn");
    folderBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      folderInput?.click();
    });

    dropzone.addEventListener("click", (e) => {
      if (e.target.closest("label") || e.target.closest("button")) return;
      fileInput?.click();
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
      filesFromDataTransfer(e.dataTransfer).then(add).catch(() => {
        add(e.dataTransfer?.files);
      });
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
      fileList: document.getElementById("fileList"),
      toolError: document.getElementById("toolError"),
      workStatus: document.getElementById("workStatus"),
    };

    let busy = false;

    const acceptFile = config.acceptFile || isAcceptableInput;
    const emptySummaryText =
      config.emptySummary || "No images selected yet.";

    function mergeAccepted(existing, fileList) {
      const incoming = Array.from(fileList || []).filter(acceptFile);
      const map = new Map(existing.map((f) => [fileKey(f), f]));
      for (const f of incoming) {
        map.set(fileKey(f), f);
      }
      return Array.from(map.values());
    }

    function queueLabel(files) {
      if (typeof config.queueLabel === "function") {
        return config.queueLabel(files);
      }
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

    function showError(msg) {
      if (!els.toolError) return;
      els.toolError.hidden = !msg;
      els.toolError.textContent = msg || "";
    }

    function showStatus(msg) {
      if (!els.workStatus) return;
      els.workStatus.hidden = !msg;
      els.workStatus.textContent = msg || "";
    }

    function updateSummary() {
      if (!els.fileSummary) return;
      if (!state.files.length) {
        els.fileSummary.textContent = emptySummaryText;
        return;
      }
      const total = state.files.reduce((s, f) => s + f.size, 0);
      const s = summarizeQueue(state.files);
      const zipNote = s.zips ? " · ZIP opens when you process" : "";
      els.fileSummary.textContent = `${queueLabel(state.files)} · ${humanBytes(
        total
      )}${zipNote}`;
    }

    function renderFileList() {
      if (!els.fileList) return;
      els.fileList.hidden = state.files.length === 0;
      els.fileList.replaceChildren();
      for (const file of state.files) {
        const li = document.createElement("li");
        const kind = isZipFile(file)
          ? "ZIP"
          : isImageFile(file)
            ? "Image"
            : "File";
        li.innerHTML = `
          <span class="file-list-name">${escapeHtml(file.name)}</span>
          <span class="file-list-meta">${kind} · ${humanBytes(file.size)}</span>`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "file-remove";
        btn.dataset.remove = fileKey(file);
        btn.setAttribute("aria-label", `Remove ${file.name}`);
        btn.textContent = "Remove";
        li.appendChild(btn);
        els.fileList.appendChild(li);
      }
    }

    function renderQueue() {
      renderDropCount(
        els.dropzone,
        state.files.length,
        state.files.length ? queueLabel(state.files) : ""
      );
      updateSummary();
      renderFileList();
      syncFooter();
      config.onFilesChanged?.(state.files);
    }

    function setFiles(list) {
      if (!list?.length || busy) return;
      const incoming = Array.from(list).filter(acceptFile);
      if (!incoming.length) {
        showError(
          config.rejectMessage || "No supported images or ZIP files found."
        );
        return;
      }
      showError("");
      state.files = mergeAccepted(state.files, incoming);
      renderQueue();
    }

    function syncFooter() {
      const idx = STEPS.indexOf(state.step);
      const hasFiles = state.files.length > 0;
      const okCount = state.results.filter((r) => r.ok).length;
      const hasAnyWork = hasFiles || state.results.length > 0;

      els.clearBtn.hidden = !hasAnyWork;
      els.backBtn.hidden = idx === 0;
      els.nextBtn.hidden = state.step !== "upload";
      els.convertBtn.hidden = state.step !== "settings";
      els.downloadAllBtn.hidden = state.step !== "results";

      els.clearBtn.disabled = busy;
      els.backBtn.disabled = busy;
      els.nextBtn.disabled = !hasFiles || busy;
      els.convertBtn.disabled = !hasFiles || busy;
      els.downloadAllBtn.disabled = okCount === 0 || busy;
      els.downloadAllBtn.textContent = okCount === 1 ? "Download" : "Download ZIP";
      els.dropzone?.classList.toggle("is-busy", busy);

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
      els.resultsBody.replaceChildren();
      els.resultsEmpty.hidden = false;
      els.resultsContent.hidden = true;
      showError("");
      showStatus("");
      renderDropCount(els.dropzone, 0);
      updateSummary();
      renderFileList();
      setStep("upload");
      config.onClear?.();
    }

    function renderResults(summaryText) {
      els.resultsBody.replaceChildren();
      if (!state.results.length) {
        els.resultsEmpty.hidden = false;
        els.resultsContent.hidden = true;
        return;
      }
      els.resultsEmpty.hidden = true;
      els.resultsContent.hidden = false;
      els.resultsSummary.textContent = summaryText || "";

      for (const r of state.results) {
        const li = document.createElement("li");
        li.className = "result-card";
        if (!r.ok) {
          li.innerHTML = `
            <div class="result-copy">
              <p class="result-name">${escapeHtml(r.originalName)}</p>
              <p class="result-meta status-err">${escapeHtml(r.error)}</p>
            </div>`;
          els.resultsBody.appendChild(li);
          continue;
        }

        const savedClass = r.saved > 0 ? "saved-pos" : r.saved < 0 ? "saved-neg" : "";
        const savedText =
          r.saved === 0
            ? "No reduction"
            : (r.saved > 0 ? "−" : "+") +
              humanBytes(Math.abs(r.saved)) +
              (r.savedPct != null
                ? ` (${Math.abs(r.savedPct).toFixed(0)}%)`
                : "");
        const meta = [r.meta, r.detail].filter(Boolean).join(" · ");

        li.innerHTML = `
          <div class="result-copy">
            <p class="result-name">${escapeHtml(r.name)}</p>
            <p class="result-meta">${escapeHtml(meta)}</p>
            <p class="result-sizes">
              <span>${humanBytes(r.originalSize)} → ${humanBytes(r.outSize)}</span>
              <span class="${savedClass}">${savedText}</span>
            </p>
          </div>`;

        const a = document.createElement("a");
        a.className = "btn btn-secondary btn-tiny";
        a.href = r.url;
        a.download = r.name;
        a.textContent = "Download";
        li.appendChild(a);
        els.resultsBody.appendChild(li);
      }
    }

    function sourceNoteFrom(stats) {
      if (stats?.note) return ` · ${stats.note}`;
      const sourceBits = [];
      if (stats?.looseFiles) {
        sourceBits.push(
          `${stats.looseFiles} file${stats.looseFiles === 1 ? "" : "s"}`
        );
      }
      if (stats?.folderFiles) {
        sourceBits.push(
          `${stats.folderFiles} from folder`
        );
      }
      if (stats?.zips) {
        sourceBits.push(
          `${stats.zips} ZIP → ${stats.fromZip} image${stats.fromZip === 1 ? "" : "s"}`
        );
      }
      if (stats?.zipErrors) {
        sourceBits.push(
          `${stats.zipErrors} ZIP could not be read`
        );
      }
      return sourceBits.length ? ` · ${sourceBits.join(", ")}` : "";
    }

    async function runConvert() {
      if (!state.files.length || busy) return;
      busy = true;
      showError("");
      els.convertBtn.textContent = "Checking files…";
      syncFooter();
      state.results.forEach((r) => r.url && URL.revokeObjectURL(r.url));
      state.results = [];

      try {
        let items;
        let stats;
        if (typeof config.resolveQueue === "function") {
          ({ items, stats } = await config.resolveQueue(state.files));
        } else {
          const resolved = await resolveProcessQueue(state.files);
          items = resolved.images;
          stats = resolved.stats;
        }
        if (!items?.length) {
          throw new Error(
            stats?.zipErrorMessage ||
              (typeof config.emptyQueueError === "function"
                ? config.emptyQueueError(stats)
                : null) ||
              (stats?.zips
                ? "No images were found in that ZIP."
                : "No images found to process.")
          );
        }

        showStatus(`Working… 0 of ${items.length}`);
        els.convertBtn.textContent = "Working…";
        const report = (index, total, label) => {
          const n = index + 1;
          els.convertBtn.textContent = `${n} / ${total}`;
          showStatus(label ? `${label} · ${n} of ${total}` : `Working… ${n} of ${total}`);
        };
        const { rows, summary } = await config.process(items, report);
        state.results = rows;
        renderResults((summary || "") + sourceNoteFrom(stats));
        showStatus("");
        setStep("results");
      } catch (err) {
        showStatus("");
        showError(err.message || String(err));
      }

      busy = false;
      els.convertBtn.textContent =
        typeof config.convertLabel === "function"
          ? config.convertLabel()
          : config.convertLabel || "Process";
      syncFooter();
    }

    document.querySelectorAll("[data-step-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (busy) return;
        const step = btn.dataset.stepBtn;
        if (step === "settings" && !state.files.length) return;
        if (step === "results" && !state.results.length) return;
        showError("");
        setStep(step);
      });
    });

    els.fileList?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove]");
      if (!btn || busy) return;
      state.files = state.files.filter((f) => fileKey(f) !== btn.dataset.remove);
      showError("");
      renderQueue();
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
      if (!ok.length) return;
      if (ok.length === 1) {
        downloadBlob(ok[0].blob, ok[0].name);
        return;
      }
      const zipName =
        typeof config.zipName === "function"
          ? config.zipName()
          : config.zipName || "forgeimg.zip";
      zipDownload(
        ok.map((r) => ({ name: r.name, blob: r.blob })),
        zipName
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
    sourceImageFormat,
    isFromFolder,
    escapeHtml,
    outName,
    supportsFormat,
    loadImage,
    canvasFromImage,
    canvasToBlob,
    encodeAtQuality,
    encodePngLossless,
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


