(() => {
  "use strict";

  const TOOLS = [
    { id: "compress", label: "Compress", href: "compress/" },
    { id: "convert-webp", label: "WebP", href: "convert-webp/" },
    { id: "resize", label: "Resize", href: "resize/" },
    { id: "crop", label: "Crop", href: "crop/" },
  ];

  function basePrefix() {
    const tool = document.body.dataset.tool;
    // Tool pages live one level under private-repo/ (e.g. compress/)
    return tool && tool !== "home" ? "../" : "";
  }

  function resolve(path) {
    return basePrefix() + path;
  }

  function injectChrome() {
    const active = document.body.dataset.tool || "home";
    const year = new Date().getFullYear();

    const headerMount = document.getElementById("site-header");
    const footerMount = document.getElementById("site-footer");
    if (!headerMount || !footerMount) return;

    const nav = TOOLS.map((t) => {
      const href = resolve(t.href);
      const cls = t.id === active ? "is-active" : "";
      return `<a href="${href}" class="${cls}">${t.label}</a>`;
    }).join("");

    headerMount.innerHTML = `
      <a class="brand-link" href="${resolve("index.html")}">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>
          <p class="brand-name">ForgeIMG</p>
          <p class="brand-tag">On-device image tools</p>
        </span>
      </a>
      <nav class="header-nav" aria-label="Tools">${nav}</nav>
      <p class="header-author">RAMANAPRIYAN M R V</p>
    `;

    const footLinks = TOOLS.map(
      (t) => `<a href="${resolve(t.href)}">${t.label}</a>`
    ).join("");

    footerMount.innerHTML = `
      <div class="footer-grid">
        <div>
          <strong style="color:var(--ink-on-dark)">ForgeIMG</strong>
          <div class="footer-links" style="margin-top:0.55rem">${footLinks}</div>
        </div>
        <div>
          <a href="${resolve("index.html")}">Home</a>
        </div>
      </div>
      <p class="footer-note">
        Processing stays on your device. Files are never uploaded to a server.
      </p>
      <p class="footer-copy">© ${year} RAMANAPRIYAN M R V · ForgeIMG</p>
    `;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectChrome);
  } else {
    injectChrome();
  }
})();
