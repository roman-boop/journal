/* ============================================================
   backtest.js — сессии бектеста, журнал сессии, сводка
   ============================================================ */
"use strict";

const Backtest = (() => {
  const state = { view:"list", sessionId:null };

  function sessionById(id){ return DATA.sessions.find(s => s.id === id); }

  function sessionItems(s){
    return s.trades.map(x => ({
      t: x.values.entryTime ? new Date(x.values.entryTime) : new Date(x.createdAt || Date.now()),
      r: parseNum(x.values.result),
      model: x.values.model || "—",
      tf: x.values.timeframe || "—"
    }));
  }

  function periodLabel(s){
    if(!s.from && !s.to) return t("period_not_set");
    const f = s.from ? fmtDateHuman(s.from) : "…";
    const x = s.to ? fmtDateHuman(s.to) : "…";
    return f + " → " + x;
  }

  /* ---------- список сессий ---------- */
  function renderList(){
    const root = $("#btRoot");
    const cards = DATA.sessions.map(s => {
      const st = computeStats(sessionItems(s));
      const chips = st.n ? `
        <span class="chip ${st.total > 0 ? "chip-gain" : st.total < 0 ? "chip-loss" : "chip-flat"}">${fmtPct(st.total)}</span>
        <span class="chip">WR ${Math.round(st.winrate)}%</span>
        <span class="chip">PF ${fmtPF(st.pf)}</span>`
        : `<span class="chip chip-flat">${t("no_sessions")}</span>`;
      return `<div class="card sess-card" data-open="${s.id}" role="button" tabindex="0">
        <button class="icon-btn del sess-del" data-delsess="${s.id}" title="${esc(t("del"))}">${ICON_TRASH}</button>
        <div class="sess-asset">${esc(s.asset)}</div>
        <div class="sess-period">${esc(periodLabel(s))}</div>
        <div class="sess-stats">${chips}<span class="chip">${s.trades.length} ${t("trades_short")}</span></div>
      </div>`;
    }).join("");

    root.innerHTML = `<div class="sess-grid">
      ${cards}
      <div class="card sess-new" id="btNew" role="button" tabindex="0">
        <span class="plus">+</span>${t("new_session")}
      </div>
    </div>
    ${DATA.sessions.length ? "" : `<p class="hint" style="margin-top:16px">${t("bt_hint")}</p>`}`;

    $("#btNew").addEventListener("click", openWizard);
    $$("[data-open]", root).forEach(c => {
      c.addEventListener("click", e => {
        if(e.target.closest("[data-delsess]")) return;
        state.view = "session"; state.sessionId = c.dataset.open; render();
      });
      c.addEventListener("keydown", e => { if(e.key === "Enter") c.click(); });
    });
    $$("[data-delsess]", root).forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      if(!confirm(t("del_session_q"))) return;
      DATA.sessions = DATA.sessions.filter(s => s.id !== b.dataset.delsess);
      saveData(); render();
      toast(t("session_deleted"));
    }));
  }

  /* ---------- визард ---------- */
  function openWizard(){
    const draft = { asset:"", from:"", to:"" };

    const render1 = () => openModal(modalShell(t("new_bt_session"),
      `<div class="wiz-steps"><span class="wiz-step done"></span><span class="wiz-step"></span></div>
       <div class="f-field f-wide">
         <label>${t("asset")}</label>
         <input type="text" id="wAsset" value="${esc(draft.asset)}" placeholder="${esc(t("asset_ph"))}" maxlength="30">
       </div>`,
      `<button class="btn btn-ghost" id="wCancel">${t("cancel")}</button>
       <button class="btn btn-primary" id="wNext">${t("next")}</button>`),
      { onMount(ov){
        $("#wCancel", ov).addEventListener("click", closeModal);
        const next = () => {
          draft.asset = $("#wAsset", ov).value.trim();
          if(!draft.asset){ toast(t("asset"), true); return; }
          render2();
        };
        $("#wNext", ov).addEventListener("click", next);
        $("#wAsset", ov).addEventListener("keydown", e => { if(e.key === "Enter") next(); });
        $("#wAsset", ov).focus();
      }});

    const render2 = () => openModal(modalShell(`${t("period_of")} · ${esc(draft.asset)}`,
      `<div class="wiz-steps"><span class="wiz-step done"></span><span class="wiz-step done"></span></div>
       <div class="f-grid">
         <div class="f-field"><label>${t("period_from")}</label><input type="datetime-local" id="wFrom" value="${draft.from}"></div>
         <div class="f-field"><label>${t("period_to")}</label><input type="datetime-local" id="wTo" value="${draft.to}"></div>
       </div>
       <p class="hint" style="margin-top:12px">${t("period_hint")}</p>`,
      `<button class="btn btn-ghost" id="wBack">${t("back")}</button>
       <button class="btn btn-ghost" id="wSkip">${t("skip")}</button>
       <button class="btn btn-primary" id="wCreate">${t("create_session")}</button>`),
      { onMount(ov){
        $("#wBack", ov).addEventListener("click", render1);
        const create = skip => {
          if(!skip){
            draft.from = $("#wFrom", ov).value;
            draft.to = $("#wTo", ov).value;
          }else{ draft.from = ""; draft.to = ""; }
          const s = { id: uid(), asset: draft.asset, from: draft.from, to: draft.to,
                      createdAt: new Date().toISOString(), trades: [] };
          DATA.sessions.push(s);
          saveData(); closeModal();
          state.view = "session"; state.sessionId = s.id;
          render();
          toast(t("session_created"));
        };
        $("#wSkip", ov).addEventListener("click", () => create(true));
        $("#wCreate", ov).addEventListener("click", () => create(false));
      }});

    render1();
  }

  /* ---------- журнал сессии ---------- */
  function renderSession(){
    const s = sessionById(state.sessionId);
    if(!s){ state.view = "list"; renderList(); return; }
    const root = $("#btRoot");
    const st = computeStats(sessionItems(s));
    const chips = st.n ? `
      <span class="chip ${st.total > 0 ? "chip-gain" : st.total < 0 ? "chip-loss" : "chip-flat"}">${fmtPct(st.total)}</span>
      <span class="chip">WR ${Math.round(st.winrate)}%</span>
      <span class="chip">PF ${fmtPF(st.pf)}</span>` : "";

    root.innerHTML = `
      <div class="sess-head">
        <button class="back" id="btBack">← ${t("sessions")}</button>
        <h2>${esc(s.asset)}</h2>
        <span class="sess-period">${esc(periodLabel(s))}</span>
        <div class="actions">
          <button class="btn btn-ghost" id="btLists">${t("lists_models")}</button>
          <button class="btn btn-ghost" id="btCols">${t("columns")}</button>
          <button class="btn btn-accent" id="btSummary">${t("summary")}</button>
          <button class="btn btn-primary" id="btAdd">${t("add_trade")}</button>
        </div>
      </div>
      <div class="week-summary">${st.n ? `<span>${t("trades_c")}: <b>${st.n}</b></span>` : `<span>${t("add_bt")}</span>`} ${chips}</div>
      <div class="card table-card"><div class="table-wrap" id="btTable"></div></div>`;

    $("#btBack").addEventListener("click", () => { state.view = "list"; render(); });
    $("#btLists").addEventListener("click", () => openListsEditor("backtest", render));
    $("#btCols").addEventListener("click", () => openColumnsEditor("backtest", render));
    $("#btAdd").addEventListener("click", () => openTradeForm(s, null));
    $("#btSummary").addEventListener("click", () => openSummary(s));

    const cols = getColumns("backtest");
    const rows = [...s.trades].sort((a, b) => {
      const ta = a.values.entryTime || a.createdAt || "";
      const tb = b.values.entryTime || b.createdAt || "";
      return ta < tb ? -1 : 1;
    });
    const tbl = $("#btTable");
    tbl.innerHTML = tradesTableHtml("backtest", rows, cols, { dateCol:false });
    bindTableActions(tbl, "backtest", {
      onEdit: id => openTradeForm(s, id),
      onDelete: id => {
        s.trades = s.trades.filter(x => x.id !== id);
        saveData(); render();
        toast(t("trade_deleted"));
      },
      onGallery: id => {
        const x = s.trades.find(y => y.id === id);
        if(x) openTradeGallery(x.photos);
      }
    });
  }

  /* ---------- форма сделки ---------- */
  function openTradeForm(s, tradeId){
    const existing = tradeId ? s.trades.find(x => x.id === tradeId) : null;
    const cols = getColumns("backtest");
    const photos = existing && existing.photos ? [...existing.photos] : [];

    const body = `<div class="f-grid">
      ${cols.map(c => fieldHtml("backtest", c, existing ? existing.values[c.id] : (c.id === "entryTime" && s.from ? s.from : ""))).join("")}
      ${rrBoxHtml(cols)}
      ${photoSectionHtml()}
    </div>`;

    openModal(modalShell(existing ? t("edit_trade") : `${t("trade_of")} · ${esc(s.asset)}`, body,
      `${existing ? `<button class="btn btn-ghost btn-danger" id="btDelete" style="margin-right:auto">${t("del")}</button>` : ""}
       <button class="btn btn-ghost" id="btCancel">${t("cancel")}</button>
       <button class="btn btn-primary" id="btSave">${existing ? t("save") : t("add")}</button>`),
      { wide:true, onMount(ov){
        const delBtn = $("#btDelete", ov);
        if(delBtn) delBtn.addEventListener("click", () => {
          if(!confirm(t("del_trade_q"))) return;
          s.trades = s.trades.filter(x => x.id !== existing.id);
          saveData(); closeModal(); render();
          toast(t("trade_deleted"));
        });
        bindTradeFormUI(ov);
        renderPhotoGrid($("#tPhotoGrid", ov), photos);
        $("#btCancel", ov).addEventListener("click", closeModal);
        const save = () => {
          const values = collectForm(ov);
          if(existing){
            existing.values = { ...existing.values, ...values };
            existing.photos = photos;
          }else{
            s.trades.push({ id: uid(), createdAt: new Date().toISOString(), values, photos });
          }
          saveData(); closeModal(); render();
          toast(existing ? t("trade_updated") : t("trade_added"));
        };
        $("#btSave", ov).addEventListener("click", save);
        ov.addEventListener("keydown", e => { if(e.key === "Enter" && e.ctrlKey) save(); });
      }});
  }

  /* ---------- сводка ---------- */
  function openSummary(s){
    const st = computeStats(sessionItems(s));
    if(!st.n){
      openModal(modalShell(`${t("summary")} · ${esc(s.asset)}`,
        `<p class="hint">${t("no_result_trades")}</p>`));
      return;
    }
    const cell = (label, value, cls="") =>
      `<div class="sum-cell"><div class="m-label">${label}</div><div class="m-value${cls}">${value}</div></div>`;
    const cls = v => v === null ? "" : v > 0 ? " pos" : v < 0 ? " neg" : "";
    const loc = LANG === "ru" ? "ru-RU" : "en-US";

    const body = `
      <div class="sum-grid">
        ${cell(t("result"), fmtPct(st.total), cls(st.total))}
        ${cell(t("winrate"), Math.round(st.winrate * 10) / 10 + "%")}
        ${cell(t("profit_factor"), fmtPF(st.pf))}
        ${cell(t("max_dd"), "−" + (Math.round(st.maxDD * 100) / 100).toLocaleString(loc) + "%", " neg")}
        ${cell(t("sharpe"), st.sharpe === null ? "—" : (Math.round(st.sharpe * 100) / 100).toLocaleString(loc))}
        ${cell(t("trades_c"), st.n)}
        ${cell(t("avg_win"), fmtPct(st.avgWin), " pos")}
        ${cell(t("avg_loss"), fmtPct(st.avgLoss), " neg")}
      </div>
      <div class="chart-wrap" id="sumChart" style="padding:0"></div>
      ${st.byModel.length > 1 ? `<div class="model-card-block" style="margin-top:18px"><h4>${t("by_models")}</h4>
        ${st.byModel.map(r => `<div class="col-row"><span class="c-name">${esc(r.name)}</span>
          <span class="c-type mono">${r.n} ${t("trades_short")} · WR ${Math.round(r.wr)}%</span>
          <span class="chip ${r.sum > 0 ? "chip-gain" : r.sum < 0 ? "chip-loss" : "chip-flat"}">${fmtPct(r.sum)}</span></div>`).join("")}
      </div>` : ""}`;

    openModal(modalShell(`${t("summary")} · ${esc(s.asset)} · ${esc(periodLabel(s))}`, body),
      { wide:true, onMount(ov){
        renderEquityChart($("#sumChart", ov), st);
      }});
  }

  function render(){
    if(state.view === "session") renderSession();
    else renderList();
  }

  function init(){ render(); }

  return { init, render };
})();
