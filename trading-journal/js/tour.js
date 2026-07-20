/* ============================================================
   tour.js — гайды по сайту
   Основной тур (первый заход) + гайд раздела Statistics
   ============================================================ */
"use strict";

const Tour = (() => {
  const mainSteps = () => [
    { sel:".tabs",      tk:"tour1_t",    bk:"tour1_b" },
    { sel:"#jCrumbs",   tk:"tour2_t",    bk:"tour2_b" },
    { sel:"#jWeeks",    tk:"tour_cal_t", bk:"tour_cal_b", pre(){ Journal.setView("day"); } },
    { sel:"#jBtnAdd",   tk:"tour3_t",    bk:"tour3_b" },
    { sel:"#jBtnLists", tk:"tour4_t",    bk:"tour4_b" },
    { sel:"#jBtnCols",  tk:"tour_cols_t",bk:"tour_cols_b" },
    { sel:"#dataMenu",  tk:"tour5_t",    bk:"tour5_b" },
    { sel:"#authArea",  tk:"tour6_t",    bk:"tour6_b" }
  ];

  const statsSteps = () => [
    { sel:"#stScope",      tk:"tst1_t", bk:"tst1_b" },
    { sel:"#stControls",   tk:"tst2_t", bk:"tst2_b" },
    { sel:"#stMetrics",    tk:"tst3_t", bk:"tst3_b" },
    { sel:".chart-card",   tk:"tst4_t", bk:"tst4_b" }
  ];

  let steps = [], i = 0, ov = null, onEnd = null;

  const active = () => !!ov;

  /* -------- запуск основного тура -------- */
  function start(){
    if(active()) return;
    localStorage.setItem("mdt.tour.done", "1");
    if(typeof currentPage !== "undefined" && currentPage !== "journal") showPage("journal");
    closeModal();
    const prevView = Journal.getView();
    begin(mainSteps(), () => {
      if(Journal.getView() !== prevView) Journal.setView(prevView);
    });
  }

  /* -------- запуск гайда статистики -------- */
  function startStats(){
    if(active()) return;
    localStorage.setItem("mdt.tour.stats.done", "1");
    if(typeof currentPage !== "undefined" && currentPage !== "stats") showPage("stats");
    closeModal();
    begin(statsSteps(), null);
  }

  /* -------- общий механизм -------- */
  function begin(list, cleanup){
    steps = list; onEnd = cleanup; i = 0;
    ov = document.createElement("div");
    ov.className = "tour-ov";
    ov.innerHTML = `<div class="tour-hl"></div><div class="tour-tip"></div>`;
    ov.addEventListener("click", e => { if(!e.target.closest(".tour-tip")) next(); });
    document.body.appendChild(ov);
    document.addEventListener("keydown", kb);
    window.addEventListener("resize", onResize);
    show();
  }

  const kb = e => {
    if(e.key === "Escape") end();
    if(e.key === "ArrowRight" || e.key === "Enter") next();
    if(e.key === "ArrowLeft" && i > 0){ i--; show(); }
  };
  const onResize = () => { if(ov) show(false); };

  function end(){
    if(!ov) return;
    ov.classList.add("out");
    const node = ov;
    ov = null;
    setTimeout(() => node.remove(), 220);
    document.removeEventListener("keydown", kb);
    window.removeEventListener("resize", onResize);
    if(onEnd){ onEnd(); onEnd = null; }
  }

  function next(){
    if(i >= steps.length - 1){ end(); return; }
    i++; show();
  }

  function show(scroll = true){
    const st = steps[i];
    if(st.pre) st.pre();
    const el = document.querySelector(st.sel);
    if(!el || !el.offsetParent){ next(); return; }

    /* прокручиваем мгновенно (плавная прокрутка страницы ломает замер позиции)
       и только если элемент не виден целиком */
    if(scroll){
      const r0 = el.getBoundingClientRect();
      if(r0.top < 74 || r0.bottom > window.innerHeight - 96){
        const root = document.documentElement;
        const prev = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        el.scrollIntoView({ block:"center" });
        root.style.scrollBehavior = prev;
      }
    }
    requestAnimationFrame(() => place(el, st));
  }

  function place(el, st){
    if(!ov) return;
    const r = el.getBoundingClientRect();
    const pad = 7;
    const hl = ov.querySelector(".tour-hl");
    hl.style.top = (r.top - pad) + "px";
    hl.style.left = (r.left - pad) + "px";
    hl.style.width = (r.width + pad * 2) + "px";
    hl.style.height = (r.height + pad * 2) + "px";

    const tip = ov.querySelector(".tour-tip");
    const dots = steps.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
    tip.innerHTML = `
      <div class="tour-title">${t(st.tk)}</div>
      <div class="tour-body">${t(st.bk)}</div>
      <div class="tour-foot">
        <button class="tour-skip">${t("tour_skip")}</button>
        <div class="tour-dots">${dots}</div>
        ${i > 0 ? `<button class="btn btn-ghost btn-sm tour-prev">${t("tour_back")}</button>` : ""}
        <button class="btn btn-primary btn-sm tour-next">${i === steps.length - 1 ? t("tour_done") : t("tour_next")}</button>
      </div>`;

    /* позиционирование карточки и стрелки */
    tip.style.visibility = "hidden";
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    const below = r.bottom + 16 + th < vh - 10;
    const top = below ? r.bottom + 16 : Math.max(10, r.top - 16 - th);
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(12, Math.min(left, vw - tw - 12));
    tip.style.top = top + "px";
    tip.style.left = left + "px";
    tip.classList.toggle("below", below);
    const ax = Math.max(20, Math.min(r.left + r.width / 2 - left, tw - 20));
    tip.style.setProperty("--ax", ax + "px");
    tip.style.visibility = "";

    tip.querySelector(".tour-skip").addEventListener("click", end);
    tip.querySelector(".tour-next").addEventListener("click", next);
    const prev = tip.querySelector(".tour-prev");
    if(prev) prev.addEventListener("click", () => { i--; show(); });
  }

  return { start, startStats, active };
})();
