/* ============================================================
   main.js — навигация, тема, язык, аккаунт, инициализация
   ============================================================ */
"use strict";

let currentPage = "journal";
let statsInited = false;

function journalCount(n, kind){
  if(LANG !== "ru") return `${n} ${kind}${n === 1 ? "" : "s"}`;
  const forms = kind === "trade" ? ["сделка", "сделки", "сделок"] : ["сессия", "сессии", "сессий"];
  const i = n % 100 >= 11 && n % 100 <= 14 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2;
  return `${n} ${forms[i]}`;
}

function showPage(page, resetScroll=false){
  currentPage = page;
  $$(".tab").forEach(x => x.classList.toggle("is-active", x.dataset.page === page));
  $$(".page").forEach(p => p.classList.remove("is-active"));
  const el = $("#page-" + page);
  void el.offsetWidth;
  el.classList.add("is-active");
  if(resetScroll) window.scrollTo(0, 0);

  if(page === "stats"){
    if(!statsInited){ initStats(); statsInited = true; }
    renderStats();
    if(!localStorage.getItem("mdt.tour.stats.done") && localStorage.getItem("mdt.tour.done") && !Tour.active()){
      setTimeout(() => { if(currentPage === "stats") Tour.startStats(); }, 500);
    }
  }
  if(page === "backtest") Backtest.render();
  if(page === "journal") Journal.render();
}

function rerenderAll(){
  renderJournalSwitcher();
  Journal.render();
  Backtest.render();
  if(statsInited) renderStats();
  showPage(currentPage);
  applyStaticI18n();
}

function renderJournalSwitcher(){
  const rail = $("#journalRail");
  if(!rail) return;
  $(".workspace").setAttribute("aria-label", t("journals"));
  rail.setAttribute("aria-label", t("journals"));
  $("#workspaceTitle").textContent = DATA.name;
  $("#workspaceMeta").innerHTML = `<span>${journalCount(DATA.trades.length, "trade")}</span><span class="meta-divider"></span><span>${journalCount(DATA.sessions.length, "session")}</span>`;
  rail.innerHTML = STORE.journals.map((journal, index) => `
    <div class="journal-item${journal.id === DATA.id ? " is-active" : ""}">
      <button class="journal-select" type="button" data-journal="${esc(journal.id)}" ${journal.id === DATA.id ? 'aria-current="true"' : ""} title="${esc(journal.name)}">
        <span class="journal-index">${String(index + 1).padStart(2, "0")}</span><span class="journal-name">${esc(journal.name)}</span>
      </button>
      <button class="journal-edit" type="button" data-edit-journal="${esc(journal.id)}" aria-label="${esc(t("edit_journal"))}: ${esc(journal.name)}" title="${esc(t("edit_journal"))}">•••</button>
    </div>`).join("") + `<button class="journal-add" type="button" id="addJournal" aria-label="${esc(t("add_journal"))}" title="${esc(t("add_journal"))}"><span>+</span></button>`;
  $$("[data-journal]", rail).forEach(button => button.addEventListener("click", () => selectJournal(button.dataset.journal)));
  $$("[data-edit-journal]", rail).forEach(button => button.addEventListener("click", () => openJournalEditor(button.dataset.editJournal)));
  $("#addJournal").addEventListener("click", () => {
    const journal = addJournal();
    toast(t("journal_added"));
    openJournalEditor(journal.id);
  });
}

function openJournalEditor(id){
  const journal = STORE.journals.find(j => j.id === id);
  if(!journal) return;
  const canDelete = STORE.journals.length > 1;
  openModal(modalShell(t("edit_journal"),
    `<div class="f-field"><label for="journalName">${t("journal_name")}</label><input id="journalName" type="text" maxlength="40" value="${esc(journal.name)}" autocomplete="off"></div>`,
    `${canDelete ? `<button class="btn btn-danger-ghost journal-delete" id="journalDelete">${t("delete_journal")}</button>` : ""}
     <button class="btn btn-ghost" id="journalCancel">${t("cancel")}</button>
     <button class="btn btn-primary" id="journalSave">${t("save")}</button>`),
    { onMount(overlay){
      const input = $("#journalName", overlay);
      input.focus(); input.select();
      const save = () => {
        if(!renameJournal(id, input.value)){ toast(t("journal_name_required"), true); input.focus(); return; }
        closeModal(); toast(t("journal_saved"));
      };
      $("#journalSave", overlay).addEventListener("click", save);
      input.addEventListener("keydown", event => { if(event.key === "Enter") save(); });
      $("#journalCancel", overlay).addEventListener("click", closeModal);
      if(canDelete) $("#journalDelete", overlay).addEventListener("click", () => {
        if(!confirm(t("delete_journal_q"))) return;
        closeModal(); deleteJournal(id);
      });
    }});
}

/* ---------- тема ---------- */
function getTheme(){ return localStorage.getItem("mdt.theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
function applyTheme(th){
  document.documentElement.dataset.theme = th;
  localStorage.setItem("mdt.theme", th);
  const btn = $("#themeBtn");
  if(btn) btn.innerHTML = th === "dark" ? ICON_SUN : ICON_MOON;
  const meta = $('meta[name="theme-color"]');
  if(meta) meta.content = th === "dark" ? "#0F1115" : "#F4F5F7";
}

const ICON_MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const ICON_SUN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

/* ---------- шапка: язык / тема / аккаунт ---------- */
function renderHeaderControls(){
  /* язык */
  const langBtn = $("#langBtn");
  if(langBtn) langBtn.textContent = LANG === "ru" ? "EN" : "RU";

  /* аккаунт */
  const area = $("#authArea");
  if(!area) return;
  if(Cloud.enabled() && Cloud.user){
    const email = Cloud.user.email || "";
    area.innerHTML = `
      <details class="menu" id="accMenu">
        <summary class="btn btn-ghost acc-btn">${ICON_USER}<span class="acc-mail">${esc(email)}</span><span class="sync-dot s-${Cloud.status}" id="syncDot"></span></summary>
        <div class="menu-list">
          <div class="menu-info">${esc(email)}</div>
          <hr>
          <button id="btnLogout">${t("logout")}</button>
        </div>
      </details>`;
    $("#btnLogout").addEventListener("click", async () => {
      $("#accMenu").removeAttribute("open");
      await Cloud.signOut();
    });
    Cloud.setStatus(Cloud.status);
  }else{
    area.innerHTML = `<button class="btn btn-primary btn-sm" id="btnLogin">${t("login")}</button>`;
    $("#btnLogin").addEventListener("click", () => openAuthModal("signin"));
  }

  /* подпись в футере */
  const note = $("#footNote");
  if(note) note.textContent = "© 2026 ManiacDT · " + (Cloud.user ? t("foot_note_cloud") : t("foot_note_local"));
}

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(getTheme());
  document.documentElement.lang = LANG;
  applyStaticI18n();

  /* вкладки */
  $$(".tab").forEach(x => x.addEventListener("click", () => showPage(x.dataset.page, true)));
  $("#brandLink").addEventListener("click", e => { e.preventDefault(); showPage("journal", true); });

  /* тема и язык */
  $("#themeBtn").addEventListener("click", () =>
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  $("#langBtn").addEventListener("click", () => setLang(LANG === "ru" ? "en" : "ru"));

  /* меню «Данные» */
  const menu = $("#dataMenu");
  const closeMenu = () => menu.removeAttribute("open");
  document.addEventListener("click", e => {
    $$("details.menu").forEach(m => { if(!m.contains(e.target)) m.removeAttribute("open"); });
  });

  $("#btnExport").addEventListener("click", () => { closeMenu(); exportJSON(); });
  $("#btnExcel").addEventListener("click", () => { closeMenu(); exportExcel(); });
  $("#btnImport").addEventListener("click", () => { closeMenu(); $("#importFile").click(); });
  $("#importFile").addEventListener("change", e => {
    if(e.target.files[0]) importJSON(e.target.files[0]);
    e.target.value = "";
  });
  $("#btnDemo").addEventListener("click", () => { closeMenu(); seedDemo(); });
  $("#btnGuide").addEventListener("click", () => { closeMenu(); Tour.start(); });
  $("#btnWipe").addEventListener("click", () => { closeMenu(); wipeAll(); });

  /* облако */
  Cloud.init();
  renderHeaderControls();

  /* страницы */
  renderJournalSwitcher();
  Journal.init();
  Backtest.init();

  /* гайд при первом заходе */
  if(!localStorage.getItem("mdt.tour.done")) setTimeout(() => Tour.start(), 800);
});
