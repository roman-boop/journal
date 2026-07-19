/* ============================================================
   tour.js — гайд по сайту при первом заходе
   Подсветка элемента + карточка со стрелкой + точки прогресса
   ============================================================ */
"use strict";

const Tour = (() => {
  const steps = [
    { sel: ".tabs",      tk:"tour1_t", bk:"tour1_b" },
    { sel: "#jCrumbs",   tk:"tour2_t", bk:"tour2_b" },
    { sel: "#jBtnAdd",   tk:"tour3_t", bk:"tour3_b" },
    { sel: "#jBtnLists", tk:"tour4_t", bk:"tour4_b" },
    { sel: "#dataMenu",  tk:"tour5_t", bk:"tour5_b" },
    { sel: "#authArea",  tk:"tour6_t", bk:"tour6_b" }
  ];
  let i = 0, ov = null;

  function start(){
    if(ov) return;
    localStorage.setItem("mdt.tour.done", "1");
    if(typeof currentPage !== "undefined" && currentPage !== "journal") showPage("journal");
    closeModal();
    i = 0;
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
  }

  function next(){
    if(i >= steps.length - 1){ end(); return; }
    i++; show();
  }

  function show(scroll = true){
    const st = steps[i];
    const el = document.querySelector(st.sel);
    if(!el || !el.offsetParent){ next(); return; }
    if(scroll) el.scrollIntoView({ block:"center" });

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

  return { start };
})();
