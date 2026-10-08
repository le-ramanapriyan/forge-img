/**
 * Shared inline right-panel workspace for ForgeIMG tool pages.
 * Call ForgeIMGToolShell.mount({ title, settingsHtml, convertLabel })
 */
(() => {
  "use strict";

  function mount(options) {
    const root = document.getElementById("tool-workspace");
    if (!root) return;

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
        <section class="step-view is-active" data-step="upload">
          <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Drop images or choose files">
            <div class="dropzone-inner">
              <div class="drop-icon" aria-hidden="true">↑</div>
              <p class="dropzone-title">Drop files, folder, or ZIP</p>
              <p class="dropzone-hint">PNG, JPEG, GIF, WebP, ZIP · process detects type</p>
              <div class="dropzone-actions">
                <label class="btn btn-primary">
                  Select images
                  <input
                    id="fileInput"
                    type="file"
                    accept="image/*,.zip,application/zip,application/x-zip-compressed"
                    multiple
                    hidden
                  />
                </label>
                <input
                  id="folderInput"
                  type="file"
                  accept="image/*"
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
        </section>

        <section class="step-view" data-step="settings">
          <div class="settings-stack">
            ${options.settingsHtml}
            <div class="settings-note" id="fileSummary">No images selected yet.</div>
          </div>
        </section>

        <section class="step-view" data-step="results" id="resultsSection">
          <div class="results-empty" id="resultsEmpty">
            <p>Process images to see results here.</p>
          </div>
          <div class="results-content" id="resultsContent" hidden>
            <p class="results-summary" id="resultsSummary"></p>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Original</th>
                    <th>Output</th>
                    <th>Saved</th>
                    <th>Detail</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="resultsBody"></tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <footer class="modal-footer workspace-footer">
        <button type="button" class="btn btn-secondary" id="clearBtn" hidden>Clear</button>
        <div class="footer-right">
          <button type="button" class="btn btn-secondary" id="backBtn" hidden>Back</button>
          <button type="button" class="btn btn-secondary" id="downloadAllBtn" hidden>Download ZIP</button>
          <button type="button" class="btn btn-primary" id="nextBtn" hidden>Continue</button>
          <button type="button" class="btn btn-primary" id="convertBtn" hidden>
            ${options.convertLabel || "Process"}
          </button>
        </div>
      </footer>
    </aside>`;
  }

  window.ForgeIMGToolShell = { mount };
})();
