/* ============================================================
   cloud.js — аккаунты и облачная синхронизация (Supabase)
   Если CONFIG не заполнен — сайт работает локально.
   ============================================================ */
"use strict";

const Cloud = {
  client: null,
  user: null,
  status: "local",   // local | ok | saving | err
  _timer: null,
  _pushing: false,

  enabled(){ return !!this.client; },

  init(){
    if(!window.supabase || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY){
      this.setStatus("local");
      return;
    }
    this.client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

    this.client.auth.onAuthStateChange((event, session) => {
      if(event === "PASSWORD_RECOVERY"){
        this.user = session ? session.user : null;
        openNewPasswordModal();
        renderHeaderControls();
        return;
      }
      const wasUser = !!this.user;
      this.user = session ? session.user : null;
      renderHeaderControls();
      if(this.user && !wasUser) this.onLogin();
      if(!this.user) this.setStatus("local");
    });
  },

  setStatus(s){
    this.status = s;
    const dot = $("#syncDot");
    if(dot){
      dot.className = "sync-dot s-" + s;
      dot.title = s === "ok" ? t("sync_ok") : s === "saving" ? t("sync_saving")
        : s === "err" ? t("sync_err") : t("sync_local");
    }
  },

  /* после входа: подтянуть облачные данные */
  async onLogin(){
    try{
      const { data: row, error } = await this.client
        .from("user_data").select("data").eq("user_id", this.user.id).maybeSingle();
      if(error) throw error;

      if(row && replaceStore(row.data)){
        try{ localStorage.setItem(LS_KEY, JSON.stringify(STORE)); }catch(_){}
        rerenderAll();
        this.setStatus("ok");
        toast(t("cloud_loaded"));
      }else{
        /* в облаке пусто: перенести локальные данные, если они есть */
        const hasLocal = STORE.journals.some(j => j.trades.length || j.sessions.length);
        if(!hasLocal || confirm(t("migrate_q"))){
          await this.pushNow();
        }else{
          replaceStore(defaultStore());
          saveData();
          rerenderAll();
          await this.pushNow();
        }
      }
      toast(t("logged_in"));
    }catch(e){
      console.error(e);
      this.setStatus("err");
    }
  },

  schedulePush(){
    if(!this.enabled() || !this.user) return;
    this.setStatus("saving");
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.pushNow(), 1200);
  },

  async pushNow(){
    if(!this.enabled() || !this.user || this._pushing) return;
    this._pushing = true;
    this.setStatus("saving");
    try{
      const { error } = await this.client.from("user_data").upsert({
        user_id: this.user.id,
        data: STORE,
        updated_at: new Date().toISOString()
      });
      if(error) throw error;
      this.setStatus("ok");
    }catch(e){
      console.error(e);
      this.setStatus("err");
    }finally{
      this._pushing = false;
    }
  },

  async signUp(email, password){
    const { data, error } = await this.client.auth.signUp({ email, password });
    if(error) throw error;
    return data;
  },
  async signIn(email, password){
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if(error) throw error;
    return data;
  },
  async signOut(){
    await this.client.auth.signOut();
    toast(t("logged_out"));
  },
  async resetPassword(email){
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if(error) throw error;
  },
  async updatePassword(pass){
    const { error } = await this.client.auth.updateUser({ password: pass });
    if(error) throw error;
  }
};

/* ============================================================
   UI авторизации
   ============================================================ */
function openAuthModal(mode="signin"){
  if(!Cloud.enabled()){
    openModal(modalShell(t("cloud_off_title"), `<p style="font-size:14px;line-height:1.6">${t("cloud_off_text")}</p>`));
    return;
  }

  const render = () => {
    const isIn = mode === "signin";
    const body = `
      <div class="segmented auth-seg">
        <button class="seg${isIn ? " is-active" : ""}" data-mode="signin">${t("sign_in")}</button>
        <button class="seg${!isIn ? " is-active" : ""}" data-mode="signup">${t("sign_up")}</button>
      </div>
      <div class="f-field f-wide" style="margin-top:16px">
        <label>${t("email")}</label>
        <input type="email" id="aEmail" autocomplete="email" placeholder="you@example.com">
      </div>
      <div class="f-field f-wide" style="margin-top:13px">
        <label>${t("password")}</label>
        <input type="password" id="aPass" autocomplete="${isIn ? "current-password" : "new-password"}" placeholder="••••••••">
      </div>
      ${!isIn ? `<div class="f-field f-wide" style="margin-top:13px">
        <label>${t("password2")}</label>
        <input type="password" id="aPass2" autocomplete="new-password" placeholder="••••••••">
      </div>
      <p class="hint" style="margin-top:12px">${t("auth_email_note")}</p>` : ""}
      <div class="auth-err" id="aErr"></div>`;

    const foot = isIn
      ? `<button class="btn btn-ghost" id="aForgot">${t("forgot")}</button>
         <button class="btn btn-primary" id="aGo">${t("login")}</button>`
      : `<button class="btn btn-primary" id="aGo">${t("create_account")}</button>`;

    openModal(modalShell(t("account"), body, foot), { onMount(ov){
      $$(".auth-seg .seg", ov).forEach(b => b.addEventListener("click", () => { mode = b.dataset.mode; render(); }));
      const err = msg => { $("#aErr", ov).textContent = msg; };
      const go = async () => {
        const email = $("#aEmail", ov).value.trim();
        const pass = $("#aPass", ov).value;
        err("");
        if(!email || !pass){ err(t("err_generic")); return; }
        if(!isIn){
          if(pass.length < 8){ err(t("pass_short")); return; }
          if(pass !== $("#aPass2", ov).value){ err(t("pass_mismatch")); return; }
        }
        $("#aGo", ov).disabled = true;
        try{
          if(isIn){
            await Cloud.signIn(email, pass);
            closeModal();
          }else{
            const res = await Cloud.signUp(email, pass);
            if(res.session){ closeModal(); }
            else { closeModal(); toast(t("check_email")); }
          }
        }catch(e){
          err(e.message || t("err_generic"));
          $("#aGo", ov).disabled = false;
        }
      };
      $("#aGo", ov).addEventListener("click", go);
      ov.addEventListener("keydown", e => { if(e.key === "Enter") go(); });
      const forgot = $("#aForgot", ov);
      if(forgot) forgot.addEventListener("click", () => openResetModal($("#aEmail", ov).value.trim()));
    }});
  };
  render();
}

function openResetModal(prefill=""){
  openModal(modalShell(t("reset_title"),
    `<p class="hint" style="margin-bottom:14px">${t("reset_hint")}</p>
     <div class="f-field f-wide"><label>${t("email")}</label>
       <input type="email" id="rEmail" value="${esc(prefill)}" placeholder="you@example.com"></div>
     <div class="auth-err" id="rErr"></div>`,
    `<button class="btn btn-primary" id="rGo">${t("send_reset")}</button>`),
    { onMount(ov){
      $("#rGo", ov).addEventListener("click", async () => {
        const email = $("#rEmail", ov).value.trim();
        if(!email) return;
        $("#rGo", ov).disabled = true;
        try{
          await Cloud.resetPassword(email);
          closeModal();
          toast(t("reset_sent"));
        }catch(e){
          $("#rErr", ov).textContent = e.message || t("err_generic");
          $("#rGo", ov).disabled = false;
        }
      });
    }});
}

function openNewPasswordModal(){
  openModal(modalShell(t("reset_title"),
    `<div class="f-field f-wide"><label>${t("new_password")}</label>
       <input type="password" id="nPass" autocomplete="new-password" placeholder="••••••••"></div>
     <div class="f-field f-wide" style="margin-top:13px"><label>${t("password2")}</label>
       <input type="password" id="nPass2" autocomplete="new-password" placeholder="••••••••"></div>
     <div class="auth-err" id="nErr"></div>`,
    `<button class="btn btn-primary" id="nGo">${t("set_password")}</button>`),
    { onMount(ov){
      $("#nGo", ov).addEventListener("click", async () => {
        const p1 = $("#nPass", ov).value, p2 = $("#nPass2", ov).value;
        const err = msg => { $("#nErr", ov).textContent = msg; };
        if(p1.length < 8){ err(t("pass_short")); return; }
        if(p1 !== p2){ err(t("pass_mismatch")); return; }
        $("#nGo", ov).disabled = true;
        try{
          await Cloud.updatePassword(p1);
          closeModal();
          toast(t("password_updated"));
        }catch(e){
          err(e.message || t("err_generic"));
          $("#nGo", ov).disabled = false;
        }
      });
    }});
}
