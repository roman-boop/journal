/* ============================================================
   stats.js — метрики, кривая доходности, страница Statistics
   ============================================================ */
"use strict";

function computeStats(items){
  const seq = items
    .filter(i => typeof i.r === "number" && isFinite(i.r))
    .sort((a, b) => a.t - b.t);
  const n = seq.length;

  let cum = 0, peak = 0, peakIdx = 0, maxDD = 0, ddPeak = 0, ddTrough = 0;
  let wins = 0, losses = 0, sumW = 0, sumL = 0, best = null, worst = null;
  const curve = [{ i:0, cum:0, trade:null }];

  seq.forEach((it, idx) => {
    cum += it.r;
    curve.push({ i: idx + 1, cum, trade: it });
    if(cum > peak){ peak = cum; peakIdx = idx + 1; }
    const dd = peak - cum;
    if(dd > maxDD){ maxDD = dd; ddPeak = peakIdx; ddTrough = idx + 1; }
    if(it.r > 0){ wins++; sumW += it.r; } else if(it.r < 0){ losses++; sumL += Math.abs(it.r); }
    if(best === null || it.r > best) best = it.r;
    if(worst === null || it.r < worst) worst = it.r;
  });

  const total = cum;
  const winrate = n ? wins / n * 100 : null;
  const pf = sumL > 0 ? sumW / sumL : (sumW > 0 ? Infinity : null);
  const mean = n ? seq.reduce((s, i) => s + i.r, 0) / n : 0;
  const variance = n > 1 ? seq.reduce((s, i) => s + (i.r - mean) ** 2, 0) / (n - 1) : 0;
  const sharpe = n > 1 && variance > 0 ? mean / Math.sqrt(variance) : null;

  const agg = key => {
    const map = {};
    seq.forEach(it => {
      const k = it[key] || "—";
      if(!map[k]) map[k] = { name:k, n:0, wins:0, sum:0 };
      map[k].n++; if(it.r > 0) map[k].wins++;
      map[k].sum += it.r;
    });
    return Object.values(map)
      .map(x => ({ ...x, wr: x.n ? x.wins / x.n * 100 : 0 }))
      .sort((a, b) => b.sum - a.sum);
  };

  return {
    n, total, winrate, pf, maxDD: n ? maxDD : null, sharpe,
    avgWin: wins ? sumW / wins : null,
    avgLoss: losses ? -sumL / losses : null,
    best, worst,
    curve, ddPeak, ddTrough,
    byModel: agg("model"),
    byTf: agg("tf")
  };
}

function fmtPF(pf){
  if(pf === null) return "—";
  if(pf === Infinity) return "∞";
  return (Math.round(pf * 100) / 100).toLocaleString(LANG === "ru" ? "ru-RU" : "en-US");
}

/* ---------- SVG-график ---------- */
function renderEquityChart(container, stats){
  if(!stats || stats.n < 2){
    container.innerHTML = `<div class="empty"><div class="e-title">${t("not_enough")}</div>
      <div class="e-sub">${t("need_two")}</div></div>`;
    return;
  }
  const W = 880, H = 320, padL = 52, padR = 18, padT = 18, padB = 30;
  const curve = stats.curve;
  const xs = i => padL + (W - padL - padR) * (i / (curve.length - 1));

  let min = Math.min(0, ...curve.map(p => p.cum));
  let max = Math.max(0, ...curve.map(p => p.cum));
  if(min === max){ min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.08; max += span * 0.08;
  const ys = v => padT + (H - padT - padB) * (1 - (v - min) / (max - min));

  const rawStep = (max - min) / 5;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => s >= rawStep) || rawStep;
  const gridLines = [];
  for(let v = Math.ceil(min / step) * step; v <= max; v += step){
    gridLines.push(`<line class="eq-grid" x1="${padL}" y1="${ys(v)}" x2="${W - padR}" y2="${ys(v)}"/>
      <text class="eq-label" x="${padL - 8}" y="${ys(v) + 3.5}" text-anchor="end">${fmtPct(v, 1)}</text>`);
  }

  const pts = curve.map(p => `${xs(p.i).toFixed(1)},${ys(p.cum).toFixed(1)}`).join(" ");
  const areaPts = `${padL},${ys(0)} ${pts} ${xs(curve.length - 1).toFixed(1)},${ys(0)}`;
  const lastPos = curve[curve.length - 1].cum >= 0;
  const gid = "eqg" + uid();

  const ddMarks = stats.maxDD > 0 ? `
    <circle class="eq-dot eq-peak" cx="${xs(stats.ddPeak)}" cy="${ys(curve[stats.ddPeak].cum)}" r="4"/>
    <circle class="eq-dot eq-dd" cx="${xs(stats.ddTrough)}" cy="${ys(curve[stats.ddTrough].cum)}" r="4"/>` : "";

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("equity"))}">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${lastPos ? "rgba(10,164,119,.22)" : "rgba(229,72,77,.18)"}"/>
          <stop offset="100%" stop-color="rgba(127,127,127,0)"/>
        </linearGradient>
      </defs>
      ${gridLines.join("")}
      <line class="eq-zero" x1="${padL}" y1="${ys(0)}" x2="${W - padR}" y2="${ys(0)}"/>
      <polygon class="eq-area" points="${areaPts}" fill="url(#${gid})"/>
      <polyline class="eq-line draw-anim" points="${pts}"/>
      ${ddMarks}
      <text class="eq-label" x="${padL}" y="${H - 8}">1</text>
      <text class="eq-label" x="${W - padR}" y="${H - 8}" text-anchor="end">${curve.length - 1} ${t("trades_n")}</text>
    </svg>
    <div class="chart-tip" id="eqTip"></div>`;

  const svg = container.querySelector("svg");
  const tip = container.querySelector("#eqTip");
  svg.addEventListener("mousemove", e => {
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * W;
    let bestP = null, bestD = 1e9;
    curve.forEach(p => {
      const d = Math.abs(xs(p.i) - mx);
      if(d < bestD){ bestD = d; bestP = p; }
    });
    if(!bestP || bestP.i === 0){ tip.classList.remove("show"); return; }
    const tr = bestP.trade;
    const when = tr && tr.t && !isNaN(tr.t) ? fmtDT(tr.t.toISOString()) : "";
    tip.innerHTML = `#${bestP.i} · ${esc(when)}<br>${tr ? fmtPct(tr.r) : ""} · Σ ${fmtPct(bestP.cum)}`;
    tip.style.left = (xs(bestP.i) / W * rect.width) + "px";
    tip.style.top = (ys(bestP.cum) / H * rect.height) + "px";
    tip.classList.add("show");
  });
  svg.addEventListener("mouseleave", () => tip.classList.remove("show"));
}

/* ---------- карточки метрик ---------- */
function metricsHtml(s){
  const loc = LANG === "ru" ? "ru-RU" : "en-US";
  const cls = v => v === null ? "" : v > 0 ? " pos" : v < 0 ? " neg" : "";
  const cards = [
    { label:t("result"), value: s.n ? fmtPct(s.total) : "—", cls: cls(s.total), sub: s.n ? `${s.n} ${t("trades_n")}` : "" },
    { label:t("winrate"), value: s.winrate === null ? "—" : Math.round(s.winrate * 10) / 10 + "%", sub: s.n ? `${t("avg_pm")} ${fmtPct(s.avgWin)} / ${fmtPct(s.avgLoss)}` : "" },
    { label:t("profit_factor"), value: fmtPF(s.pf) },
    { label:t("max_dd"), value: s.maxDD === null ? "—" : "−" + (Math.round(s.maxDD * 100) / 100).toLocaleString(loc) + "%", cls: s.maxDD ? " neg" : "" },
    { label:t("sharpe"), value: s.sharpe === null ? "—" : (Math.round(s.sharpe * 100) / 100).toLocaleString(loc), sub:t("per_trade") },
    { label:t("best_worst"), value: s.n ? `${fmtPct(s.best)} · ${fmtPct(s.worst)}` : "—" }
  ];
  return cards.map((c, i) => `
    <div class="metric" style="animation-delay:${i * 40}ms">
      <div class="m-label">${c.label}</div>
      <div class="m-value${c.cls || ""}">${c.value}</div>
      ${c.sub ? `<div class="m-sub">${c.sub}</div>` : ""}
    </div>`).join("");
}

function breakdownTableHtml(title, rows){
  if(!rows.length) return `<div class="card"><div class="card-top"><h2>${title}</h2></div>
    <div class="empty"><div class="e-sub" style="margin:0 auto">${t("no_data_period")}</div></div></div>`;
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.sum)), 0.01);
  const body = rows.map(r => `
    <tr>
      <td>${esc(r.name)}</td>
      <td class="num mono">${r.n}</td>
      <td class="num mono">${Math.round(r.wr)}%</td>
      <td class="num"><span class="chip ${r.sum > 0 ? "chip-gain" : r.sum < 0 ? "chip-loss" : "chip-flat"}">${fmtPct(r.sum)}</span></td>
      <td><div class="bd-bar"><i style="width:${Math.round(Math.abs(r.sum) / maxAbs * 100)}%;background:${r.sum >= 0 ? "var(--gain)" : "var(--loss)"}"></i></div></td>
    </tr>`).join("");
  return `<div class="card">
    <div class="card-top"><h2>${title}</h2></div>
    <div class="table-wrap"><table class="bd-table">
      <thead><tr><th>${t("name")}</th><th style="text-align:right">${t("trades_c")}</th><th style="text-align:right">WR</th><th style="text-align:right">${t("sum_result")}</th><th></th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
  </div>`;
}

/* ============================================================
   Страница Statistics
   ============================================================ */
const StatsState = { scope:"realtime", from:"", to:"", preset:"all", sessionId:"all" };

function realtimeItems(){
  return DATA.trades.map(x => ({
    t: new Date((x.date || todayISO()) + "T" + ((x.values.time || "12:00")) + ":00"),
    r: parseNum(x.values.result),
    model: x.values.model || "—",
    tf: x.values.timeframe || "—"
  }));
}

function backtestItems(sessionId){
  const sessions = sessionId === "all" ? DATA.sessions : DATA.sessions.filter(s => s.id === sessionId);
  const items = [];
  sessions.forEach(s => s.trades.forEach(x => items.push({
    t: x.values.entryTime ? new Date(x.values.entryTime) : new Date(x.createdAt || Date.now()),
    r: parseNum(x.values.result),
    model: x.values.model || "—",
    tf: x.values.timeframe || "—"
  })));
  return items;
}

function applyPreset(p){
  const now = new Date();
  StatsState.preset = p;
  if(p === "all"){ StatsState.from = ""; StatsState.to = ""; }
  else if(p === "month"){ StatsState.from = localISO(new Date(now.getFullYear(), now.getMonth(), 1)); StatsState.to = localISO(now); }
  else if(p === "30"){ const d = new Date(now); d.setDate(d.getDate() - 30); StatsState.from = localISO(d); StatsState.to = localISO(now); }
  else if(p === "90"){ const d = new Date(now); d.setDate(d.getDate() - 90); StatsState.from = localISO(d); StatsState.to = localISO(now); }
  else if(p === "year"){ StatsState.from = localISO(new Date(now.getFullYear(), 0, 1)); StatsState.to = localISO(now); }
}

function renderStats(){
  const controls = $("#stControls");
  const isRT = StatsState.scope === "realtime";

  if(isRT){
    const presets = [["all",t("all_time")],["month",t("month")],["30",t("d30")],["90",t("d90")],["year",t("year")]];
    controls.innerHTML = `
      <label>${t("from")}</label><input type="date" id="stFrom" value="${StatsState.from}">
      <label>${t("to")}</label><input type="date" id="stTo" value="${StatsState.to}">
      <div class="presets">${presets.map(([k, l]) =>
        `<button class="preset${StatsState.preset === k ? " is-active" : ""}" data-preset="${k}">${l}</button>`).join("")}</div>`;
    $("#stFrom").addEventListener("change", e => { StatsState.from = e.target.value; StatsState.preset = ""; renderStats(); });
    $("#stTo").addEventListener("change", e => { StatsState.to = e.target.value; StatsState.preset = ""; renderStats(); });
    $$("[data-preset]", controls).forEach(b => b.addEventListener("click", () => { applyPreset(b.dataset.preset); renderStats(); }));
  }else{
    const opts = DATA.sessions.map(s =>
      `<option value="${s.id}" ${StatsState.sessionId === s.id ? "selected" : ""}>${esc(s.asset)} · ${s.trades.length} ${t("trades_short")}</option>`).join("");
    controls.innerHTML = `
      <label>${t("session")}</label>
      <select id="stSession"><option value="all" ${StatsState.sessionId === "all" ? "selected" : ""}>${t("all_sessions")}</option>${opts}</select>
      <span class="hint" style="margin-left:auto">${DATA.sessions.length} ${t("sessions_hint")}</span>`;
    $("#stSession").addEventListener("change", e => { StatsState.sessionId = e.target.value; renderStats(); });
  }

  let items = isRT ? realtimeItems() : backtestItems(StatsState.sessionId);
  if(isRT){
    if(StatsState.from) items = items.filter(i => i.t >= new Date(StatsState.from + "T00:00:00"));
    if(StatsState.to)   items = items.filter(i => i.t <= new Date(StatsState.to + "T23:59:59"));
  }
  const s = computeStats(items);

  $("#stMetrics").innerHTML = metricsHtml(s);
  $("#stChartHint").textContent = s.n ? `${t("cum_hint")} · ${s.n} ${t("trades_n")}` : "";
  renderEquityChart($("#stChart"), s);
  $("#stBreakdowns").innerHTML =
    breakdownTableHtml(t("by_models_full"), s.byModel) +
    breakdownTableHtml(t("by_tfs"), s.byTf);
}

function initStats(){
  $$("#stScope .seg").forEach(b => b.addEventListener("click", () => {
    $$("#stScope .seg").forEach(x => x.classList.toggle("is-active", x === b));
    StatsState.scope = b.dataset.scope;
    renderStats();
  }));
}
