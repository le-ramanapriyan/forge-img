/**
 * Shared inline right-panel workspace for ForgeIMG tool pages.
 * Call ForgeIMGToolShell.mount({ title, settingsHtml, convertLabel })
 */
(() => {
  "use strict";

  function mount(options) {
    const root = document.getElementById("tool-workspace");
    if (!root) return;

    const accept =
      options.accept ||
      "image/*,.zip,application/zip,application/x-zip-compressed";
    const folderAccept = options.folderAccept || "image/*";
    const dropHint =
      options.dropHint || "JPEG, PNG, WebP, GIF, a folder, or a ZIP";
    const selectLabel = options.selectLabel || "Select images";
    const dropAria =
      options.dropAria || "Drop images or choose files";
    const emptySummary = options.emptySummary || "No images selected yet.";
    const resultsEmpty =
      options.resultsEmpty || "Processed files will show up here.";

    root.innerHTML = `
    <aside class="workspace-panel" aria-label="${options.title} workspace">
      <header class="modal-header workspace-header">
        <div>
          <p class="modal-kicker">Workspace</p>
          <h2 id="modalTitle">${options.title}</h2>
        </div>
      </header>

      <nav class="steps" aria-label="Progress">
        <button type="button" class="step is-active" data-step-btn="upload">
          <span class="step-num">1</span> Upload
        </button>
        <button type="button" class="step" data-step-btn="settings">
          <span class="step-num">2</span> Options
        </button>
        <button type="button" class="step" data-step-btn="results">
          <span class="step-num">3</span> Results
        </button>
      </nav>

      <div class="modal-body workspace-body">
        <p class="tool-error" id="toolError" role="alert" hidden></p>
        <p class="work-status" id="workStatus" aria-live="polite" hidden></p>
        <section class="step-view is-active" data-step="upload">
          <div class="dropzone" id="dropzone" aria-label="${dropAria}">
            <div class="dropzone-inner">
              <div class="drop-icon" aria-hidden="true">↑</div>
              <p class="dropzone-title">Drop files, a folder, or a ZIP</p>
              <p class="dropzone-hint">${dropHint}</p>
              <div class="dropzone-actions">
                <label class="btn btn-primary">
                  ${selectLabel}
                  <input
                    id="fileInput"
                    type="file"
                    accept="${accept}"
                    multiple
                    hidden
                  />
                </label>
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
              <button type="button" class="linkish" id="folderPickBtn">
                or select a folder
              </button>
            </div>
          </div>
          <ul class="file-list" id="fileList" hidden></ul>
        </section>

        <section class="step-view" data-step="settings">
          <div class="settings-stack">
            ${options.settingsHtml}
            <div class="settings-note" id="fileSummary" aria-live="polite">${emptySummary}</div>
          </div>
        </section>

        <section class="step-view" data-step="results" id="resultsSection">
          <div class="results-empty" id="resultsEmpty">
            <p>${resultsEmpty}</p>
          </div>
          <div class="results-content" id="resultsContent" hidden>
            <p class="results-summary" id="resultsSummary" aria-live="polite"></p>
            <ul class="result-list" id="resultsBody"></ul>
          </div>
        </section>
      </div>

      <footer class="modal-footer workspace-footer">
        <button type="button" class="btn btn-secondary" id="clearBtn" hidden>Clear</button>
        <div class="footer-right">
          <button type="button" class="btn btn-secondary" id="backBtn" hidden>Back</button>
          <button type="button" class="btn btn-secondary" id="downloadAllBtn" hidden>Download ZIP</button>
          <button type="button" class="btn btn-primary" id="nextBtn">Continue</button>
          <button type="button" class="btn btn-primary" id="convertBtn" hidden>
            ${options.convertLabel || "Process"}
          </button>
        </div>
      </footer>
    </aside>`;
  }

  window.ForgeIMGToolShell = { mount };
})();
