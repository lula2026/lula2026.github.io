    const SECTIONS = [
      { id: "hoje",        label: "Hoje",        title: "Hoje: digest",           desc: "O que importa nas últimas 24–48h para a campanha." },
      { id: "noticias",    label: "Notícias",    title: "Notícias",               desc: "Apoios, pesquisas, agenda e bastidores, sempre com fonte jornalística." },
      { id: "entregas",    label: "Entregas",    title: "O que o governo fez",    desc: "Realizações com número e fonte. É a base do argumento \"comparar projetos\"." },
      { id: "checagem",    label: "Checagem",    title: "Boato × Fato",           desc: "Mentiras que circulam contra Lula e contra as urnas, já desmentidas por agências de checagem." },
      { id: "contraponto", label: "Contraponto", title: "Contraponto Flávio",     desc: "Fatos documentados sobre o adversário. Só fatos com fonte, sem adjetivo e sem acusação sem prova." },
      { id: "virar",       label: "Virar voto",  title: "Virar voto",             desc: "Roteiros curtos para conversar com indecisos, eleitores de Cury, Renan e Caiado e quem não foi votar no 1º turno." },
      { id: "manual",      label: "Manual de Virada", title: "Manual de Virada 2026", desc: "Táticas de comunicação para o 2º turno, reunidas de cinco carrosséis de @socialistadeiphone.", static: true },
      { id: "comentaristas", label: "Comentaristas", title: "Comentaristas",      desc: "Análises e cortes de jornalistas e influenciadores progressistas." },
      { id: "arquivo",     label: "Arquivo",     title: "Arquivo",                desc: "Cards antigos que ainda podem ser úteis." },
    ];

    const state = { data: {}, active: "hoje", q: "", tag: null };
    // Segurança: não roda dentro de iframe de terceiros (anti-clickjacking).
    if (window.top !== window.self) { try { window.top.location = window.self.location.href; } catch { document.documentElement.innerHTML = ""; } }

    const $ = (s, el = document) => el.querySelector(s);
    // Segurança: só aceita links http(s). Bloqueia "javascript:", "data:" etc. vindos dos JSON.
    const safeUrl = (u) => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const fmtDate = (d) => { const [y, m, day] = (d || "").split("-"); return day ? `${day}/${m}/${y}` : ""; };
    const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    function toast(msg) {
      const t = $("#toast"); t.textContent = msg; t.classList.add("show");
      clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 1800);
    }

    function countdown() {
      const target = new Date("2026-10-25T08:00:00-03:00");
      const days = Math.ceil((target - new Date()) / 86400000);
      $("#countdown").textContent = days > 1 ? `2º turno em ${days} dias · 25/10` : days === 1 ? "2º turno é amanhã" : days === 0 ? "Hoje é dia de votar" : "2º turno · 25/10";
    }

    function buildShell() {
      $("#tabs").innerHTML = SECTIONS.map((s) =>
        `<button class="tab${s.id === state.active ? " active" : ""}" role="tab" data-section="${s.id}" aria-selected="${s.id === state.active}">${s.label}</button>`).join("");
      $("#main").innerHTML = SECTIONS.map((s) => `
        <section id="panel-${s.id}" class="panel${s.id === state.active ? " active" : ""}" role="tabpanel">
          <div class="section-head"><h2>${s.title}</h2>${s.static ? "" : `<span class="meta" data-count="${s.id}">—</span>`}</div>
          <p class="section-desc">${s.desc}</p>
          ${s.static ? `<div class="static" id="static-${s.id}"></div>` : `<div class="tagbar" id="tags-${s.id}"></div>
          <div class="grid" id="grid-${s.id}"><div class="loading">Carregando…</div></div>`}
        </section>`).join("");
      SECTIONS.filter((s) => s.static).forEach((s) => {
        const tpl = document.getElementById(`tpl-${s.id}`);
        if (tpl) $(`#static-${s.id}`).appendChild(tpl.content.cloneNode(true));
      });
    }

    function shareText(item) {
      const body = item.share || `${item.title}\n\n${item.summary}`;
      return `${body}\n\nFonte: ${item.source}${safeUrl(item.url) ? `\n${safeUrl(item.url)}` : ""}`;
    }

    function cardHTML(item, sectionId) {
      const verdict = item.verdict ? `<span class="verdict ${esc(norm(item.verdict))}">${esc(item.verdict)}</span>` : "";
      const tags = (item.tags || []).map((t) =>
        `<button class="tag${state.tag === t ? " on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("");
      return `
        <article class="card k-${sectionId}">
          <div class="card-meta"><span class="card-source" title="${esc(item.source)}">${esc(item.source)}</span><span>${fmtDate(item.date)}</span></div>
          ${verdict}
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.summary)}</p>
          ${tags ? `<div class="tags">${tags}</div>` : ""}
          <div class="actions">
            ${safeUrl(item.url) ? `<a class="btn" href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">Fonte ↗</a>` : ""}
            <button class="btn" data-copy="${esc(item.id)}">Copiar p/ WhatsApp</button>
          </div>
        </article>`;
    }

    function matches(item) {
      if (state.tag && !(item.tags || []).includes(state.tag)) return false;
      if (!state.q) return true;
      const hay = norm([item.title, item.summary, item.source, item.share, ...(item.tags || [])].join(" "));
      return norm(state.q).split(/\s+/).every((w) => hay.includes(w));
    }

    function render(sectionId) {
      const grid = $(`#grid-${sectionId}`);
      const raw = state.data[sectionId];
      if (raw instanceof Error) { grid.innerHTML = `<div class="error">Não foi possível carregar esta aba agora. Tente recarregar a página.</div>`; return; }
      if (!raw) return;
      const items = raw.filter(matches).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const counter = $(`[data-count="${sectionId}"]`);
      counter.textContent = items.length === raw.length ? `${raw.length} cards` : `${items.length} de ${raw.length} cards`;

      const allTags = [...new Set(raw.flatMap((i) => i.tags || []))].sort((a, b) => a.localeCompare(b, "pt"));
      $(`#tags-${sectionId}`).innerHTML = allTags.map((t) =>
        `<button class="tag${state.tag === t ? " on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("");

      grid.innerHTML = items.length ? items.map((i) => cardHTML(i, sectionId)).join("")
        : `<div class="empty">${raw.length ? "Nada encontrado com esse filtro." : "Nenhum card nesta aba por enquanto."}</div>`;
    }

    function renderAll() { SECTIONS.filter((s) => !s.static).forEach((s) => render(s.id)); }

    function activate(id) {
      state.active = id;
      document.querySelectorAll(".tab").forEach((t) => { const on = t.dataset.section === id; t.classList.toggle("active", on); t.setAttribute("aria-selected", on); });
      document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${id}`));
      try { localStorage.setItem("hub-lula-tab", id); } catch {}
      if (location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
    }

    async function load() {
      await Promise.all(SECTIONS.filter((s) => !s.static).map(async (s) => {
        try {
          const res = await fetch(`data/${s.id}.json`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (!Array.isArray(json)) throw new Error("o arquivo precisa conter um array");
          state.data[s.id] = json;
        } catch (e) {
          state.data[s.id] = e;
        }
        render(s.id);
      }));
    }

    function initTheme() {
      let t = null;
      try { t = localStorage.getItem("hub-lula-theme"); } catch {}
      if (t) document.documentElement.dataset.theme = t;
      $("#theme").addEventListener("click", () => {
        const dark = document.documentElement.dataset.theme
          ? document.documentElement.dataset.theme === "dark"
          : matchMedia("(prefers-color-scheme: dark)").matches;
        const next = dark ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem("hub-lula-theme", next); } catch {}
      });
    }

    buildShell();
    initTheme();
    countdown();
    {
      let saved = location.hash.slice(1);
      if (!SECTIONS.some((s) => s.id === saved)) { try { saved = localStorage.getItem("hub-lula-tab"); } catch {} }
      if (SECTIONS.some((s) => s.id === saved)) activate(saved);
    }

    document.addEventListener("click", async (e) => {
      const tab = e.target.closest(".tab");
      if (tab) { activate(tab.dataset.section); return; }
      const tag = e.target.closest("[data-tag]");
      if (tag) { state.tag = state.tag === tag.dataset.tag ? null : tag.dataset.tag; renderAll(); return; }
      const copy = e.target.closest("[data-copy]");
      if (copy) {
        const item = Object.values(state.data).filter(Array.isArray).flat().find((i) => i.id === copy.dataset.copy);
        if (!item) return;
        try { await navigator.clipboard.writeText(shareText(item)); toast("Copiado! Cole no WhatsApp."); }
        catch { toast("Não consegui copiar. Selecione o texto manualmente."); }
      }
    });
    $("#q").addEventListener("input", (e) => { state.q = e.target.value.trim(); renderAll(); });
    window.addEventListener("hashchange", () => { const id = location.hash.slice(1); if (SECTIONS.some((s) => s.id === id)) activate(id); });

    load();
  