(function () {
  var section = document.querySelector(".ai-hero-section");
  if (!section) {
    section = document.createElement("div");
    section.className = "ai-hero-section";
    section.setAttribute("aria-hidden", "true");
    var canvasEl = document.createElement("canvas");
    canvasEl.className = "ai-hero-network";
    section.appendChild(canvasEl);
    document.body.prepend(section);
  }

  var canvas = section.querySelector(".ai-hero-network");
  var canvasContext = canvas && canvas.getContext("2d");
  if (!canvasContext) return;

  var rootStyle = getComputedStyle(document.documentElement);
  function token(name, fallback) {
    var value = rootStyle.getPropertyValue(name).trim();
    return value || fallback;
  }
  var DOT_COLOR = token("--net-dot", "rgba(255, 255, 255, 0.7)");
  var LINE_RGB = token("--net-line", "255, 255, 255");
  var LINE_ALPHA = parseFloat(token("--net-line-alpha", "0.16"));
  var CURSOR_ALPHA = parseFloat(token("--net-cursor-alpha", "0.4"));
  var DENSITY = parseFloat(token("--net-density", "16000"));
  var CONNECT_DISTANCE = parseFloat(token("--net-distance", "120"));
  var MAX_LINKS_PER_DOT = 3;
  var CURSOR_NEAREST = 8;
  var CURSOR_DISTANCE = 180;
  var desktopQuery = window.matchMedia("(min-width: 1024px)");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var width = 0;
  var height = 0;
  var dots = [];
  var mouse = { x: 0, y: 0, active: false };
  var animationId = 0;
  var isVisible = false;

  function createDots() {
    var count = Math.round(Math.min(90, Math.max(70, (width * height) / DENSITY)));
    dots = [];
    for (var i = 0; i < count; i++) {
      dots.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        radius: Math.random() * 1 + 0.8
      });
    }
  }

  function resize() {
    var pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = section.offsetWidth;
    height = section.offsetHeight;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    createDots();
    draw();
  }

  function drawLine(x1, y1, x2, y2, opacity, lineWidth) {
    canvasContext.strokeStyle = "rgba(" + LINE_RGB + ", " + opacity + ")";
    canvasContext.lineWidth = lineWidth;
    canvasContext.beginPath();
    canvasContext.moveTo(x1, y1);
    canvasContext.lineTo(x2, y2);
    canvasContext.stroke();
  }

  function draw() {
    canvasContext.clearRect(0, 0, width, height);
    canvasContext.setLineDash([2, 5]);

    for (var i = 0; i < dots.length; i++) {
      var links = 0;
      for (var j = i + 1; j < dots.length && links < MAX_LINKS_PER_DOT; j++) {
        var dx = dots[i].x - dots[j].x;
        var dy = dots[i].y - dots[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= CONNECT_DISTANCE) continue;
        drawLine(dots[i].x, dots[i].y, dots[j].x, dots[j].y, LINE_ALPHA / 2 + (1 - dist / CONNECT_DISTANCE) * LINE_ALPHA, 1);
        links++;
      }
    }

    if (mouse.active) {
      canvasContext.setLineDash([3, 5]);
      dots
        .map(function (dot) {
          var dx = dot.x - mouse.x;
          var dy = dot.y - mouse.y;
          return { dot: dot, dist: Math.sqrt(dx * dx + dy * dy) };
        })
        .sort(function (a, b) {
          return a.dist - b.dist;
        })
        .slice(0, CURSOR_NEAREST)
        .forEach(function (item) {
          if (item.dist > CURSOR_DISTANCE) return;
          drawLine(mouse.x, mouse.y, item.dot.x, item.dot.y, CURSOR_ALPHA * 0.75 + (1 - item.dist / CURSOR_DISTANCE) * CURSOR_ALPHA, 1.2);
        });
    }

    canvasContext.setLineDash([]);
    canvasContext.fillStyle = DOT_COLOR;
    dots.forEach(function (dot) {
      canvasContext.beginPath();
      canvasContext.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
      canvasContext.fill();
    });
  }

  function moveDots() {
    dots.forEach(function (dot) {
      dot.x += dot.vx;
      dot.y += dot.vy;
      if (dot.x < 0 || dot.x > width) dot.vx *= -1;
      if (dot.y < 0 || dot.y > height) dot.vy *= -1;
    });
  }

  function tick() {
    moveDots();
    draw();
    animationId = requestAnimationFrame(tick);
  }

  function start() {
    if (animationId || reducedMotion.matches || !desktopQuery.matches || !isVisible) return;
    animationId = requestAnimationFrame(tick);
  }

  function stop() {
    if (!animationId) return;
    cancelAnimationFrame(animationId);
    animationId = 0;
  }

  var LIGHT_SURFACES = ".panel, .privacy-promise";
  var INTERACTIVE = "a, button, label, input, select, textarea, [role='button']";
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  var cursorDot = null;
  var cursorRing = null;
  var ringX = 0;
  var ringY = 0;
  var pointerX = 0;
  var pointerY = 0;
  var cursorFrame = 0;

  function setupCursor() {
    if (!finePointer.matches || cursorDot) return;
    cursorDot = document.createElement("div");
    cursorDot.className = "cursor-dot";
    cursorRing = document.createElement("div");
    cursorRing.className = "cursor-ring";
    cursorDot.setAttribute("aria-hidden", "true");
    cursorRing.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursorRing);
    document.body.appendChild(cursorDot);
    document.body.classList.add("has-custom-cursor");
  }

  function followRing() {
    var ease = reducedMotion.matches ? 1 : 0.2;
    ringX += (pointerX - ringX) * ease;
    ringY += (pointerY - ringY) * ease;
    cursorRing.style.transform = "translate3d(" + ringX + "px, " + ringY + "px, 0)";
    if (Math.abs(pointerX - ringX) > 0.1 || Math.abs(pointerY - ringY) > 0.1) {
      cursorFrame = requestAnimationFrame(followRing);
    } else {
      cursorFrame = 0;
    }
  }

  function showCursor(visible) {
    document.body.classList.toggle("cursor-hidden", visible);
    cursorDot.classList.toggle("is-visible", visible);
    cursorRing.classList.toggle("is-visible", visible);
  }

  setupCursor();

  document.addEventListener("mousemove", function (event) {
    var onLight = !!(event.target.closest && event.target.closest(LIGHT_SURFACES));

    if (cursorDot) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!cursorDot.classList.contains("is-visible")) {
        ringX = pointerX;
        ringY = pointerY;
      }
      cursorDot.style.transform = "translate3d(" + pointerX + "px, " + pointerY + "px, 0)";
      showCursor(!onLight);
      cursorRing.classList.toggle("is-hovering", !onLight && !!event.target.closest(INTERACTIVE));
      if (!cursorFrame) cursorFrame = requestAnimationFrame(followRing);
    }

    if (reducedMotion.matches || !desktopQuery.matches) return;
    var rect = section.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.active = !onLight;
  });

  document.addEventListener("mouseleave", function () {
    mouse.active = false;
    if (cursorDot) showCursor(false);
  });

  document.addEventListener("mousedown", function () {
    if (cursorRing) cursorRing.classList.add("is-pressed");
  });

  document.addEventListener("mouseup", function () {
    if (cursorRing) cursorRing.classList.remove("is-pressed");
  });

  window.addEventListener("resize", function () {
    if (!desktopQuery.matches) {
      stop();
      canvasContext.clearRect(0, 0, width, height);
      return;
    }
    resize();
    start();
  });

  if (desktopQuery.matches) resize();
  requestAnimationFrame(function () {
    section.classList.add("is-ready");
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      isVisible = entries[0].isIntersecting;
      if (isVisible) {
        start();
      } else {
        stop();
      }
    }).observe(section);
  } else {
    isVisible = true;
    start();
  }
})();
