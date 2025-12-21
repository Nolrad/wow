// assets/js/nav.js
(function () {
  // Définis ici toutes tes pages
  const NAV_ITEMS = [
    { label: "Accueil", href: "../index.html", key: "index" },
    { label: "Joaillerie", href: "./joaillerie.html", key: "joaillerie" },
    { label: "Décompte", href: "./decompte.html", key: "decompte" },
  ];

  // Détecte si on est dans /pages/ ou à la racine
  // - Dans /pages/* : index est ../index.html, assets sont ../assets/...
  // - À la racine : index est ./index.html, pages sont ./pages/...
  const isInPagesFolder = location.pathname.includes("/pages/");
  const brandHref = isInPagesFolder ? "../index.html" : "./index.html";

  // Corrige les href selon la page courante
  const items = NAV_ITEMS.map(it => {
    if (isInPagesFolder) return it; // déjà bon
    // On est à la racine (index.html), donc on doit pointer vers ./pages/...
    const href = (it.key === "index") ? "./index.html" : "./pages/" + it.href.replace("./", "");
    return { ...it, href };
  });

  // Construit la navbar
  const nav = document.createElement("nav");
  nav.className = "navbar";
  nav.innerHTML = `
    <div class="navbar-inner">
      <a class="nav-brand" href="${brandHref}">Home</a>
      <button class="nav-toggle" id="nav-toggle" aria-label="Ouvrir le menu">Menu</button>
      <div class="nav-links" id="nav-links">
        ${items.map(i => `<a href="${i.href}" data-nav="${i.key}">${i.label}</a>`).join("")}
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
    "decompte.html": "decompte",
  };
  const activeKey = map[file];

  if (activeKey) {
    document.querySelectorAll(".nav-links a").forEach(a => {
      if (a.dataset.nav === activeKey) a.classList.add("active");
    });
  }
})();
