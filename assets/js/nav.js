// assets/js/nav.js
(function () {
  "use strict";

  // ✅ Base GitHub Pages: /<repo>/
  // Ex: https://nolrad.github.io/wow/  -> base = "/wow/"
  // Si tu changes le nom du repo, adapte ce bout-là.
  const REPO_NAME = "wow";
  const BASE = `/${REPO_NAME}/`;

  // ✅ Définis ici toutes tes pages (chemins depuis BASE)
  const NAV_ITEMS = [
    { label: "Accueil", href: "index.html", key: "index" },
    { label: "Joaillerie", href: "pages/joaillerie.html", key: "joaillerie" },
    { label: "Raids", href: "pages/raid.html", key: "raid" },
    { label: "Décompte", href: "pages/decompte.html", key: "decompte" },
    { label: "Loot Tracker", href: "pages/loot_tracker.html", key: "loot_tracker" },
  ];

  // Construit la navbar (liens ABSOLUS via BASE)
  const nav = document.createElement("nav");
  nav.className = "navbar";
  nav.innerHTML = `
    <div class="navbar-inner">
      <a class="nav-brand" href="${BASE}index.html">Home</a>
      <button class="nav-toggle" id="nav-toggle" aria-label="Ouvrir le menu">Menu</button>
      <div class="nav-links" id="nav-links">
        ${NAV_ITEMS.map(i => `<a href="${BASE}${i.href}" data-nav="${i.key}">${i.label}</a>`).join("")}
      </div>
    </div>
  `;

  // Injecte en tout premier dans le body
  document.body.insertBefore(nav, document.body.firstChild);

  // Menu mobile
  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  // Active link (en fonction du fichier)
  const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const map = {
    "index.html": "index",
    "joaillerie.html": "joaillerie",
    "raid.html": "raid",
    "decompte.html": "decompte",
    "loot_tracker.html": "loot_tracker",
  };
  const activeKey = map[file];

  if (activeKey) {
    document.querySelectorAll(".nav-links a").forEach((a) => {
      if (a.dataset.nav === activeKey) a.classList.add("active");
    });
  }
})();
