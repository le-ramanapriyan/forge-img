/**
 * Shared workspace for ForgeIMG tool pages: three stacked panels
 * (add files, adjust settings, download) and a dark progress rail.
 * Call ForgeIMGToolShell.mount({ title, settingsHtml, convertLabel, ... })
 */
(() => {
  "use strict";

  const ICONS = "../assets/icons/";

  function icon(name, size) {
    return `<img class="icon" src="${ICONS}${name}" width="${size}" height="${size}" alt="" />`;
  }

  function mount(options) {
    const root = document.getElementById("tool-workspace");
    if (!root) return;

    const accept =
      options.accept ||
      "image/*,.zip,application/zip,application/x-zip-compressed";
    const folderAccept = options.folderAccept || "image/*";
    const dropTitle = options.dropTitle || "Drop an image here";
    const dropHint = options.dropHint || "JPEG · PNG · WebP · Folder · ZIP";
    const dropIcon = options.dropIcon || "upload-32-dark.svg";
    const selectLabel = options.selectLabel || "Choose image";
    const dropAria = options.dropAria || "Drop images or choose files";
    const emptySummary = options.emptySummary || "No files selected";
    const resultsEmpty =
      options.resultsEmpty || "Your processed files will appear here.";
    const uploadNote = options.uploadNote
      ? `<p class="panel-copy">${options.uploadNote}</p>`
      : "";
    const steps = Object.assign(
      {
        upload: "Choose an image, folder, or ZIP.",
        settings: "Choose your settings.",
        results: "Save your output to your device.",
      },
      options.steps
    );

    root.className = "tool-workspace";
    root.innerHTML = `
    <div class="working-area" aria-label="${options.title} workspace">
      <h2 class="sr-only" id="modalTitle">${options.title}</h2>

      <section class="panel step-view is-active" data-step="upload">
        <h3 class="panel-title">1. Add your files</h3>
        <div class="dropzone" id="dropzone" aria-label="${dropAria}">
          <div class="dropzone-inner">
            ${icon(dropIcon, 32)}
            <p class="dropzone-title">${dropTitle}</p>
            <p class="dropzone-hint">${dropHint}</p>
            <div class="dropzone-actions">
              <label class="btn btn-primary btn-wide">
                ${selectLabel}
                <input id="fileInput" type="file" accept="${accept}" multiple hidden />
              </label>
              <button type="button" class="btn btn-secondary btn-md" id="folderPickBtn">
                Choose folder
              </button>
              <label class="btn btn-secondary btn-md" for="fileInput">Open ZIP</label>
              <input
                id="folderInput"
                type="file"
                accept="${folderAccept}"
                multiple
                webkitdirectory
                directory
                hidden
              />
            </div>
          </div>
        </div>
        <ul class="file-list" id="fileList" hidden></ul>
        <p class="tool-error" id="toolError" role="alert" hidden></p>
        <div class="input-status">
          <p>
            <span id="fileSummary" aria-live="polite">${emptySummary}</span>
            <button type="button" class="btn-text" id="clearBtn" hidden>Clear</button>
          </p>
          <p class="assurance">
            ${icon("shield-check-16-dark.svg", 16)}
            Files never leave your browser
          </p>
        </div>
        ${uploadNote}
      </section>

      <section class="panel step-view" data-step="settings">
        <h3 class="panel-title">2. Adjust settings</h3>
        <div class="settings-stack">
          ${options.settingsHtml}
        </div>
        <div class="panel-rule" aria-hidden="true"></div>
        <div class="action-row">
          <button type="button" class="btn btn-primary btn-wide" id="convertBtn" disabled>
            ${options.convertLabel || "Process"}
          </button>
          <div class="panel-copy">
            <p class="work-status" id="workStatus" aria-live="polite" hidden></p>
            <p class="process-hint" data-when="empty">Add files to enable processing.</p>
            <p class="process-hint" data-when="ready">Ready when you are.</p>
          </div>
          <button type="button" class="btn btn-secondary" id="backBtn" hidden>Back</button>
          <button type="button" class="btn btn-secondary" id="nextBtn" hidden>Continue</button>
        </div>
      </section>

      <section class="panel step-view" data-step="results" id="resultsSection">
        <h3 class="panel-title">3. Download your output</h3>
        <div class="output-row">
          <div class="output-empty" id="resultsEmpty">
            ${icon("download-24-dark.svg", 24)}
            <div class="output-guidance">
              <p class="title-20">No output yet</p>
              <p class="panel-copy">${resultsEmpty}</p>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-md" id="downloadAllBtn" disabled>
            Download all
          </button>
        </div>
        <div class="results-content" id="resultsContent" hidden>
          <p class="results-summary" id="resultsSummary" aria-live="polite"></p>
          <ul class="result-list" id="resultsBody"></ul>
        </div>
      </section>
    </div>

    <aside class="rail" aria-label="Progress">
      <div class="rail-card">
        <p class="eyebrow">Your workspace</p>
        <nav class="rail-steps" aria-label="Steps">
          <button type="button" class="rail-step is-active" data-step-btn="upload">
            <span class="rail-marker">1</span>
            <span class="rail-step-copy">
              <span class="rail-step-title">Add files</span>
              <span class="rail-step-text">${steps.upload}</span>
            </span>
          </button>
          <button type="button" class="rail-step" data-step-btn="settings">
            <span class="rail-marker">2</span>
            <span class="rail-step-copy">
              <span class="rail-step-title">Adjust settings</span>
              <span class="rail-step-text">${steps.settings}</span>
            </span>
          </button>
          <button type="button" class="rail-step" data-step-btn="results">
            <span class="rail-marker">3</span>
            <span class="rail-step-copy">
              <span class="rail-step-title">Process &amp; download</span>
              <span class="rail-step-text">${steps.results}</span>
            </span>
          </button>
        </nav>
        <hr class="hairline" />
        <div class="rail-status">
          <p class="eyebrow">Current state</p>
          <p class="rail-status-value" id="workspaceState" aria-live="polite">Awaiting files</p>
        </div>
      </div>
      <div class="privacy-card">
        ${icon("shield-check-24.svg", 24)}
        <p class="title-20">On your device.</p>
        <p>Nothing is uploaded. Processing happens in your browser, and you choose what to download.</p>
      </div>
    </aside>`;
  }

  window.ForgeIMGToolShell = { mount };
})();
