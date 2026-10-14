(() => {
  "use strict";

  const TOOLS = [
    { id: "compress", label: "Compress", href: "compress/" },
    { id: "convert", label: "Convert", href: "convert/" },
    { id: "resize", label: "Resize", href: "resize/" },
    { id: "crop", label: "Crop", href: "crop/" },
    { id: "lottie", label: "Lottie fallback", href: "lottie/" },
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

    const headerMount = document.getElementById("site-header");
    const footerMount = document.getElementById("site-footer");
    if (!headerMount || !footerMount) return;

    const links = (activeClass) =>
      TOOLS.map((t) => {
        const current = activeClass && t.id === active;
        return `<a href="${resolve(t.href)}"${
          current ? ' class="is-active" aria-current="page"' : ""
        }>${t.label}</a>`;
      }).join("");

    headerMount.innerHTML = `
      <a class="brand-link" href="${resolve("index.html")}">ForgeIMG</a>
      <nav class="header-nav" aria-label="Tools">${links(true)}</nav>
      <p class="privacy-indicator">
        <img class="icon" src="${resolve("assets/icons/shield-check-16.svg")}" width="16" height="16" alt="" />
        On-device only
      </p>
    `;

    footerMount.innerHTML = `
      <div class="footer-content">
        <div class="footer-brand">
          <p class="footer-brand-name">ForgeIMG</p>
          <p class="body-muted">On-device image tools by RAMANAPRIYAN M R V.</p>
        </div>
        <nav class="footer-links" aria-label="Footer tools">${links(false)}</nav>
      </div>
      <hr class="hairline" />
      <div class="footer-notes">
        <p>Your files never leave your browser.</p>
        <p>Made to keep things simple.</p>
      </div>
    `;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectChrome);
  } else {
    injectChrome();
  }
})();
