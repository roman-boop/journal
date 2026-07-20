/* ============================================================
   config.js — настройки облака (Supabase)
   1) Создайте проект на supabase.com (бесплатно)
   2) Выполните supabase-setup.sql в SQL Editor
   3) Вставьте сюда Project URL и anon public key
      (Settings → API в панели Supabase)
   Если оставить пустым — сайт работает локально, без аккаунтов.
   ============================================================ */
"use strict";

const CONFIG = {
  SUPABASE_URL: "https://kqduuszfolyiehzgxwri.supabase.co",       // например: "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "sb_publishable_v9-N3dR1aLX4EUzfSkHF7A_ZXPA_U3M"   // длинный ключ anon public
};
