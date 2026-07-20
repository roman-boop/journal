/* ============================================================
   core.js — данные, хранилище, общие компоненты
   ============================================================ */
"use strict";

const LS_KEY = "maniacdt.journal.v1";

/* ---------- определения столбцов (lk = ключ перевода) ---------- */
const COLUMN_DEFS = {
  realtime: [
    { id:"asset",     lk:"col_asset",     type:"text" },
    { id:"market",    lk:"col_market",    type:"select", opt:"market" },
    { id:"posType",   lk:"col_posType",   type:"select", opt:"posType" },
    { id:"model",     lk:"col_model",     type:"model" },
    { id:"timeframe", lk:"col_timeframe", type:"select", opt:"timeframe" },
    { id:"time",      lk:"col_time",      type:"time" },
    { id:"direction", lk:"col_direction", type:"select", opt:"direction" },
    { id:"size",      lk:"col_size",      type:"number" },
    { id:"entry",     lk:"col_entry",     type:"number" },
    { id:"exit",      lk:"col_exit",      type:"number" },
    { id:"stop",      lk:"col_stop",      type:"number" },
    { id:"take",      lk:"col_take",      type:"number" },
    { id:"result",    lk:"col_result",    type:"result" },
    { id:"note",      lk:"col_note",      type:"textarea" }
  ],
  backtest: [
    { id:"entryTime", lk:"col_entryTime", type:"datetime" },
    { id:"timeframe", lk:"col_timeframe", type:"select", opt:"timeframe" },
    { id:"model",     lk:"col_model",     type:"model" },
    { id:"posType",   lk:"col_posType",   type:"select", opt:"posType" },
    { id:"direction", lk:"col_direction", type:"select", opt:"direction" },
    { id:"size",      lk:"col_size",      type:"number" },
    { id:"entry",     lk:"col_entry",     type:"number" },
    { id:"exit",      lk:"col_exit",      type:"number" },
    { id:"stop",      lk:"col_stop",      type:"number" },
    { id:"take",      lk:"col_take",      type:"number" },
    { id:"result",    lk:"col_result",    type:"result" },
    { id:"note",      lk:"col_note",      type:"textarea" }
  ]
};

const colLabel = c => c.lk ? t(c.lk) : c.label;

const DEFAULT_ENABLED = {
  realtime: ["asset","market","posType","model","timeframe","result","note"],
  backtest: ["entryTime","timeframe","model","result","note"]
};

const DEFAULT_LISTS = () => ({
  market:    ["crypto","commodities","indices","forex"],
  posType:   ["scalp","intraday","intraweek","swing"],
  direction: ["long","short"],
  timeframe: ["m1","m3","m5","m15","h1","h4","1D"]
});

const DEFAULT_MODELS = () => ([
  { id: uid(), name:"classic reversal 1h5m",  described:false, desc:"", risk:"", tfs:"", examples:[] },
  { id: uid(), name:"classic reversal 4h15m", described:false, desc:"", risk:"", tfs:"", examples:[] },
  { id: uid(), name:"AMD",                    described:false, desc:"", risk:"", tfs:"", examples:[] },
  { id: uid(), name:"smt+inversion",          described:false, desc:"", risk:"", tfs:"", examples:[] }
]);

/* ---------- данные ---------- */
function defaultData(){
  return {
    version: 1,
    settings: {
      realtime: { enabled:[...DEFAULT_ENABLED.realtime], customCols:[], lists:DEFAULT_LISTS(), models:DEFAULT_MODELS() },
      backtest: { enabled:[...DEFAULT_ENABLED.backtest], customCols:[], lists:DEFAULT_LISTS(), models:DEFAULT_MODELS() }
    },
    trades: [],
    sessions: []
  };
}

function validData(d){
  return d && typeof d === "object" && d.settings && d.settings.realtime && d.settings.backtest
    && Array.isArray(d.trades) && Array.isArray(d.sessions);
}

let DATA = loadData();

function loadData(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return defaultData();
    const d = JSON.parse(raw);
    return validData(d) ? d : defaultData();
  }catch(e){ return defaultData(); }
}

function saveData(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(DATA));
  }catch(e){
    toast(t("storage_full"), true);
  }
  if(typeof Cloud !== "undefined") Cloud.schedulePush();
}

/* ---------- утилиты ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => (
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]
  ));
}

function localISO(d){
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function todayISO(){ return localISO(new Date()); }

function parseNum(v){
  if(v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/\s/g, "").replace(/,/g, "."));
  return isFinite(n) ? n : null;
}

function fmtPct(v, digits=2){
  if(v === null || v === undefined || !isFinite(v)) return "—";
  const r = Math.round(v * 10**digits) / 10**digits;
  return (r > 0 ? "+" : "") + r.toLocaleString(LANG === "ru" ? "ru-RU" : "en-US", {maximumFractionDigits:digits}) + "%";
}

function fmtNum(v){
  if(v === null || v === undefined || v === "") return "";
  const n = parseNum(v);
  return n === null ? esc(v) : n.toLocaleString(LANG === "ru" ? "ru-RU" : "en-US", {maximumFractionDigits:8});
}

function numDisplay(v){
  const s = String(v ?? "");
  return LANG === "ru" ? s.replace(".", ",") : s.replace(",", ".");
}

/* автозамена разделителя в числовых полях */
document.addEventListener("input", e => {
  const el = e.target;
  if(!(el instanceof HTMLInputElement) || !el.classList.contains("in-num")) return;
  const bad = LANG === "ru" ? "." : ",";
  const good = LANG === "ru" ? "," : ".";
  if(el.value.includes(bad)){
    const pos = el.selectionStart;
    el.value = el.value.split(bad).join(good);
    try{ el.setSelectionRange(pos, pos); }catch(_){}
  }
});

function fmtDateShort(iso){
  if(!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return t("daysShort")[d.getDay()] + " " + String(d.getDate()).padStart(2,"0") + "." + String(d.getMonth()+1).padStart(2,"0");
}

function fmtDT(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(isNaN(d)) return esc(iso);
  return String(d.getDate()).padStart(2,"0") + "." + String(d.getMonth()+1).padStart(2,"0") + "." + d.getFullYear()
    + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
}

function fmtDateHuman(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(isNaN(d)) return esc(iso);
  return d.getDate() + " " + t("monthsGen")[d.getMonth()] + " " + d.getFullYear();
}

/* ---------- тосты ---------- */
function toast(msg, isErr=false){
  const el = document.createElement("div");
  el.className = "toast" + (isErr ? " err" : "");
  el.textContent = msg;
  $("#toastRoot").appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .3s"; }, 2600);
  setTimeout(()=> el.remove(), 3000);
}

/* ---------- модальные окна ---------- */
function openModal(html, { wide=false, onMount } = {}){
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<div class="modal${wide ? " modal-wide" : ""}">${html}</div>`;
  overlay.addEventListener("mousedown", e => { if(e.target === overlay) closeModal(); });
  $("#modalRoot").appendChild(overlay);
  const kb = e => { if(e.key === "Escape") closeModal(); };
  overlay._kb = kb;
  document.addEventListener("keydown", kb);
  const x = $(".modal-x", overlay);
  if(x) x.addEventListener("click", closeModal);
  if(onMount) onMount(overlay);
  return overlay;
}

function closeModal(){
  const ov = $("#modalRoot .overlay:not(.lb)");
  if(ov){
    document.removeEventListener("keydown", ov._kb);
    ov.remove();
  }
}

function modalShell(title, bodyHtml, footHtml=""){
  return `
    <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-x" aria-label="${esc(t("close"))}">✕</button></div>
    <div class="modal-body">${bodyHtml}</div>
    ${footHtml ? `<div class="modal-foot">${footHtml}</div>` : ""}`;
}

/* ---------- настройки области ---------- */
function scopeSettings(scope){ return DATA.settings[scope]; }

function getColumns(scope){
  const st = scopeSettings(scope);
  const builtIn = COLUMN_DEFS[scope].filter(c => st.enabled.includes(c.id));
  const custom = st.customCols.filter(c => c.enabled !== false)
    .map(c => ({ id:c.id, label:c.label, type:c.type, custom:true }));
  return [...builtIn, ...custom];
}

/* ============================================================
   Редактор столбцов
   ============================================================ */
function openColumnsEditor(scope, onChange){
  const render = () => {
    const st = scopeSettings(scope);
    const typeName = ty => ({text:t("t_text"), number:t("t_number"), select:t("t_select"), model:t("t_select"),
      time:t("t_time"), datetime:t("t_datetime"), result:t("t_result"), textarea:t("t_text")}[ty] || ty);

    const rows = COLUMN_DEFS[scope].map(c => `
      <div class="col-row">
        <label class="switch"><input type="checkbox" data-col="${c.id}" ${st.enabled.includes(c.id) ? "checked" : ""}><i></i></label>
        <span class="c-name">${esc(colLabel(c))}</span>
        <span class="c-type">${typeName(c.type)}</span>
      </div>`).join("");

    const customRows = st.customCols.map(c => `
      <div class="col-row">
        <label class="switch"><input type="checkbox" data-ccol="${c.id}" ${c.enabled !== false ? "checked" : ""}><i></i></label>
        <span class="c-name">${esc(c.label)}</span>
        <span class="c-type">${typeName(c.type)} · ${t("t_own")}</span>
        <button class="icon-btn del" data-delcol="${c.id}" title="${esc(t("del"))}">${ICON_TRASH}</button>
      </div>`).join("");

    const body = `
      ${rows}
      <div class="col-divider">${t("own_cols")}</div>
      ${customRows || `<p class="hint" style="padding:4px 0 10px">${t("no_own_cols")}</p>`}
      <div class="opt-add" style="margin-top:12px">
        <input type="text" id="newColName" placeholder="${esc(t("col_name"))}" maxlength="40">
        <select id="newColType" class="crumb-select" style="font-family:var(--font-body);font-weight:500">
          <option value="text">${t("type_text")}</option>
          <option value="number">${t("type_number")}</option>
        </select>
        <button class="btn btn-primary" id="addColBtn">${t("add")}</button>
      </div>`;

    openModal(modalShell(t("cols_title"), body,
      `<button class="btn btn-primary" id="colsDone">${t("done")}</button>`), { onMount(ov){
      $$("input[data-col]", ov).forEach(inp => inp.addEventListener("change", () => {
        const id = inp.dataset.col;
        if(inp.checked){ if(!st.enabled.includes(id)) st.enabled.push(id); }
        else st.enabled = st.enabled.filter(x => x !== id);
        st.enabled = COLUMN_DEFS[scope].map(c=>c.id).filter(id2 => st.enabled.includes(id2));
        saveData(); onChange();
      }));
      $$("input[data-ccol]", ov).forEach(inp => inp.addEventListener("change", () => {
        const c = st.customCols.find(x => x.id === inp.dataset.ccol);
        if(c){ c.enabled = inp.checked; saveData(); onChange(); }
      }));
      $$("button[data-delcol]", ov).forEach(b => b.addEventListener("click", () => {
        if(!confirm(t("del_col_q"))) return;
        st.customCols = st.customCols.filter(x => x.id !== b.dataset.delcol);
        saveData(); onChange(); render();
      }));
      $("#addColBtn", ov).addEventListener("click", () => {
        const name = $("#newColName", ov).value.trim();
        if(!name){ toast(t("need_col_name"), true); return; }
        st.customCols.push({ id:"c_"+uid(), label:name, type:$("#newColType", ov).value, enabled:true });
        saveData(); onChange(); render();
      });
      $("#colsDone", ov).addEventListener("click", closeModal);
    }});
  };
  render();
}

/* ============================================================
   Редактор списков и моделей
   ============================================================ */
const LIST_TABS = [
  { key:"market",    lk:"tab_market" },
  { key:"posType",   lk:"tab_posType" },
  { key:"direction", lk:"tab_direction" },
  { key:"timeframe", lk:"tab_timeframe" },
  { key:"models",    lk:"tab_models" }
];

function openListsEditor(scope, onChange, startTab="market"){
  let tab = startTab;

  const render = () => {
    const st = scopeSettings(scope);
    const tabsHtml = LIST_TABS.map(x =>
      `<button class="opt-tab${x.key === tab ? " is-active" : ""}" data-tab="${x.key}">${t(x.lk)}</button>`).join("");

    let content = "";
    if(tab === "models"){
      content = st.models.map(m => `
        <div class="model-row">
          <span class="m-name">${esc(m.name)}</span>
          ${m.described ? `<span class="badge-desc">${t("described")}</span>` : ""}
          <button class="icon-btn" data-editmodel="${m.id}" title="${esc(t("edit"))}">${ICON_EDIT}</button>
          <button class="icon-btn del" data-delmodel="${m.id}" title="${esc(t("del"))}">${ICON_TRASH}</button>
        </div>`).join("")
        + `<button class="btn btn-ghost" id="addModelBtn" style="margin-top:8px">${t("add_model")}</button>`;
    }else{
      const list = st.lists[tab] || [];
      content = `
        <div class="opt-chips">
          ${list.map((v,i)=>`<span class="opt-chip">${esc(v)}<button data-del="${i}" title="${esc(t("del"))}">✕</button></span>`).join("")
            || `<p class="hint">${t("list_empty")}</p>`}
        </div>
        <div class="opt-add">
          <input type="text" id="newOptVal" placeholder="${esc(t("new_value"))}" maxlength="40">
          <button class="btn btn-primary" id="addOptBtn">${t("add")}</button>
        </div>`;
    }

    const scopeName = scope === "realtime" ? "Realtime journal" : "Backtest";
    openModal(modalShell(`${t("lists_title")} · ${scopeName}`,
      `<div class="opt-tabs">${tabsHtml}</div><div id="optContent">${content}</div>
       <p class="hint" style="margin-top:16px">${t("lists_note")}</p>`,
      `<button class="btn btn-primary" id="listsDone">${t("done")}</button>`),
      { wide:true, onMount(ov){
        $$(".opt-tab", ov).forEach(b => b.addEventListener("click", () => { tab = b.dataset.tab; render(); }));
        $("#listsDone", ov).addEventListener("click", closeModal);

        if(tab === "models"){
          const btnAdd = $("#addModelBtn", ov);
          if(btnAdd) btnAdd.addEventListener("click", () => openModelEditor(scope, null, () => { onChange(); render(); }));
          $$("button[data-editmodel]", ov).forEach(b => b.addEventListener("click", () =>
            openModelEditor(scope, b.dataset.editmodel, () => { onChange(); render(); })));
          $$("button[data-delmodel]", ov).forEach(b => b.addEventListener("click", () => {
            if(!confirm(t("del_model_q"))) return;
            st.models = st.models.filter(m => m.id !== b.dataset.delmodel);
            saveData(); onChange(); render();
          }));
        }else{
          const add = () => {
            const inp = $("#newOptVal", ov);
            const v = inp.value.trim();
            if(!v) return;
            if(st.lists[tab].includes(v)){ toast(t("value_exists"), true); return; }
            st.lists[tab].push(v);
            saveData(); onChange(); render();
          };
          $("#addOptBtn", ov).addEventListener("click", add);
          $("#newOptVal", ov).addEventListener("keydown", e => { if(e.key === "Enter") add(); });
          $$(".opt-chip button[data-del]", ov).forEach(b => b.addEventListener("click", () => {
            st.lists[tab].splice(+b.dataset.del, 1);
            saveData(); onChange(); render();
          }));
        }
      }});
  };
  render();
}

/* ============================================================
   Редактор модели входа
   ============================================================ */
function openModelEditor(scope, modelId, onDone){
  const st = scopeSettings(scope);
  const existing = modelId ? st.models.find(m => m.id === modelId) : null;
  const m = existing
    ? JSON.parse(JSON.stringify(existing))
    : { id:uid(), name:"", described:false, desc:"", risk:"", tfs:"", examples:[] };

  const render = () => {
    const extra = !m.described ? "" : `
      <div id="modelExtra">
        <div class="f-field f-wide" style="margin-top:13px">
          <label>${t("model_desc")}</label>
          <textarea id="mDesc" rows="4" placeholder="${esc(t("model_desc_ph"))}">${esc(m.desc)}</textarea>
        </div>
        <div class="f-field f-wide" style="margin-top:13px">
          <label>${t("risk_mgmt")}</label>
          <textarea id="mRisk" rows="3" placeholder="${esc(t("risk_ph"))}">${esc(m.risk)}</textarea>
        </div>
        <div class="f-field f-wide" style="margin-top:13px">
          <label>${t("model_tfs")}</label>
          <input type="text" id="mTfs" value="${esc(m.tfs)}" placeholder="${esc(t("model_tfs_ph"))}">
        </div>
        <div class="f-field f-wide" style="margin-top:13px">
          <label>${t("examples_photos")}</label>
          <div class="photo-grid" id="mPhotoGrid"></div>
        </div>
      </div>`;

    const body = `
      <div class="f-field f-wide">
        <label>${t("model_name")}</label>
        <input type="text" id="mName" value="${esc(m.name)}" placeholder="${esc(t("model_name_ph"))}" maxlength="60">
      </div>
      <label class="f-check" style="margin-top:14px">
        <input type="checkbox" id="mDescribed" ${m.described ? "checked" : ""}>
        ${t("describe_model")}
      </label>
      ${extra}`;

    openModal(modalShell(existing ? t("edit_model") : t("new_model"), body,
      `<button class="btn btn-ghost" id="mCancel">${t("cancel")}</button>
       <button class="btn btn-primary" id="mSave">${t("save")}</button>`),
      { wide:true, onMount(ov){
        const grid = $("#mPhotoGrid", ov);
        if(grid) renderPhotoGrid(grid, m.examples);
        $("#mDescribed", ov).addEventListener("change", e => {
          m.name = $("#mName", ov).value;
          grabExtra(ov);
          m.described = e.target.checked;
          render();
        });
        $("#mCancel", ov).addEventListener("click", closeModal);
        $("#mSave", ov).addEventListener("click", () => {
          m.name = $("#mName", ov).value.trim();
          grabExtra(ov);
          if(!m.name){ toast(t("need_model_name"), true); return; }
          const st2 = scopeSettings(scope);
          if(existing){
            const idx = st2.models.findIndex(x => x.id === m.id);
            if(idx >= 0) st2.models[idx] = m;
          }else{
            st2.models.push(m);
          }
          saveData(); closeModal();
          toast(t("model_saved"));
          if(onDone) onDone();
        });
      }});
  };

  const grabExtra = ov => {
    if(!m.described) return;
    const d = $("#mDesc", ov), r = $("#mRisk", ov), x = $("#mTfs", ov);
    if(d) m.desc = d.value;
    if(r) m.risk = r.value;
    if(x) m.tfs = x.value;
  };

  render();
}

/* компрессия фото → dataURL */
function compressImage(file, maxDim=1000, quality=0.72){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * k), h = Math.round(img.height * k);
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

/* лайтбокс поверх модалки */
function openLightbox(src){
  const ov = document.createElement("div");
  ov.className = "overlay lb";
  ov.style.zIndex = "140";
  ov.style.cursor = "zoom-out";
  ov.innerHTML = `<img class="lightbox-img" src="${src}" alt="" style="margin:auto;max-height:86vh">`;
  const close = () => { ov.remove(); document.removeEventListener("keydown", kb, true); };
  const kb = e => { if(e.key === "Escape"){ e.stopImmediatePropagation(); close(); } };
  ov.addEventListener("mousedown", close);
  document.addEventListener("keydown", kb, true);
  $("#modalRoot").appendChild(ov);
}

/* ---------- фото сделки ---------- */
function photoSectionHtml(){
  return `<div class="f-field f-wide"><label>${t("photos")}</label><div class="photo-grid" id="tPhotoGrid"></div></div>`;
}

function renderPhotoGrid(grid, photos){
  grid.innerHTML = photos.map((s, i) => `
    <div class="photo-thumb" data-view="${i}"><img src="${s}" alt=""><span class="ph-x" data-ph="${i}" title="${esc(t("del"))}">✕</span></div>`).join("")
    + `<label class="photo-add"><span>+</span>${t("photo_add")}<input type="file" accept="image/*" multiple hidden></label>`;

  grid.querySelector("input[type=file]").addEventListener("change", async e => {
    for(const f of [...e.target.files]){
      try{ photos.push(await compressImage(f)); }
      catch(err){ toast(t("photo_fail"), true); }
    }
    renderPhotoGrid(grid, photos);
  });
  grid.querySelectorAll(".ph-x").forEach(x => x.addEventListener("click", e => {
    e.stopPropagation();
    photos.splice(+x.dataset.ph, 1);
    renderPhotoGrid(grid, photos);
  }));
  grid.querySelectorAll(".photo-thumb").forEach(th =>
    th.addEventListener("click", () => openLightbox(photos[+th.dataset.view])));
}

function openTradeGallery(photos){
  if(!photos || !photos.length) return;
  const body = photos.map(s => `<img class="lightbox-img" src="${s}" alt="" style="margin-bottom:12px">`).join("");
  openModal(modalShell(`${t("trade_photos")} · ${photos.length}`, body), { wide:true });
}

/* карточка модели */
function openModelCard(scope, name){
  const st = scopeSettings(scope);
  const m = st.models.find(x => x.name === name);
  if(!m){ toast(t("model_not_found")); return; }
  if(!m.described){
    openModal(modalShell(m.name, `<p class="hint">${t("no_model_desc")}</p>`,
      `<button class="btn btn-ghost" id="mcEdit">${t("describe")}</button>`),
      { onMount(ov){ $("#mcEdit", ov).addEventListener("click", () => openModelEditor(scope, m.id, rerenderAll)); }});
    return;
  }
  const body = `
    ${m.desc ? `<div class="model-card-block"><h4>${t("description")}</h4><div class="model-card-desc">${esc(m.desc)}</div></div>` : ""}
    ${m.risk ? `<div class="model-card-block"><h4>${t("risk_mgmt")}</h4><div class="model-card-desc">${esc(m.risk)}</div></div>` : ""}
    ${m.tfs ? `<div class="model-card-block"><h4>${t("model_tfs")}</h4><div class="model-card-desc">${esc(m.tfs)}</div></div>` : ""}
    ${m.examples.length ? `<div class="model-card-block"><h4>${t("examples")}</h4>
      <div class="photo-grid">${m.examples.map((s,i)=>`<div class="photo-thumb" data-view="${i}"><img src="${s}" alt=""></div>`).join("")}</div></div>` : ""}`;
  openModal(modalShell(m.name, body,
    `<button class="btn btn-ghost" id="mcEdit">${t("edit")}</button>`),
    { wide:true, onMount(ov){
      $$(".photo-thumb", ov).forEach(x => x.addEventListener("click", () => openLightbox(m.examples[+x.dataset.view])));
      $("#mcEdit", ov).addEventListener("click", () => openModelEditor(scope, m.id, rerenderAll));
    }});
}

/* ============================================================
   Поля формы сделки (интерактивные)
   ============================================================ */
function fieldHtml(scope, col, value){
  const st = scopeSettings(scope);
  const v = value ?? "";
  const wide = (col.type === "textarea");
  const wrap = (inner, cls="") => `<div class="f-field${wide ? " f-wide" : ""}${cls}"><label>${esc(colLabel(col))}</label>${inner}</div>`;

  switch(col.type){
    case "select": {
      const list = st.lists[col.opt] || [];
      /* направление — крупные кнопки long/short */
      if(col.opt === "direction"){
        const btns = list.map(o => {
          const dcls = o.toLowerCase() === "long" ? "dir-long" : o.toLowerCase() === "short" ? "dir-short" : "";
          return `<button type="button" class="dir-btn ${dcls}${o === v ? " is-on" : ""}" data-pick="${esc(o)}">${esc(o)}</button>`;
        }).join("");
        return wrap(`<div class="dir-pick" data-pickgroup="${col.id}">${btns}
          <input type="hidden" data-f="${col.id}" value="${esc(v)}"></div>`);
      }
      /* остальные списки — чипы */
      const chips = list.map(o =>
        `<button type="button" class="pick${o === v ? " is-on" : ""}" data-pick="${esc(o)}">${esc(o)}</button>`).join("");
      const extra = v && !list.includes(v)
        ? `<button type="button" class="pick is-on" data-pick="${esc(v)}">${esc(v)}</button>` : "";
      return wrap(`<div class="pick-row" data-pickgroup="${col.id}">${chips}${extra}
        <input type="hidden" data-f="${col.id}" value="${esc(v)}"></div>`, " f-wide-sm");
    }
    case "model": {
      const chips = st.models.map(m =>
        `<button type="button" class="pick${m.name === v ? " is-on" : ""}" data-pick="${esc(m.name)}">${esc(m.name)}</button>`).join("");
      const extra = v && !st.models.some(m => m.name === v)
        ? `<button type="button" class="pick is-on" data-pick="${esc(v)}">${esc(v)}</button>` : "";
      return wrap(`<div class="pick-row" data-pickgroup="${col.id}">${chips}${extra}
        <input type="hidden" data-f="${col.id}" value="${esc(v)}"></div>`, " f-wide-sm");
    }
    case "number":
      return wrap(`<input type="text" inputmode="decimal" class="in-num" data-f="${col.id}" data-live="${col.id}" value="${esc(numDisplay(v))}">`);
    case "result": {
      const n = parseNum(v);
      const rcls = n === null ? "" : n > 0 ? " res-gain" : n < 0 ? " res-loss" : "";
      return wrap(`<div class="res-wrap${rcls}" id="resWrap">
        <input type="text" inputmode="decimal" class="in-num res-input" data-f="${col.id}" value="${esc(numDisplay(v))}" placeholder="+1,5">
        <span class="res-suffix">%</span>
      </div>`);
    }
    case "time":     return wrap(`<input type="time" data-f="${col.id}" value="${esc(v)}">`);
    case "datetime": return wrap(`<input type="datetime-local" data-f="${col.id}" value="${esc(v)}">`);
    case "textarea": return wrap(`<textarea rows="2" data-f="${col.id}">${esc(v)}</textarea>`);
    default:         return wrap(`<input type="text" data-f="${col.id}" value="${esc(v)}">`);
  }
}

/* поведение интерактивных элементов формы: чипы, результат, R:R */
function bindTradeFormUI(ov){
  /* чипы-выборы: клик выбирает, повторный клик снимает */
  $$("[data-pickgroup]", ov).forEach(group => {
    const hidden = group.querySelector("input[data-f]");
    group.querySelectorAll("[data-pick]").forEach(btn => btn.addEventListener("click", () => {
      const val = btn.dataset.pick;
      const on = btn.classList.contains("is-on");
      group.querySelectorAll("[data-pick]").forEach(b => b.classList.remove("is-on"));
      if(!on){ btn.classList.add("is-on"); hidden.value = val; }
      else hidden.value = "";
      updateRR(ov);
    }));
  });

  /* live-окраска результата */
  const resWrap = $("#resWrap", ov);
  if(resWrap){
    const inp = resWrap.querySelector("input");
    inp.addEventListener("input", () => {
      const n = parseNum(inp.value);
      resWrap.classList.toggle("res-gain", n !== null && n > 0);
      resWrap.classList.toggle("res-loss", n !== null && n < 0);
    });
  }

  /* R:R калькулятор */
  $$("[data-live]", ov).forEach(inp => inp.addEventListener("input", () => updateRR(ov)));
  updateRR(ov);
}

function updateRR(ov){
  const box = $("#rrBox", ov);
  if(!box) return;
  const get = id => { const el = ov.querySelector(`[data-f="${id}"]`); return el ? parseNum(el.value) : null; };
  const entry = get("entry"), stop = get("stop"), take = get("take");
  if(entry === null || stop === null || take === null || entry === stop){
    box.classList.remove("show");
    return;
  }
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(take - entry);
  const rr = reward / risk;
  box.classList.add("show");
  box.querySelector(".rr-val").textContent = "1 : " + (Math.round(rr * 100) / 100).toLocaleString(LANG === "ru" ? "ru-RU" : "en-US");
}

function rrBoxHtml(cols){
  const has = id => cols.some(c => c.id === id);
  if(!(has("entry") && has("stop") && has("take"))) return "";
  return `<div class="rr-box f-wide" id="rrBox">
    <span class="rr-label">${t("rr")}</span>
    <span class="rr-val mono">—</span>
    <span class="rr-hint">${t("rr_hint")}</span>
  </div>`;
}

function collectForm(ov){
  const values = {};
  $$("[data-f]", ov).forEach(inp => { values[inp.dataset.f] = inp.value.trim(); });
  return values;
}

/* ---------- ячейки таблицы ---------- */
function cellHtml(scope, col, values){
  const v = values[col.id];
  switch(col.id === "model" ? "model" : col.type){
    case "result": {
      const n = parseNum(v);
      if(n === null) return `<td class="num"><span class="chip chip-flat">—</span></td>`;
      const cls = n > 0 ? "chip-gain" : n < 0 ? "chip-loss" : "chip-flat";
      return `<td class="num"><span class="chip ${cls}">${fmtPct(n)}</span></td>`;
    }
    case "model": {
      if(!v) return `<td class="td-note">—</td>`;
      const st = scopeSettings(scope);
      const m = st.models.find(x => x.name === v);
      const cls = m && m.described ? " model-link" : "";
      return `<td class="td-model"><span class="m-ell${cls}" title="${esc(v)}" ${m && m.described ? `data-modelcard="${esc(v)}"` : ""}>${esc(v)}</span></td>`;
    }
    case "select": {
      if(!v) return `<td class="td-note">—</td>`;
      if(col.id === "direction"){
        const cls = v === "long" ? "chip-long" : v === "short" ? "chip-short" : "";
        return `<td><span class="chip ${cls}">${esc(v)}</span></td>`;
      }
      return `<td><span class="chip">${esc(v)}</span></td>`;
    }
    case "number":   return `<td class="num">${fmtNum(v)}</td>`;
    case "time":     return `<td class="num">${esc(v || "")}</td>`;
    case "datetime": return `<td class="td-date">${fmtDT(v)}</td>`;
    case "textarea": return `<td class="td-note" title="${esc(v || "")}">${esc(v || "") || "—"}</td>`;
    default:         return `<td>${esc(v || "") || "—"}</td>`;
  }
}

const ICON_EDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>`;
const ICON_CAM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;

/* общий рендер таблицы сделок */
function tradesTableHtml(scope, rows, columns, { dateCol=false } = {}){
  if(!rows.length){
    return `<div class="empty">
      <div class="e-title">${t("no_trades_yet")}</div>
      <div class="e-sub">${t("add_first")}</div>
    </div>`;
  }
  const head = `<tr>${dateCol ? `<th>${t("date")}</th>` : ""}${columns.map(c => `<th>${esc(colLabel(c))}</th>`).join("")}<th></th></tr>`;
  const body = rows.map(x => {
    const ph = x.photos && x.photos.length
      ? `<button class="icon-btn photo-ind" data-gallery="${x.id}" title="${esc(t("photos"))}: ${x.photos.length}">${ICON_CAM}<span class="ph-count">${x.photos.length}</span></button>`
      : "";
    return `
    <tr data-id="${x.id}">
      ${dateCol ? `<td class="td-date">${fmtDateShort(x.date)}</td>` : ""}
      ${columns.map(c => cellHtml(scope, c, x.values)).join("")}
      <td><div class="row-cell">${ph}<div class="row-actions">
        <button class="icon-btn" data-edit="${x.id}" title="${esc(t("edit"))}">${ICON_EDIT}</button>
        <button class="icon-btn del" data-del="${x.id}" title="${esc(t("del"))}">${ICON_TRASH}</button>
      </div></div></td>
    </tr>`;
  }).join("");
  return `<table class="j"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function bindTableActions(container, scope, { onEdit, onDelete, onGallery }){
  $$("[data-edit]", container).forEach(b => b.addEventListener("click", e => { e.stopPropagation(); onEdit(b.dataset.edit); }));
  $$("[data-del]", container).forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    if(confirm(t("del_trade_q"))) onDelete(b.dataset.del);
  }));
  $$("[data-gallery]", container).forEach(b => b.addEventListener("click", e => { e.stopPropagation(); onGallery && onGallery(b.dataset.gallery); }));
  $$("[data-modelcard]", container).forEach(el =>
    el.addEventListener("click", e => { e.stopPropagation(); openModelCard(scope, el.dataset.modelcard); }));
  /* клик по строке = редактирование (работает и на сенсорных без hover) */
  $$("tbody tr[data-id]", container).forEach(tr => tr.addEventListener("click", e => {
    if(e.target.closest("button, a, [data-modelcard], input, select, textarea")) return;
    onEdit(tr.dataset.id);
  }));
}

/* ============================================================
   Экспорт / импорт / Excel / демо
   ============================================================ */
function exportJSON(){
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "maniacdt-journal-" + todayISO() + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast(t("export_ready"));
}

function importJSON(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const d = JSON.parse(reader.result);
      if(!validData(d)) throw new Error("bad format");
      DATA = d;
      saveData();
      rerenderAll();
      toast(t("imported"));
    }catch(e){ toast(t("bad_file"), true); }
  };
  reader.readAsText(file);
}

/* бекап в Excel: Realtime + Backtest + Models */
function exportExcel(){
  if(typeof XLSX === "undefined"){ toast(t("xlsx_missing"), true); return; }
  const wb = XLSX.utils.book_new();
  const numeric = ty => ty === "number" || ty === "result";
  const cellVal = (c, v) => numeric(c.type) ? (parseNum(v) ?? "") : (v ?? "");

  /* Realtime */
  const rtCols = [...COLUMN_DEFS.realtime, ...DATA.settings.realtime.customCols];
  const rtRows = [...DATA.trades]
    .sort((a, b) => (a.date + (a.values.time || "")) < (b.date + (b.values.time || "")) ? -1 : 1)
    .map(x => {
      const row = { [t("date")]: x.date };
      rtCols.forEach(c => { row[colLabel(c)] = cellVal(c, x.values[c.id]); });
      return row;
    });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rtRows.length ? rtRows : [{}]), "Realtime");

  /* Backtest */
  const btCols = [...COLUMN_DEFS.backtest, ...DATA.settings.backtest.customCols];
  const btRows = [];
  DATA.sessions.forEach(s => {
    [...s.trades]
      .sort((a, b) => (a.values.entryTime || a.createdAt || "") < (b.values.entryTime || b.createdAt || "") ? -1 : 1)
      .forEach(x => {
        const row = { [t("session")]: s.asset };
        btCols.forEach(c => { row[colLabel(c)] = cellVal(c, x.values[c.id]); });
        btRows.push(row);
      });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(btRows.length ? btRows : [{}]), "Backtest");

  /* Models */
  const modelRows = [];
  ["realtime","backtest"].forEach(scope => DATA.settings[scope].models.forEach(m => modelRows.push({
    Scope: scope,
    [t("model_name")]: m.name,
    [t("description")]: m.desc || "",
    [t("risk_mgmt")]: m.risk || "",
    [t("model_tfs")]: m.tfs || ""
  })));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(modelRows.length ? modelRows : [{}]), "Models");

  XLSX.writeFile(wb, "maniacdt-journal-" + todayISO() + ".xlsx");
  toast(t("excel_ready"));
}

function wipeAll(){
  if(!confirm(t("wipe_q"))) return;
  DATA = defaultData();
  saveData();
  rerenderAll();
  toast(t("wiped"));
}

function seedDemo(){
  if(!confirm(t("demo_q"))) return;
  const st = DATA.settings.realtime;
  const assets = [["BTCUSDT","crypto"],["ETHUSDT","crypto"],["XAUUSD","commodities"],["EURUSD","forex"],["NQ","indices"]];
  const models = st.models.map(m => m.name);
  const tfs = st.lists.timeframe;
  const pts = st.lists.posType;
  const now = new Date();
  for(let i = 0; i < 46; i++){
    const d = new Date(now);
    d.setDate(d.getDate() - Math.floor(Math.random() * 92));
    const [asset, market] = assets[Math.floor(Math.random() * assets.length)];
    const win = Math.random() < 0.56;
    const r = win ? +(0.4 + Math.random() * 2.6).toFixed(2) : -+(0.3 + Math.random() * 1.4).toFixed(2);
    DATA.trades.push({
      id: uid(),
      date: localISO(d),
      createdAt: d.toISOString(),
      values: {
        asset, market,
        posType: pts[Math.floor(Math.random() * pts.length)],
        model: models[Math.floor(Math.random() * models.length)],
        timeframe: tfs[Math.floor(Math.random() * tfs.length)],
        time: String(8 + Math.floor(Math.random() * 12)).padStart(2,"0") + ":" + String(Math.floor(Math.random() * 60)).padStart(2,"0"),
        direction: Math.random() < 0.5 ? "long" : "short",
        result: String(r),
        note: ""
      },
      photos: []
    });
  }
  const sess = { id: uid(), asset:"BTCUSDT", from:"2024-01-01T00:00", to:"2024-06-30T00:00", createdAt: now.toISOString(), trades: [] };
  const bst = DATA.settings.backtest;
  for(let i = 0; i < 28; i++){
    const d = new Date(2024, 0, 1 + Math.floor(Math.random() * 180), 9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
    const win = Math.random() < 0.6;
    const r = win ? +(0.5 + Math.random() * 2.4).toFixed(2) : -+(0.3 + Math.random() * 1.2).toFixed(2);
    sess.trades.push({
      id: uid(),
      createdAt: d.toISOString(),
      values: {
        entryTime: localISO(d) + "T" + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"),
        timeframe: bst.lists.timeframe[Math.floor(Math.random() * bst.lists.timeframe.length)],
        model: bst.models[Math.floor(Math.random() * bst.models.length)].name,
        result: String(r),
        note: ""
      },
      photos: []
    });
  }
  DATA.sessions.push(sess);
  saveData();
  rerenderAll();
  toast(t("demo_added"));
}
