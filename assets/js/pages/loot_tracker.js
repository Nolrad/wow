(function () {
  "use strict";

  // ==========================
  // Constants & state
  // ==========================
  const LT_PAYLOADS_KEY = "LT_PAYLOADS_V3"; // payloads normalisés (shared + imports)
  let ALL_ROWS = []; // rows aplaties affichables

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function safeJsonParse(text) {
    try { return { ok: true, value: JSON.parse(text) }; }
    catch (e) { return { ok: false, error: String(e) }; }
  }

  // ==========================
  // LocalStorage (payloads)
  // ==========================
  function loadPayloads() {
    const raw = localStorage.getItem(LT_PAYLOADS_KEY);
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function savePayloads(payloads) {
    localStorage.setItem(LT_PAYLOADS_KEY, JSON.stringify(payloads));
  }

  function payloadSig(payload) {
    if (payload._schema === "events_v1") {
      const last = (payload.events && payload.events.length)
        ? payload.events[payload.events.length - 1].time
        : "";
      return `events|${payload.exported_at || ""}|${payload.events?.length || 0}|${last}`;
    }
    return `runs|${payload.date || ""}|${payload.started_at || ""}|${payload.runs?.length || 0}`;
  }

  function addPayload(rawObj, merge = true) {
    const payload = normalizePayload(rawObj);
    const payloads = loadPayloads();

    const sig = payloadSig(payload);
    const exists = payloads.some(p => payloadSig(p) === sig);

    let finalPayloads;
    if (!merge) {
      finalPayloads = [payload];
    } else {
      finalPayloads = exists ? payloads : payloads.concat([payload]);
    }

    savePayloads(finalPayloads);
    return finalPayloads;
  }

  // ==========================
  // Status
  // ==========================
  function setStatus(msg, kind = "info") {
    const el = $("importStatus");
    if (!el) return;
    el.className = "lt-status is-" + kind;
    el.textContent = msg;
  }

  function setSharedStatus(msg, kind = "info") {
    const el = $("sharedStatus");
    if (!el) return;
    el.className = "lt-status is-" + kind;
    el.textContent = msg;
  }

  // ==========================
  // Normalize payloads
  // ==========================
  function normalizePayload(raw) {
    if (!raw || typeof raw !== "object") {
      throw new Error("JSON invalide");
    }

    // Nouveau schéma (events)
    if (raw.schema === 1 && Array.isArray(raw.events)) {
      if (!raw.realm) throw new Error("Champ realm manquant");

      return {
        _schema: "events_v1",
        realm: raw.realm,
        recorder: raw.recorder || "Recorder",
        exported_at: raw.exported_at || "",
        events: raw.events
      };
    }

    // Ancien schéma (runs)
    if (raw.player && raw.realm && Array.isArray(raw.runs)) {
      return {
        _schema: "runs_v1",
        ...raw
      };
    }

    throw new Error("Format JSON non reconnu");
  }

  // ==========================
  // Quality helpers
  // ==========================
  function qualityLabel(q) {
    return ({
      0: "Médiocre",
      1: "Commun",
      2: "Inhabituel",
      3: "Rare",
      4: "Épique",
      5: "Légendaire"
    })[Number(q)] || String(q);
  }

  function qualityClass(q) {
    return "q" + Number(q || 0);
  }

  // ==========================
  // Extract rows (payload -> rows)
  // ==========================
  function extractRows(payload, respectMinQuality) {
    const rows = [];

    // events_v1
    if (payload._schema === "events_v1") {
      for (const ev of (payload.events || [])) {
        const q = Number(ev.quality ?? 0);
        rows.push({
          date: ev.time_human || "",
          instance: ev.instance || "",
          boss: ev.boss || "",
          winner: ev.winner || "",
          item: ev.item || "",
          itemID: ev.itemID || null,
          quality: q,
          quality_name: ev.quality_name || qualityLabel(q),
          roll: ev.winning_roll ?? null
        });
      }
      return rows;
    }

    // runs_v1
    const minQ = Number(payload.min_quality || 0);

    for (const run of (payload.runs || [])) {
      const instance = (run.instance_override && run.instance_override.trim())
        ? run.instance_override
        : (run.instance || "");

      for (const boss of (run.bosses || [])) {
        for (const loot of (boss.loots || [])) {
          const q = Number(loot.quality || 0);
          if (respectMinQuality && q < minQ) continue;

          rows.push({
            date: loot.time_human || run.started_at_human || payload.date || "",
            instance,
            boss: boss.name || "",
            winner: loot.player || payload.player || "",
            item: loot.item || "",
            itemID: loot.itemID || null,
            quality: q,
            quality_name: loot.quality_name || qualityLabel(q),
            roll: loot.rand ?? null
          });
        }
      }
    }

    return rows;
  }

  // ==========================
  // Build ALL_ROWS + populate selects
  // ==========================
  function rebuildAllRows() {
    const payloads = loadPayloads();
    const respectMin = $("chkFilterMinQuality")?.checked ?? false;

    let rows = [];
    for (const p of payloads) {
      rows = rows.concat(extractRows(p, respectMin));
    }

    ALL_ROWS = rows;

    populateWinnerSelect(ALL_ROWS);
    populateInstanceSelect(ALL_ROWS);
    // qualitySelect: pas besoin de populate (options statiques)
  }

  function populateWinnerSelect(rows) {
    const sel = $("winnerSelect");
    if (!sel) return;

    const current = sel.value || "";
    sel.innerHTML = "";

    sel.appendChild(new Option("Tous", ""));

    const set = new Set();
    for (const r of rows) if (r.winner) set.add(r.winner);

    const winners = Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
    for (const w of winners) sel.appendChild(new Option(w, w));

    sel.value = winners.includes(current) ? current : "";
  }

  function populateInstanceSelect(rows) {
    const sel = $("instanceSelect");
    if (!sel) return;

    const current = sel.value || "";
    sel.innerHTML = "";

    sel.appendChild(new Option("Toutes les instances", ""));

    const set = new Set();
    for (const r of rows) if (r.instance) set.add(r.instance);

    const instances = Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
    for (const inst of instances) sel.appendChild(new Option(inst, inst));

    sel.value = instances.includes(current) ? current : "";
  }

  // ==========================
  // Filtering + render table
  // ==========================
  function applyFilters(rows) {
    // 1) winner select
    const winner = $("winnerSelect")?.value || "";

    // 2) instance select
    const instSel = $("instanceSelect")?.value || "";

    // 3) optional old text instance filter (si tu le gardes)
    const instText = ($("instanceFilter")?.value || "").trim().toLowerCase();

    // 4) quality select (min quality)
    const qSelRaw = $("qualitySelect")?.value;
    const minQuality = (qSelRaw === "" || qSelRaw == null) ? null : Number(qSelRaw);

    // 5) item search text
    const itemFilter = ($("itemFilter")?.value || "").trim().toLowerCase();

    return rows.filter(r => {
      const okWinner = !winner || r.winner === winner;

      // priorité au select instance
      const okInstSel = !instSel || r.instance === instSel;
      const okInstText = !instText || (r.instance || "").toLowerCase().includes(instText);

      const okItem = !itemFilter || (r.item || "").toLowerCase().includes(itemFilter);

      // qualité = minQuality (>=)
      const okQuality = (minQuality === null) || Number(r.quality || 0) >= minQuality;

      return okWinner && okInstSel && okInstText && okItem && okQuality;
    });
  }

  function renderTable() {
    const tbody = $("lootTbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    let rows = applyFilters(ALL_ROWS);
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" class="lt-empty">Aucun loot.</td>`;
      tbody.appendChild(tr);
      return;
    }

    for (const r of rows) {
      const rollStr = (r.roll === null || r.roll === undefined) ? "—" : String(r.roll);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.date || "")}</td>
        <td>${escapeHtml(r.instance || "")}</td>
        <td>${escapeHtml(r.boss || "")}</td>
        <td>${escapeHtml(r.winner || "")}</td>
        <td class="lt-item">
          ${
            r.itemID
              ? `<a href="https://www.wowhead.com/classic/fr/item=${r.itemID}"
                   target="_blank"
                   rel="noopener"
                   data-wowhead="item=${r.itemID}">
                   ${escapeHtml(r.item || "")}
                 </a>`
              : escapeHtml(r.item || "")
          }
        </td>
        <td class="lt-quality ${qualityClass(r.quality)}">${escapeHtml(r.quality_name || "")}</td>
        <td>${escapeHtml(rollStr)}</td>
      `;
      tbody.appendChild(tr);
    }

    // Refresh Wowhead tooltips
    if (window.$WowheadPower?.refreshLinks) {
      window.$WowheadPower.refreshLinks();
    }
  }

  // ==========================
  // Shared JSON (repo)
  // ==========================
  async function loadSharedJson() {
    const url = "../json/loot_thunderstrike.json";

    try {
      setSharedStatus("Chargement…", "info");
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} (${url})`);
      }

      const json = await res.json();
      addPayload(json, true);

      setSharedStatus("JSON partagé chargé", "ok");
      setStatus("Dataset mis à jour (partagé).", "ok");

      rebuildAllRows();
      renderTable();
    } catch (e) {
      // message utile
      setSharedStatus(`Erreur chargement: ${e.message || e}`, "warn");
    }
  }

  // ==========================
  // Import buttons (file + paste)
  // ==========================
  async function importFromFile() {
    const file = $("fileInput")?.files?.[0];
    if (!file) { setStatus("Sélectionne un fichier JSON.", "warn"); return; }

    const text = await file.text();
    const parsed = safeJsonParse(text);
    if (!parsed.ok) { setStatus("JSON invalide: " + parsed.error, "error"); return; }

    try {
      const merge = $("chkMerge")?.checked ?? true;
      addPayload(parsed.value, merge);
      setStatus("Import OK (dataset mis à jour).", "ok");
      rebuildAllRows();
      renderTable();
    } catch (e) {
      setStatus("Erreur import: " + String(e), "error");
    }
  }

  function importFromPaste() {
    const text = ($("pasteArea")?.value || "").trim();
    if (!text) { setStatus("Colle un JSON dans la zone texte.", "warn"); return; }

    const parsed = safeJsonParse(text);
    if (!parsed.ok) { setStatus("JSON invalide: " + parsed.error, "error"); return; }

    try {
      const merge = $("chkMerge")?.checked ?? true;
      addPayload(parsed.value, merge);
      setStatus("Import OK (dataset mis à jour).", "ok");
      rebuildAllRows();
      renderTable();
    } catch (e) {
      setStatus("Erreur import: " + String(e), "error");
    }
  }

  // ==========================
  // Init
  // ==========================
  document.addEventListener("DOMContentLoaded", () => {
    rebuildAllRows();
    renderTable();

    // auto load shared
    loadSharedJson();

    $("btnReloadShared")?.addEventListener("click", loadSharedJson);

    $("btnImportFile")?.addEventListener("click", importFromFile);
    $("btnImportPaste")?.addEventListener("click", importFromPaste);

    $("btnClearPaste")?.addEventListener("click", () => {
      if ($("pasteArea")) $("pasteArea").value = "";
      setStatus("Zone texte vidée.", "info");
    });

    $("btnRefresh")?.addEventListener("click", renderTable);

    $("winnerSelect")?.addEventListener("change", renderTable);
    $("instanceSelect")?.addEventListener("change", renderTable);
    $("qualitySelect")?.addEventListener("change", renderTable);

    $("instanceFilter")?.addEventListener("input", renderTable); // si tu gardes ce champ
    $("itemFilter")?.addEventListener("input", renderTable);

    $("chkFilterMinQuality")?.addEventListener("change", () => {
      rebuildAllRows();
      renderTable();
    });

    $("btnDeleteAll")?.addEventListener("click", () => {
      if (!confirm("Tout supprimer localement ?")) return;
      localStorage.removeItem(LT_PAYLOADS_KEY);
      ALL_ROWS = [];
      rebuildAllRows();
      renderTable();
      setStatus("Tout supprimé localement.", "info");
    });
  });

})();
