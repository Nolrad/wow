(function () {
  "use strict";

  // ==========================
  // Constants & state
  // ==========================
  const LT_PAYLOADS_KEY = "LT_PAYLOADS_V3"; // payloads normalisés (shared + imports)
  const SHARED_URL = "../json/loot_thunderstrike.json";

  let ALL_ROWS = [];

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
  // Wowhead tooltips helper
  // ==========================
  function refreshWowheadTooltips(retries = 8) {
    // power.js peut charger après -> on retente quelques fois
    if (window.$WowheadPower && typeof window.$WowheadPower.refreshLinks === "function") {
      window.$WowheadPower.refreshLinks();
      return;
    }
    if (retries <= 0) return;
    setTimeout(() => refreshWowheadTooltips(retries - 1), 400);
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

  // Signature stable pour éviter doublons
  function payloadSig(payload) {
    if (payload._schema === "events_v1") {
      const count = payload.events?.length || 0;
      const lastTime = count ? (payload.events[count - 1]?.time || "") : "";
      return `events|${payload.realm || ""}|${payload.exported_at || ""}|${count}|${lastTime}`;
    }
    const countRuns = payload.runs?.length || 0;
    return `runs|${payload.realm || ""}|${payload.player || ""}|${payload.date || ""}|${payload.started_at || ""}|${countRuns}`;
  }

  function addPayload(rawObj, merge = true) {
    const payload = normalizePayload(rawObj);
    const existing = loadPayloads();

    if (!merge) {
      savePayloads([payload]);
      return [payload];
    }

    const sig = payloadSig(payload);
    const exists = existing.some(p => payloadSig(p) === sig);
    const finalPayloads = exists ? existing : existing.concat([payload]);

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
      throw new Error("JSON invalide (pas un objet)");
    }

    // Nouveau schéma (events)
    if (raw.schema === 1 && Array.isArray(raw.events)) {
      if (!raw.realm) throw new Error("Champ 'realm' manquant");

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

    throw new Error("Format JSON non reconnu (attendu: schema=1 events[] OU player/realm/runs[])");
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
          itemID: Number(ev.itemID || 0) || null,
          quality: q,
          quality_name: ev.quality_name || qualityLabel(q),
          roll: (ev.winning_roll === null || ev.winning_roll === undefined) ? null : Number(ev.winning_roll)
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
            itemID: Number(loot.itemID || 0) || null,
            quality: q,
            quality_name: loot.quality_name || qualityLabel(q),
            roll: (loot.rand === null || loot.rand === undefined) ? null : Number(loot.rand)
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
    for (const p of payloads) rows = rows.concat(extractRows(p, respectMin));

    ALL_ROWS = rows;

    populateWinnerSelect(ALL_ROWS);
    populateInstanceSelect(ALL_ROWS);
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
    const winner = $("winnerSelect")?.value || "";
    const instSel = $("instanceSelect")?.value || "";

    const qSelRaw = $("qualitySelect")?.value;
    const minQuality = (qSelRaw === "" || qSelRaw == null) ? null : Number(qSelRaw);

    const itemFilter = ($("itemFilter")?.value || "").trim().toLowerCase();

    return rows.filter(r => {
      const okWinner = !winner || r.winner === winner;
      const okInst = !instSel || r.instance === instSel;
      const okItem = !itemFilter || (r.item || "").toLowerCase().includes(itemFilter);
      const okQuality = (minQuality === null) || Number(r.quality || 0) >= minQuality;
      return okWinner && okInst && okItem && okQuality;
    });
  }

  function renderSummary(rows) {
    const el = $("summary");
    if (!el) return;

    const total = rows.length;
    const counts = {0:0,1:0,2:0,3:0,4:0,5:0};
    for (const r of rows) counts[r.quality] = (counts[r.quality] || 0) + 1;

    el.innerHTML = `
      <div class="lt-summaryGrid">
        <div class="lt-sumCard"><div class="lt-sumNum">${total}</div><div class="lt-sumLabel">Loots</div></div>
        <div class="lt-sumCard ${qualityClass(1)}"><div class="lt-sumNum">${counts[1]||0}</div><div class="lt-sumLabel">Commun</div></div>
        <div class="lt-sumCard ${qualityClass(2)}"><div class="lt-sumNum">${counts[2]||0}</div><div class="lt-sumLabel">Inhabituel</div></div>
        <div class="lt-sumCard ${qualityClass(3)}"><div class="lt-sumNum">${counts[3]||0}</div><div class="lt-sumLabel">Rare</div></div>
        <div class="lt-sumCard ${qualityClass(4)}"><div class="lt-sumNum">${counts[4]||0}</div><div class="lt-sumLabel">Épique</div></div>
        <div class="lt-sumCard ${qualityClass(5)}"><div class="lt-sumNum">${counts[5]||0}</div><div class="lt-sumLabel">Légendaire</div></div>
      </div>
    `;
  }

  function renderTable() {
    const tbody = $("lootTbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    let rows = applyFilters(ALL_ROWS);
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    renderSummary(rows);

    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" class="lt-empty">Aucun loot.</td>`;
      tbody.appendChild(tr);
      return;
    }

    for (const r of rows) {
      const rollStr = (r.roll === null || r.roll === undefined) ? "—" : String(r.roll);

      const itemId = Number(r.itemID || 0);
      const itemHtml = itemId
        ? `<a class="lt-itemLink"
              href="https://www.wowhead.com/classic/fr/item=${itemId}"
              target="_blank"
              rel="noopener"
              data-wowhead="item=${itemId}">
              ${escapeHtml(r.item || "")}
           </a>`
        : `<span class="lt-itemLink">${escapeHtml(r.item || "")}</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.date || "")}</td>
        <td>${escapeHtml(r.instance || "")}</td>
        <td>${escapeHtml(r.boss || "")}</td>
        <td>${escapeHtml(r.winner || "")}</td>
        <td class="lt-item">${itemHtml}</td>
        <td class="lt-quality ${qualityClass(r.quality)}">${escapeHtml(r.quality_name || "")}</td>
        <td>${escapeHtml(rollStr)}</td>
      `;
      tbody.appendChild(tr);
    }

    // Wowhead tooltips
    refreshWowheadTooltips();
  }

  // ==========================
  // Shared JSON (repo)
  // ==========================
  async function loadSharedJson() {
    try {
      setSharedStatus("Chargement…", "info");

      const res = await fetch(SHARED_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} (${SHARED_URL})`);

      const json = await res.json();
      addPayload(json, true);

      setSharedStatus("JSON partagé chargé", "ok");
      setStatus("Dataset mis à jour (partagé).", "ok");

      rebuildAllRows();
      renderTable();
    } catch (e) {
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
