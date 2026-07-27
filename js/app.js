/* =============================================================
 * APP (patient) — login gate, routing, rendering, PWA wiring.
 * Data is the logged-in patient's live record from Supabase.
 * ============================================================= */
import { CLINIC, applyTheme, trialExpired } from "../config/clinic.config.js";
import { t, L, getLang, setLang, onLangChange } from "./i18n.js";
import { getData, update, isDoctor, isLoggedIn, loginWithBundle, logout, getCreds, setMoodToday } from "./store.js";
import { patientLogin, clinicBranding, submitMood } from "./api.js";
import { SCREENS } from "./screens.js";
import { toast } from "./components.js";

let currentScreen = "dashboard";

/* ---------- Boot ---------- */
function boot() {
  applyTheme();
  document.documentElement.lang = getLang();
  if (trialExpired()) { showTrialEnded(); return; }   // demo trial gate
  wireGlobal();
  registerSW();
  applyBranding();
  onLangChange(() => { paintLogin(); if (isLoggedIn()) { paintChrome(); render(); } });
  if (isLoggedIn()) showApp(); else { showLogin(); prefillOpFromUrl(); }
  startReminders();
}

/* Demo trial has ended — replace the whole app with a friendly notice. */
function showTrialEnded() {
  const tr = CLINIC.trial || {};
  const brand = (CLINIC.brand && CLINIC.brand.en) || (CLINIC.name && CLINIC.name.en) || "This app";
  const mail = tr.contactEmail ? `<a href="mailto:${tr.contactEmail}">${tr.contactEmail}</a>` : "";
  const phone = tr.contactPhone ? ` · <a href="tel:${tr.contactPhone}">${tr.contactPhone}</a>` : "";
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f8ef;padding:24px">
      <div style="max-width:420px;background:#fff;border:1px solid #dce8d5;border-radius:16px;
                  padding:32px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.06)">
        <div style="font-size:44px;margin-bottom:8px">⏳</div>
        <h1 style="margin:0 0 8px;font-size:20px;color:#1d2b1f">Your 3-day trial has ended</h1>
        <p style="margin:0 0 16px;color:#697566;line-height:1.5">
          Thanks for trying the ${brand} patient app. To continue or set up a full
          account for your clinic, please get in touch.</p>
        <p style="margin:0;color:#245b35;font-weight:600">${mail}${phone}</p>
      </div>
    </div>`;
}

/* QR / share links open the app with ?op=... — pre-fill the OP field.
 * The PIN is NEVER put in the URL; the patient still types it. */
function prefillOpFromUrl() {
  try {
    const op = new URLSearchParams(location.search).get("op");
    if (op) { const f = document.getElementById("in-op"); if (f) f.value = op.trim(); }
  } catch (_) {}
}

/* ---------- Branding (loaded from DB, white-label) ---------- */
async function applyBranding() {
  const b = await clinicBranding(CLINIC.id);
  if (!b) return;
  if (b.name) CLINIC.name = { en: b.name, ml: CLINIC.name.ml || b.name };
  if (b.review_url) CLINIC.googleReviewUrl = b.review_url;
  if (b.theme_color) document.documentElement.style.setProperty("--green", b.theme_color);
  if (b.logo_url) document.querySelectorAll(".login-logo, .brand-logo").forEach((img) => { img.src = b.logo_url; });
}

/* ---------- Login ---------- */
function showLogin() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.querySelector(".device").classList.add("hidden");
  paintLogin();
}
function showApp() {
  document.getElementById("login-screen").classList.add("hidden");
  document.querySelector(".device").classList.remove("hidden");
  paintChrome();
  render();
}
function paintLogin() {
  document.getElementById("login-title").textContent = t("patientLogin");
  document.getElementById("lbl-op").textContent = t("opNumber");
  document.getElementById("lbl-pin").textContent = t("pin");
  document.getElementById("login-btn").textContent = t("login");
  document.getElementById("login-hint").textContent = t("loginHint");
  document.getElementById("lgn-en").classList.toggle("active", getLang() === "en");
  document.getElementById("lgn-ml").classList.toggle("active", getLang() === "ml");
}
async function doLogin() {
  const op = document.getElementById("in-op").value;
  const pin = document.getElementById("in-pin").value;
  const err = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");
  err.classList.add("hidden");
  if (!op.trim() || !pin.trim()) { err.textContent = t("loginInvalid"); err.classList.remove("hidden"); return; }
  btn.disabled = true; btn.textContent = t("loggingIn");
  try {
    const bundle = await patientLogin(op, pin);
    loginWithBundle(bundle, { op: op.trim(), pin: pin.trim() });
    document.getElementById("in-pin").value = "";
    currentScreen = "dashboard";
    showApp();
  } catch (e) {
    err.textContent = e.code === "network" ? t("loginNetwork") : t("loginInvalid");
    err.classList.remove("hidden");
  } finally {
    btn.disabled = false; btn.textContent = t("login");
  }
}

/* ---------- Header / chrome ---------- */
function paintChrome() {
  document.getElementById("doctorLine").textContent = `${t("doctorLabel")}: ${CLINIC.doctors[0].name}`;
  document.getElementById("screenTitle").textContent = t(SCREENS[currentScreen].titleKey);
  document.getElementById("btn-en").classList.toggle("active", getLang() === "en");
  document.getElementById("btn-ml").classList.toggle("active", getLang() === "ml");

  setText("nav-home", "home"); setText("nav-ads", "ads"); setText("nav-treatment", "treatment");
  setText("nav-reminders", "reminders"); setText("nav-contacts", "contacts");
  const lg = document.getElementById("logout-btn"); if (lg) lg.querySelector(".menu-label").textContent = t("logout");

  document.querySelectorAll("[data-screen]").forEach((el) => {
    el.querySelector(".menu-label").textContent = t(SCREENS[el.getAttribute("data-screen")].titleKey);
  });
  document.querySelector('[data-screen="diagnosis"] .lock')?.classList.toggle("hidden", isDoctor());
}
const setText = (id, key) => { const e = document.getElementById(id); if (e) e.textContent = t(key); };

/* ---------- Render ---------- */
function render() {
  const host = document.getElementById("view");
  const d = getData();
  if (!d) { showLogin(); return; }
  host.innerHTML = SCREENS[currentScreen].render();
  document.getElementById("screenTitle").textContent = t(SCREENS[currentScreen].titleKey);
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.nav === currentScreen));
  document.querySelectorAll("[data-screen]").forEach((m) => m.classList.toggle("active", m.dataset.screen === currentScreen));
  host.scrollTop = 0;
  if (currentScreen === "reminders") refreshNotifStatus();
}
function goto(screen) { if (!SCREENS[screen]) return; currentScreen = screen; closeMenu(); render(); }

/* ---------- Wiring ---------- */
function wireGlobal() {
  // login
  document.getElementById("login-btn").onclick = doLogin;
  document.getElementById("in-pin").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  document.getElementById("lgn-en").onclick = () => setLang("en");
  document.getElementById("lgn-ml").onclick = () => setLang("ml");
  // app language
  document.getElementById("btn-en").onclick = () => setLang("en");
  document.getElementById("btn-ml").onclick = () => setLang("ml");
  // menu
  document.getElementById("menu-btn").onclick = toggleMenu;
  document.getElementById("menu-overlay").onclick = closeMenu;
  document.getElementById("alarm-close").onclick = dismissAlarm;
  document.getElementById("alarm-done").onclick = dismissAlarm;
  document.getElementById("logout-btn").onclick = () => { logout(); closeMenu(); showLogin(); };
  document.querySelectorAll("[data-nav]").forEach((n) => n.onclick = () => goto(n.dataset.nav));
  document.querySelectorAll("[data-screen]").forEach((m) => m.onclick = () => goto(m.dataset.screen));
  const view = document.getElementById("view");
  view.addEventListener("click", onViewClick);
}

function onViewClick(e) {
  const chip = e.target.closest(".chip");
  if (chip) { chip.classList.toggle("on"); return; }
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const actions = {
    "mark-complete": markComplete,
    "goto-followup": () => goto("followup"),
    "goto-dashboard": () => goto("dashboard"),
    "refill": () => refill(btn.dataset.id),
    "google-review": googleReview,
    "enable-notif": enableNotifications,
    "share-ad": () => shareAd(btn.dataset.id),
    "mood": () => logMood(btn.dataset.mood),
  };
  if (actions[btn.dataset.action]) { e.preventDefault(); actions[btn.dataset.action](); }
}

/* ---------- Daily mood ---------- */
async function logMood(mood) {
  if (!["love", "happy", "sad"].includes(mood)) return;
  const creds = getCreds();
  if (!creds || !creds.op || !creds.pin) { toast(t("moodRelogin")); return; }
  setMoodToday(mood);   // optimistic: show it selected immediately
  render();
  try {
    const res = await submitMood(creds.op, creds.pin, mood);
    if (res && res.ok) toast(t("moodThanks"));
    else toast(t("moodError"));
  } catch (_) {
    toast(t("moodError"));
  }
}

/* ---------- Actions (patient) ---------- */
function markComplete() {
  const d = getData(); const total = d.treatment.durationDays;
  const done = Math.min(d.progress.completedDays + 1, total);
  update("progress", { completedDays: done });
  toast(`${t("day")} ${done} ${t("of")} ${total} ✓`);
  render();
}
function refill(id) {
  const d = getData(); const m = d.medicines.find((x) => x.id === id);
  toast(`${t("refillReorder")}: ${m ? m.name : ""} ✓`);
}
function googleReview() { window.open(CLINIC.googleReviewUrl, "_blank", "noopener"); }

async function shareAd(id) {
  const ad = getData().ads.find((a) => a.id === id); if (!ad) return;
  const title = L(ad.title);
  const text = `${title}\n${L(ad.body)}\n\n${L(CLINIC.name)}`;
  const url = CLINIC.siteUrl;
  try { if (navigator.share) { await navigator.share({ title, text, url }); return; } } catch (_) { return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast(t("linkCopied")); }
  catch (_) { window.open(`https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`, "_blank", "noopener"); }
}

/* ---------- Notifications ---------- */
async function enableNotifications() {
  if (!("Notification" in window)) { toast(t("notifBlocked")); return; }
  const perm = await Notification.requestPermission();
  refreshNotifStatus();
  if (perm === "granted") { new Notification(L(CLINIC.name), { body: t("notifOn"), icon: CLINIC.logo }); toast(t("notifOn")); }
  else toast(t("notifBlocked"));
}
function refreshNotifStatus() {
  const el = document.getElementById("notif-status"); if (!el) return;
  const state = ("Notification" in window) ? Notification.permission : "unsupported";
  el.textContent = state === "granted" ? "✅ " + t("notifOn") : state === "denied" ? "⚠️ " + t("notifBlocked") : "";
}

/* ---------- Menu ---------- */
function toggleMenu() { document.getElementById("menu").classList.toggle("open"); document.getElementById("menu-overlay").classList.toggle("show"); }
function closeMenu() { document.getElementById("menu").classList.remove("open"); document.getElementById("menu-overlay").classList.remove("show"); }

/* ---------- SW + install ---------- */
function registerSW() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  let deferred;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferred = e;
    const b = document.getElementById("install-btn"); b.classList.remove("hidden");
    b.onclick = async () => { b.classList.add("hidden"); deferred.prompt(); deferred = null; };
  });
}

/* ---------- Reminder alarm (in-app, fires when the app is open) ---------- */
const SHOWN_KEY = "ayusree.alarmshown";
function loadShown() {
  const today = new Date().toISOString().slice(0, 10);
  try { const o = JSON.parse(localStorage.getItem(SHOWN_KEY) || "{}"); return o.date === today ? o : { date: today, ids: [] }; }
  catch (_) { return { date: today, ids: [] }; }
}
function startReminders() { checkReminders(); setInterval(checkReminders, 30000); }
function checkReminders() {
  if (!isLoggedIn()) return;
  const d = getData(); if (!d || !d.reminders) return;
  const now = new Date();
  const cur = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const shown = loadShown();
  for (const r of d.reminders) {
    const rt = (r.time || "").slice(0, 5);
    const key = rt + "|" + (r.label || "");
    if (rt === cur && !shown.ids.includes(key)) {
      shown.ids.push(key); localStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
      showAlarm(r); break;
    }
  }
}
function fmtTime(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || ""); if (!m) return hhmm || "";
  let h = +m[1]; const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}
function showAlarm(r) {
  document.getElementById("alarm-title").textContent = t("reminderAlarm");
  document.getElementById("alarm-label").textContent = r.label || "";
  document.getElementById("alarm-time").textContent = fmtTime(r.time);
  document.getElementById("alarm-done").textContent = t("reminderDone");
  document.getElementById("alarm").classList.remove("hidden");
  playChime();
}
function dismissAlarm() { document.getElementById("alarm").classList.add("hidden"); }
function playChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = new AC();
    [[659.25, 0], [783.99, 0.32], [987.77, 0.64]].forEach(([f, off]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const st = ctx.currentTime + off;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.16, st + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.6);
      o.start(st); o.stop(st + 0.65);
    });
  } catch (_) {}
}

boot();
