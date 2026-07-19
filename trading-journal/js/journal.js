/* ============================================================
   journal.js — Realtime journal (недели + календарь)
   ============================================================ */
"use strict";

const Journal = (() => {
  const now = new Date();
  const state = {
    y: now.getFullYear(),
    m: now.getMonth(),
    w: 0,
    view: "week",
    day: todayISO()
  };

  function weeksOfMonth(y, m){
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const weeks = [];
    let start = new Date(first);
    while(start <= last){
      const dow = (start.getDay() + 6) % 7;
      let end = new Date(start);
      end.setDate(start.getDate() + (6 - dow));
      if(end > last) end = new Date(last);
      weeks.push({ start: new Date(start), end });
      start = new Date(end);
      start.setDate(end.getDate() + 1);
    }
    weeks.forEach(w => {
      const days = Math.round((w.end - w.start) / 86400000) + 1;
      w.partial = days < 7;
    });
    return weeks;
  }

  const iso = localISO;
  const monthPrefix = () => state.y + "-" + String(state.m + 1).padStart(2,"0");

  function currentWeekIndex(weeks){
    const x = todayISO();
    const idx = weeks.findIndex(w => iso(w.start) <= x && x <= iso(w.end));
    return idx >= 0 ? idx : weeks.length - 1;
  }

  function goToToday(){
    const d = new Date();
    state.y = d.getFullYear();
    state.m = d.getMonth();
    state.day = todayISO();
    state.w = currentWeekIndex(weeksOfMonth(state.y, state.m));
  }

  function rangeLabel(w){
    const s = w.start, e = w.end;
    if(s.getMonth() === e.getMonth())
      return `${s.getDate()}–${e.getDate()} ${t("monthsGen")[e.getMonth()]}`;
    return `${s.getDate()} ${t("monthsGen")[s.getMonth()]} – ${e.getDate()} ${t("monthsGen")[e.getMonth()]}`;
  }

  const byTime = (a, b) => (a.date + (a.values.time || "")) < (b.date + (b.values.time || "")) ? -1 : 1;

  function tradesOfWeek(w){
    const a = iso(w.start), b = iso(w.end);
    return DATA.trades.filter(x => x.date >= a && x.date <= b).sort(byTime);
  }

  function tradesOfDay(dISO){
    return DATA.trades.filter(x => x.date === dISO).sort(byTime);
  }

  function monthMap(){
    const pref = monthPrefix();
    const map = {};
    DATA.trades.forEach(x => {
      if(!x.date || !x.date.startsWith(pref)) return;
      const e = map[x.date] || (map[x.date] = { n:0, sum:0, has:false });
      e.n++;
      const r = parseNum(x.values.result);
      if(r !== null){ e.sum += r; e.has = true; }
    });
    return map;
  }

  function calendarHtml(){
    const map = monthMap();
    const first = new Date(state.y, state.m, 1);
    const last = new Date(state.y, state.m + 1, 0);
    const lead = (first.getDay() + 6) % 7;
    let cells = "";
    for(let i = 0; i < lead; i++) cells += `<div class="cal-day cal-blank"></div>`;
    for(let d = 1; d <= last.getDate(); d++){
      const dISO = monthPrefix() + "-" + String(d).padStart(2,"0");
      const e = map[dISO];
      const tint = e && e.has ? (e.sum > 0 ? " d-gain" : e.sum < 0 ? " d-loss" : "") : "";
      cells += `<button class="cal-day${dISO === state.day ? " is-active" : ""}${dISO === todayISO() ? " is-today" : ""}${tint}" data-day="${dISO}">
        <span class="d-num">${d}</span>
        ${e ? `<span class="d-cnt">${e.n}</span>` : ""}
        ${e && e.has ? `<span class="d-res ${e.sum > 0 ? "pos" : e.sum < 0 ? "neg" : ""}">${fmtPct(e.sum, 1)}</span>` : ""}
      </button>`;
    }
    return `<div class="cal-block">
              <div class="cal-dows">${t("dowRow").map(x => `<span>${x}</span>`).join("")}</div>
              <div class="cal-grid">${cells}</div>
            </div>`;
  }

  function summaryHtml(rows, emptyText){
    if(!rows.length) return `<span>${emptyText}</span>`;
    const results = rows.map(x => parseNum(x.values.result)).filter(v => v !== null);
    const sum = results.reduce((s, v) => s + v, 0);
    const wins = results.filter(v => v > 0).length;
    return `<span>${t("trades_c")}: <b>${rows.length}</b></span>
      <span>${t("result")}: <b class="${sum > 0 ? "pos" : sum < 0 ? "neg" : ""}">${fmtPct(sum)}</b></span>
      <span>${t("winrate")}: <b>${results.length ? Math.round(wins / results.length * 100) + "%" : "—"}</b></span>`;
  }

  /* ---------- рендер ---------- */
  function render(){
    const weeks = weeksOfMonth(state.y, state.m);
    if(state.w >= weeks.length) state.w = weeks.length - 1;
    if(!state.day.startsWith(monthPrefix())){
      state.day = todayISO().startsWith(monthPrefix()) ? todayISO() : monthPrefix() + "-01";
    }

    const years = new Set([now.getFullYear() - 3, now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]);
    DATA.trades.forEach(x => { if(x.date) years.add(+x.date.slice(0, 4)); });
    const yearOpts = [...years].sort().map(y => `<option value="${y}" ${y === state.y ? "selected" : ""}>${y}</option>`).join("");
    const monthOpts = t("months").map((n, i) => `<option value="${i}" ${i === state.m ? "selected" : ""}>${n}</option>`).join("");

    $("#jCrumbs").innerHTML = `
      <select class="crumb-select" id="jYear">${yearOpts}</select>
      <span class="sep">→</span>
      <select class="crumb-select" id="jMonth">${monthOpts}</select>
      <button class="btn btn-ghost btn-sm" id="jToday">${t("today")}</button>
      <div class="segmented" id="jViewSeg">
        <button class="seg${state.view === "week" ? " is-active" : ""}" data-view="week">${t("weeks")}</button>
        <button class="seg${state.view === "day" ? " is-active" : ""}" data-view="day">${t("calendar")}</button>
      </div>`;

    $("#jYear").addEventListener("change", e => { state.y = +e.target.value; state.w = 0; render(); });
    $("#jMonth").addEventListener("change", e => { state.m = +e.target.value; state.w = 0; render(); });
    $("#jToday").addEventListener("click", () => { goToToday(); render(); });
    $$("#jViewSeg .seg").forEach(b => b.addEventListener("click", () => { state.view = b.dataset.view; render(); }));

    let rows;

    if(state.view === "week"){
      const week = weeks[state.w];
      $("#jWeeks").innerHTML = weeks.map((w, i) => {
        const cnt = tradesOfWeek(w).length;
        return `<button class="week-pill${i === state.w ? " is-active" : ""}${w.partial ? " is-partial" : ""}" data-w="${i}">
          <span class="wk-name">${t("week")} ${i + 1}</span>
          <span class="wk-range">${rangeLabel(w)}</span>
          ${cnt ? `<span class="wk-badge">${cnt}</span>` : ""}
        </button>`;
      }).join("");
      $$("#jWeeks .week-pill").forEach(b => b.addEventListener("click", () => { state.w = +b.dataset.w; render(); }));

      rows = tradesOfWeek(week);
      $("#jSummary").innerHTML = summaryHtml(rows, t("no_trades_week"));
      $("#jTitle").textContent = `${t("week")} ${state.w + 1} · ${rangeLabel(week)} ${state.y}`;
    }else{
      $("#jWeeks").innerHTML = calendarHtml();
      $$("#jWeeks .cal-day[data-day]").forEach(b => b.addEventListener("click", () => { state.day = b.dataset.day; render(); }));

      rows = tradesOfDay(state.day);
      const d = new Date(state.day + "T12:00:00");
      $("#jSummary").innerHTML = summaryHtml(rows, t("no_trades_day"));
      $("#jTitle").textContent = `${t("daysFull")[d.getDay()]}, ${d.getDate()} ${t("monthsGen")[d.getMonth()]} ${d.getFullYear()}`;
    }

    const cols = getColumns("realtime");
    const tbl = $("#jTable");
    tbl.innerHTML = tradesTableHtml("realtime", rows, cols, { dateCol: state.view === "week" });
    bindTableActions(tbl, "realtime", {
      onEdit: id => openTradeForm(id),
      onDelete: id => {
        DATA.trades = DATA.trades.filter(x => x.id !== id);
        saveData(); render();
        toast(t("trade_deleted"));
      },
      onGallery: id => {
        const x = DATA.trades.find(y => y.id === id);
        if(x) openTradeGallery(x.photos);
      }
    });
  }

  /* ---------- форма сделки ---------- */
  function openTradeForm(tradeId){
    const existing = tradeId ? DATA.trades.find(x => x.id === tradeId) : null;
    const cols = getColumns("realtime");
    const photos = existing && existing.photos ? [...existing.photos] : [];

    let defDate;
    if(existing) defDate = existing.date;
    else if(state.view === "day") defDate = state.day;
    else{
      const week = weeksOfMonth(state.y, state.m)[state.w];
      defDate = (iso(week.start) <= todayISO() && todayISO() <= iso(week.end)) ? todayISO() : iso(week.start);
    }

    const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return localISO(d); };

    const body = `<div class="f-grid">
      <div class="f-field f-wide">
        <label>${t("date")}</label>
        <div class="date-row">
          <input type="date" id="tDate" value="${defDate}">
          <button type="button" class="btn btn-ghost btn-sm" data-qd="today">${t("today")}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-qd="yesterday">${t("yesterday")}</button>
        </div>
      </div>
      ${cols.map(c => fieldHtml("realtime", c, existing ? existing.values[c.id] : "")).join("")}
      ${rrBoxHtml(cols)}
      ${photoSectionHtml()}
    </div>`;

    openModal(modalShell(existing ? t("edit_trade") : t("new_trade"), body,
      `<button class="btn btn-ghost" id="tCancel">${t("cancel")}</button>
       <button class="btn btn-primary" id="tSave">${existing ? t("save") : t("add")}</button>`),
      { wide:true, onMount(ov){
        bindTradeFormUI(ov);
        renderPhotoGrid($("#tPhotoGrid", ov), photos);
        $$("[data-qd]", ov).forEach(b => b.addEventListener("click", () => {
          $("#tDate", ov).value = b.dataset.qd === "today" ? todayISO() : yesterday();
        }));
        $("#tCancel", ov).addEventListener("click", closeModal);
        const save = () => {
          const date = $("#tDate", ov).value;
          if(!date){ toast(t("need_date"), true); return; }
          const values = collectForm(ov);
          if(existing){
            existing.date = date;
            existing.values = { ...existing.values, ...values };
            existing.photos = photos;
          }else{
            DATA.trades.push({ id: uid(), date, createdAt: new Date().toISOString(), values, photos });
          }
          saveData(); closeModal();
          state.y = +date.slice(0, 4);
          state.m = +date.slice(5, 7) - 1;
          state.day = date;
          state.w = weeksOfMonth(state.y, state.m).findIndex(w => iso(w.start) <= date && date <= iso(w.end));
          if(state.w < 0) state.w = 0;
          render();
          toast(existing ? t("trade_updated") : t("trade_added"));
        };
        $("#tSave", ov).addEventListener("click", save);
        ov.addEventListener("keydown", e => { if(e.key === "Enter" && e.ctrlKey) save(); });
      }});
  }

  function init(){
    goToToday();
    $("#jBtnAdd").addEventListener("click", () => openTradeForm(null));
    $("#jBtnCols").addEventListener("click", () => openColumnsEditor("realtime", render));
    $("#jBtnLists").addEventListener("click", () => openListsEditor("realtime", render));
    render();
  }

  return { init, render };
})();
