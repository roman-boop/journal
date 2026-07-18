/* ============================================================
   main.js — навигация, тема, язык, аккаунт, инициализация
   ============================================================ */
"use strict";

let currentPage = "journal";
let statsInited = false;

function showPage(page){
  currentPage = page;
  $$(".tab").forEach(x => x.classList.toggle("is-active", x.dataset.page === page));
  $$(".page").forEach(p => p.classList.remove("is-active"));
  const el = $("#page-" + page);
  void el.offsetWidth;
  el.classList.add("is-active");

  if(page === "stats"){
    if(!statsInited){ initStats(); statsInited = true; }
    renderStats();
  }
  if(page === "backtest") Backtest.render();
  if(page === "journal") Journal.render();
}

function rerenderAll(){
  Journal.render();
  Backtest.render();
  if(statsInited) renderStats();
  showPage(currentPage);
  applyStaticI18n();
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
  $$(".tab").forEach(x => x.addEventListener("click", () => showPage(x.dataset.page)));
  $("#brandLink").addEventListener("click", e => { e.preventDefault(); showPage("journal"); });

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
  $("#btnWipe").addEventListener("click", () => { closeMenu(); wipeAll(); });

  /* облако */
  Cloud.init();
  renderHeaderControls();

  /* страницы */
  Journal.init();
  Backtest.init();
});
