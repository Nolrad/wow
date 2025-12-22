(function () {
  "use strict";

  // ==========================
  // Constants & helpers
  // ==========================
  const LT_INDEX = "LT_INDEX_V2";
  const LT_PREFIX = "LT_CHAR_V2_";

  function $(id) {
    return document.getElementById(id);
  }

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
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  function charId(realm, player) {
    return `${realm}|${player}`;
  }

  // ==========================
  // LocalStorage
  // ==========================
  function loadIndex() {
    const raw = localStorage.getItem(LT_INDEX);
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveIndex(ids) {
    localStorage.setItem(LT_INDEX, JSON.stringify(ids));
  }

  function loadChar(id) {
    const raw = localStorage.getItem(LT_PREFIX + id);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveChar(obj) {
    localStorage.setItem(LT_PREFIX + obj.id, JSON.stringify(obj));
  }

  function addCharToIndex(id) {
    const ids = loadIndex();
    if (!ids.includes(id)) {
      ids.push(id);
      ids.sort();
      saveIndex(ids);
    }
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
        player: raw.recorder || "Recorder",
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
    })[Number(q)] || q;
  }

  function qualityClass(q) {
    return "q" + Number(q || 0);
  }

  // ==========================
  // Extract rows
  // ==========================
  function extractRows(payload, respectMinQuality) {
    const rows = [];

    if (payload._schema === "events_v1") {
      for (const ev of payload.events) {
        rows.push({
          date: ev.time_human || "",
          instance: ev.instance || "",
          boss: ev.boss || "",
          winner: ev.winner || "",
          item: ev.item || "",
          itemID: ev.itemID || null,
          quality: Number(ev.quality || 0),
          quality_name: ev.quality_name || qualityLabel(ev.quality),
          roll: ev.winning_roll
        });
      }
      return rows;
    }

    const minQ = Number(payload.min_quality || 0);

    for (const run of payload.runs) {
      const instance = run.instance_override || run.instance || "";
      for (const boss of run.bosses || []) {
        for (const loot of boss.loots || []) {
          const q = Number(loot.quality || 0);
          if (respectMinQuality && q < minQ) continue;

          rows.push({
            date: loot.time_human || "",
            instance,
            boss: boss.name || "",
            winner: loot.player || payload.player,
            item: loot.item || "",
            itemID: loot.itemID || null,
            quality: q,
            quality_name: loot.quality_name || qualityLabel(q),
            roll: loot.rand
          });
        }
      }
    }
    return rows;
  }

  // ==========================
  // Import payload
  // ==========================
  function importPayload(raw, merge) {
    const payload = normalizePayload(raw);
    const id = charId(payload.realm, payload.player);

    let record = loadChar(id);
    if (!record || !merge) {
      record = {
        id,
        realm: payload.realm,
        player: payload.player,
        history: [],
        _seen: {}
      };
    }

    const sig =
      payload._schema === "events_v1"
        ? `events|${payload.exported_at}|${payload.events.length}`
        : `runs|${payload.date}|${payload.started_at}`;

    if (!record._seen[sig]) {
      record.history.push(payload);
      record._seen[sig] = true;
    }

    saveChar(record);
    addCharToIndex(id);
    return record;
  }

  // ==========================
  // Rendering
  // ==========================
  function renderCharacterSelect() {
    const sel = $("characterSelect");
    if (!sel) return;

    sel.innerHTML = "";
    const ids = loadIndex();

    if (!ids.length) {
      sel.innerHTML = `<option>Aucun profil</option>`;
      sel.disabled = true;
      return;
    }

    sel.disabled = false;
    for (const id of ids) {
      const c = loadChar(id);
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${c.player} — ${c.realm}`;
      sel.appendChild(opt);
    }
  }

  function renderTable() {
    const tbody = $("lootTbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    const sel = $("characterSelect");
    if (!sel || !sel.value) return;

    const c = loadChar(sel.value);
    if (!c) return;

    let rows = [];
    const respectMin = $("chkFilterMinQuality")?.checked;

    for (const p of c.history) {
      rows = rows.concat(extractRows(p, respectMin));
    }

    const instFilter = $("instanceFilter")?.value.toLowerCase() || "";
    const itemFilter = $("itemFilter")?.value.toLowerCase() || "";

    rows = rows.filter(r =>
      (!instFilter || r.instance.toLowerCase().includes(instFilter)) &&
      (!itemFilter || r.item.toLowerCase().includes(itemFilter))
    );

    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.instance)}</td>
        <td>${escapeHtml(r.boss)}</td>
        <td>${escapeHtml(r.winner)}</td>
        <td class="lt-item">
          ${r.itemID
            ? `<a href="https://www.wowhead.com/classic/fr/item=${r.itemID}"
                 target="_blank"
                 data-wowhead="item=${r.itemID}">
                 ${escapeHtml(r.item)}
               </a>`
            : escapeHtml(r.item)}
        </td>
        <td class="lt-quality ${qualityClass(r.quality)}">${escapeHtml(r.quality_name)}</td>
        <td>${r.roll ?? "—"}</td>
      `;
      tbody.appendChild(tr);
    }

    // Refresh Wowhead tooltips
    if (window.$WowheadPower?.refreshLinks) {
      window.$WowheadPower.refreshLinks();
    }
  }

  // ==========================
  // Shared JSON
  // ==========================
  async function loadSharedJson() {
    try {
      setSharedStatus("Chargement…", "info");
      const res = await fetch("../json/loot_thunderstrike.json", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      const json = await res.json();

      const rec = importPayload(json, true);
      setSharedStatus("JSON partagé chargé", "ok");
      setStatus(`Import partagé : ${rec.player}`, "ok");

      renderCharacterSelect();
      $("characterSelect").value = rec.id;
      renderTable();
    } catch (e) {
      setSharedStatus("Erreur chargement JSON partagé", "warn");
    }
  }

  // ==========================
  // Init
  // ==========================
  document.addEventListener("DOMContentLoaded", () => {
    renderCharacterSelect();
    renderTable();
    loadSharedJson();

    $("btnReloadShared")?.addEventListener("click", loadSharedJson);
    $("btnRefresh")?.addEventListener("click", renderTable);
    $("characterSelect")?.addEventListener("change", renderTable);
    $("instanceFilter")?.addEventListener("input", renderTable);
    $("itemFilter")?.addEventListener("input", renderTable);
    $("chkFilterMinQuality")?.addEventListener("change", renderTable);
  });

})();
