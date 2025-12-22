// assets/js/nav.js
(function () {

  // Calcule la base du site automatiquement (utile sur GitHub Pages avec /repo/)
  function getBasePath() {
    const parts = location.pathname.split("/").filter(Boolean);

    // Cas GitHub Pages: https://username.github.io/repo/...
    // => le 1er segment est le nom du repo
    if (location.hostname.endsWith("github.io") && parts.length > 0) {
      return "/" + parts[0];
    }

    // Cas domaine custom ou user page: https://username.github.io/ (pas de /repo)
    return "";
  }

  const BASE = getBasePath();

  // Définis ici toutes tes pages (liens ABSOLUS via BASE)
  const NAV_ITEMS = [
    { label: "Accueil", href: `${BASE}/index.html`, key: "index" },
    { label: "Joaillerie", href: `${BASE}/pages/joaillerie.html`, key: "joaillerie" },
    { label: "Raids", href: `${BASE}/pages/raid.html`, key: "raid" },
    { label: "Décompte", href: `${BASE}/pages/decompte.html`, key: "decompte" },
  ];

  // Brand => Accueil
  const brandHref = `${BASE}/index.html`;

  // Construit la navbar
  const nav = document.createElement("nav");
  nav.className = "navbar";
  nav.innerHTML = `
    <div class="navbar-inner">
      <a class="nav-brand" href="${brandHref}">Home</a>
      <button class="nav-toggle" id="nav-toggle" aria-label="Ouvrir le menu">Menu</button>
      <div class="nav-links" id="nav-links">
        ${NAV_ITEMS.map(i => `<a href="${i.href}" data-nav="${i.key}">${i.label}</a>`).join("")}
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

  // Pages simples
  const map = {
    "index.html": "index",
    "joaillerie.html": "joaillerie",
    "raid.html": "raid",
    "decompte.html": "decompte",
  };

  // Si on est dans /pages/raids/* => onglet "Raids" actif
  const isRaidDetail = location.pathname.includes("/pages/raids/");

  const activeKey = isRaidDetail ? "raid" : map[file];

  if (activeKey) {
    document.querySelectorAll(".nav-links a").forEach(a => {
      if (a.dataset.nav === activeKey) a.classList.add("active");
    });
  }
})();
