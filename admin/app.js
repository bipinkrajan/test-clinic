/* =============================================================
 * CLINIC ADMIN — staff console (Supabase Auth + REST).
 * Staff log in with email/password; RLS scopes everything to
 * their clinic. English UI (clinic-facing).
 * ============================================================= */
import { SUPABASE } from "../config/supabase.config.js";
import { CLINIC } from "../config/clinic.config.js";
import { HEALTH_ISSUES, TREATMENTS, MEDICINES, ADVICE } from "../config/libraries.js";

const LS = "ayusree.admin.v1";
let S = { token: null, clinicId: null, name: "", tab: "patients", patients: [], current: null, offers: [], clinic: null,
  lists: { doctor: [], treatment: [], medicine: [], advice_do: [], advice_dont: [] } };
let pendingLogo = null;

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const el = (id) => S.token; // noop guard
function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 1800); }
const latest = (arr) => (arr && arr.length) ? arr.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] : null;

/* ---------- API ---------- */
function headers(extra) {
  return Object.assign({ apikey: SUPABASE.anonKey, Authorization: "Bearer " + (S.token || SUPABASE.anonKey), "Content-Type": "application/json" }, extra || {});
}
async function authLogin(email, password) {
  const r = await fetch(`${SUPABASE.url}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: SUPABASE.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error_description || data.msg || data.error_code || data.error || ("HTTP " + r.status));
  return data;
}
async function rest(method, path, opts = {}) {
  const h = headers(opts.prefer ? { Prefer: opts.prefer } : null);
  const r = await fetch(`${SUPABASE.url}/rest/v1/${path}`, { method, headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (r.status === 401) { logout(); throw new Error("session expired"); }
  if (!r.ok) throw new Error(await r.text());
  const txt = await r.text(); return txt ? JSON.parse(txt) : null;
}
const rpc = (fn, body) => rest("POST", `rpc/${fn}`, { body });

/* Call a Supabase Edge Function (server-side, e.g. manage-staff) */
async function fnCall(name, body) {
  const r = await fetch(`${SUPABASE.url}/functions/v1/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE.anonKey, Authorization: "Bearer " + S.token, "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ("HTTP " + r.status));
  return data;
}

/* ---------- Editable lists (dropdowns saved to DB) ---------- */
const KIND_LABEL = { doctor: "doctor / therapist", treatment: "treatment", medicine: "medicine", advice_do: "advice (to do)", advice_dont: "advice (not to do)" };
async function loadLists() {
  const rows = await rest("GET", "lists?select=kind,label&order=label.asc");
  const g = { doctor: [], treatment: [], medicine: [], advice_do: [], advice_dont: [] };
  (rows || []).forEach((r) => { if (g[r.kind]) g[r.kind].push({ label: r.label }); });
  S.lists = g;
}
async function addList(kind) {
  const label = (prompt("Add new " + (KIND_LABEL[kind] || kind) + ":") || "").trim();
  if (!label) return;
  try { await rest("POST", "lists", { body: { clinic_id: S.clinicId, kind, label } }); }
  catch (e) { /* likely duplicate — ignore */ }
  if (!S.lists[kind].some((l) => l.label === label)) S.lists[kind].push({ label });
  // live-update any dropdown of this kind
  document.querySelectorAll(`select[data-listkind="${kind}"]`).forEach((sel) => {
    const o = document.createElement("option"); o.textContent = label; sel.appendChild(o); sel.value = label;
  });
  // live-update any advice chip group of this kind
  document.querySelectorAll(`.chips[data-listkind="${kind}"]`).forEach((cs) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip on";
    b.dataset.id = label; b.textContent = label; cs.appendChild(b);
  });
  toast("Added");
}

/* ---------- Boot ---------- */
async function boot() {
  const saved = localStorage.getItem(LS);
  if (saved) { S = Object.assign(S, JSON.parse(saved)); }
  wire();
  if (S.token) { try { await loadLists(); await loadClinic(); } catch (_) {} showApp(); } else showLogin();
}
async function loadClinic() {
  const rows = await rest("GET", "clinics?select=*");
  S.clinic = (rows && rows[0]) || null;
  if (S.clinic && S.clinic.logo_url) document.querySelector(".topbar-logo").src = S.clinic.logo_url;
}
function persist() { localStorage.setItem(LS, JSON.stringify({ token: S.token, clinicId: S.clinicId, name: S.name })); }

function wire() {
  $("login-btn").onclick = doLogin;
  $("password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("logout").onclick = logout;
  $("tab-patients").onclick = () => { S.tab = "patients"; S.current = null; showApp(); };
  $("tab-moods").onclick = () => { S.tab = "moods"; showApp(); };
  $("tab-offers").onclick = () => { S.tab = "offers"; showApp(); };
  $("tab-staff").onclick = () => { S.tab = "staff"; showApp(); };
  $("tab-branding").onclick = () => { S.tab = "branding"; showApp(); };
  $("view").addEventListener("click", onClick);
  $("view").addEventListener("change", onChange);
}

/* ---------- Login ---------- */
async function doLogin() {
  const email = $("email").value.trim().toLowerCase(), password = $("password").value;
  const err = $("login-err"); err.classList.add("hidden");
  const btn = $("login-btn"); btn.disabled = true; btn.textContent = "Logging in…";
  try {
    const auth = await authLogin(email, password);
    S.token = auth.access_token;
    const staff = await rest("GET", "staff?select=clinic_id,name,role");
    if (!staff || !staff.length) throw new Error("no staff record");
    S.clinicId = staff[0].clinic_id; S.name = staff[0].name;
    persist(); $("password").value = "";
    await loadLists(); await loadClinic();
    S.tab = "patients"; showApp();
  } catch (e) {
    err.textContent = "Login error: " + (e.message || "unknown"); err.classList.remove("hidden");
  } finally { btn.disabled = false; btn.textContent = "Log in"; }
}
function logout() { S = { token: null, clinicId: null, name: "", tab: "patients", patients: [], current: null, offers: [] }; localStorage.removeItem(LS); showLogin(); }

function showLogin() { $("login").classList.remove("hidden"); $("app").classList.add("hidden"); }
function showApp() {
  $("login").classList.add("hidden"); $("app").classList.remove("hidden");
  $("who").textContent = S.name || "";
  $("tab-patients").classList.toggle("active", S.tab === "patients");
  $("tab-moods").classList.toggle("active", S.tab === "moods");
  $("tab-offers").classList.toggle("active", S.tab === "offers");
  $("tab-staff").classList.toggle("active", S.tab === "staff");
  $("tab-branding").classList.toggle("active", S.tab === "branding");
  refreshMoodBadge();
  if (S.tab === "moods") renderMoods();
  else if (S.tab === "offers") loadOffers();
  else if (S.tab === "staff") renderStaff();
  else if (S.tab === "branding") renderBranding();
  else if (S.current) renderPatient();
  else loadPatients();
}

/* ---------- Patient moods (daily mood feed) ---------- */
const MOOD_EMOJI = { love: "❤️", happy: "😊", sad: "😢" };
const MOOD_LABEL = { love: "Love", happy: "Happy", sad: "Sad" };
async function renderMoods() {
  $("view").innerHTML = `<p class="muted">Loading…</p>`;
  let rows;
  try {
    rows = await rest("GET", "mood_logs?select=id,mood,logged_on,seen,created_at,patients(name,op_number)&order=created_at.desc&limit=300");
  } catch (e) {
    $("view").innerHTML = `<div class="card"><p class="err">${esc(e.message)}</p>
      <p class="muted">If this mentions a missing table or function, run <strong>mood-feature.sql</strong> once in Supabase → SQL Editor, then reload.</p></div>`;
    return;
  }
  const fmt = (ts) => { try { return new Date(ts).toLocaleString(); } catch (_) { return ""; } };
  const unseen = (rows || []).filter((r) => !r.seen).length;
  const item = (r) => {
    const nm = r.patients ? r.patients.name : "—";
    const op = r.patients ? r.patients.op_number : "";
    return `<div class="med mood-item ${r.seen ? "" : "unseen"}">
      <div class="top">
        <strong><span class="mood-emo">${MOOD_EMOJI[r.mood] || ""}</span> ${esc(nm)}</strong>
        ${r.seen ? `<span class="muted">seen</span>` : `<button class="btn sm light" data-act="mood-seen" data-id="${r.id}">Mark seen</button>`}
      </div>
      <div class="muted">${esc(MOOD_LABEL[r.mood] || r.mood)} · ${esc(op)} · ${esc(fmt(r.created_at))}</div>
    </div>`;
  };
  $("view").innerHTML = `
    <div class="card"><h3>Patient moods ${unseen ? `<span class="mood-count">${unseen} new</span>` : ""}</h3>
      <p class="muted">Newest first. Patients tap a daily mood in their app — ${MOOD_EMOJI.love} Love, ${MOOD_EMOJI.happy} Happy, ${MOOD_EMOJI.sad} Sad.</p>
      ${unseen ? `<button class="btn light" data-act="mood-seen-all" style="margin-bottom:10px">Mark all seen</button>` : ""}
      ${(rows || []).map(item).join("") || `<p class="muted">No moods logged yet.</p>`}
    </div>`;
}
async function markMoodSeen(id) { await rest("PATCH", `mood_logs?id=eq.${id}`, { body: { seen: true } }); await renderMoods(); refreshMoodBadge(); }
async function markAllMoodsSeen() { await rest("PATCH", `mood_logs?seen=eq.false`, { body: { seen: true } }); await renderMoods(); refreshMoodBadge(); }
async function refreshMoodBadge() {
  const b = $("mood-badge"); if (!b) return;
  try {
    const rows = await rest("GET", "mood_logs?select=id&seen=eq.false&limit=100");
    const n = (rows || []).length;
    b.textContent = n ? String(n) : "";
    b.classList.toggle("hidden", !n);
  } catch (_) { b.classList.add("hidden"); }
}

/* ---------- Patients list ---------- */
async function loadPatients() {
  $("view").innerHTML = `<p class="muted">Loading…</p>`;
  try {
    S.patients = await rest("GET", "patients?select=id,op_number,name,mobile,last_visit_at&order=name.asc");
    renderList();
  } catch (e) { $("view").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
function renderList(filter = "") {
  const f = filter.toLowerCase();
  const rows = S.patients.filter((p) => !f || (p.name || "").toLowerCase().includes(f) || (p.op_number || "").toLowerCase().includes(f));
  $("view").innerHTML = `
    <div class="searchbar">
      <input id="search" placeholder="Search by name or OP number" value="${esc(filter)}">
      <button class="btn" data-act="new-patient">+ New Patient</button>
    </div>
    <div class="plist">
      ${rows.map((p) => `
        <div class="pitem" data-act="open" data-id="${p.id}">
          <div><div class="op">${esc(p.op_number)}</div><div>${esc(p.name)}</div></div>
          <div class="meta">${esc(p.mobile || "")}<br>${p.last_visit_at || ""}</div>
        </div>`).join("") || `<p class="muted">No patients yet. Add one.</p>`}
    </div>`;
  $("search").oninput = (e) => renderList(e.target.value);
}

function suggestOp() {
  const y = new Date().getFullYear();
  const seq = String(S.patients.length + 1).padStart(CLINIC.opNumber.seqPadding, "0");
  const prefix = (S.clinic && S.clinic.op_prefix) || CLINIC.opNumber.prefix;
  return `${prefix}-${y}-${seq}`;
}

/* ---------- Open / load one patient ---------- */
async function openPatient(id) {
  $("view").innerHTML = `<p class="muted">Loading…</p>`;
  const sel = "*,visits(*),diagnoses(*),treatments(*),medicines(*),reminders(*),appointments(*)";
  const rows = await rest("GET", `patients?id=eq.${id}&select=${encodeURIComponent(sel)}`);
  const p = rows[0];
  S.current = {
    patient: p,
    visit: latest(p.visits) || {},
    diagnosis: latest(p.diagnoses) || {},
    treatment: latest(p.treatments) || {},
    medicines: p.medicines || [],
    reminders: p.reminders || [],
    followup: (p.appointments || []).find((a) => a.type === "followup") || {},
  };
  renderPatient();
}
function newPatient() {
  S.current = { patient: { id: null, op_number: suggestOp() }, visit: {}, diagnosis: {}, treatment: {}, medicines: [], reminders: [], followup: {} };
  renderPatient();
}

/* ---------- Patient editor ---------- */
function chipRow(name, list, selected) {
  return `<div class="chips" data-chips="${name}">${list.map((x) =>
    `<button type="button" class="chip ${(selected || []).includes(x.id) ? "on" : ""}" data-id="${x.id}">${esc(x.en)}</button>`).join("")}</div>`;
}
/* dropdown backed by an editable DB list, with a ＋ Add button */
function listSel(name, kind, val) {
  const opts = (S.lists[kind] || []).map((l) => `<option ${l.label === val ? "selected" : ""}>${esc(l.label)}</option>`).join("");
  return `<div class="addrow"><select data-f="${name}" data-listkind="${kind}"><option value=""></option>${opts}</select>`
    + `<button type="button" class="btn sm light" data-act="add-list" data-kind="${kind}">＋</button></div>`;
}
/* advice chips backed by an editable DB list (stores the label text) */
function adviceChips(name, kind, selected) {
  const items = S.lists[kind] || [];
  return `<div class="chips" data-chips="${name}" data-listkind="${kind}">${items.map((l) =>
    `<button type="button" class="chip ${(selected || []).includes(l.label) ? "on" : ""}" data-id="${esc(l.label)}">${esc(l.label)}</button>`).join("")}</div>`
    + `<button type="button" class="btn sm light" data-act="add-list" data-kind="${kind}" style="margin-top:6px">＋ Add advice</button>`;
}
/* treatment chips — multi-select, backed by the editable "treatment" list.
 * The ＋ button adds a new treatment type to the library (and auto-selects it). */
function treatChips(name, kind, selected) {
  const items = S.lists[kind] || [];
  return `<div class="chips" data-chips="${name}" data-listkind="${kind}">${items.map((l) =>
    `<button type="button" class="chip ${(selected || []).includes(l.label) ? "on" : ""}" data-id="${esc(l.label)}">${esc(l.label)}</button>`).join("")}</div>`
    + `<button type="button" class="btn sm light" data-act="add-list" data-kind="${kind}" style="margin-top:6px">＋ Add treatment</button>`;
}
function renderPatient() {
  const c = S.current, p = c.patient, v = c.visit, d = c.diagnosis, tr = c.treatment, f = c.followup;
  const opts = (arr, val, key = "en") => arr.map((x) => `<option ${((x[key]) === val) ? "selected" : ""}>${esc(x[key])}</option>`).join("");
  $("view").innerHTML = `
    <button class="back" data-act="back">‹ All patients</button>

    <div class="card"><h3>Registration</h3>
      <div class="row2">
        <div class="field"><label>OP Number</label><input data-f="op_number" value="${esc(p.op_number || "")}"></div>
        <div class="field"><label>Name</label><input data-f="name" value="${esc(p.name || "")}"></div>
        <div class="field"><label>Age</label><input data-f="age" type="number" value="${esc(p.age ?? "")}"></div>
        <div class="field"><label>Mobile</label><input data-f="mobile" value="${esc(p.mobile || "")}"></div>
        <div class="field"><label>Address</label><input data-f="address" value="${esc(p.address || "")}"></div>
        <div class="field"><label>Referred by</label><input data-f="referred_by" value="${esc(p.referred_by || "")}"></div>
      </div>
      <button class="btn block" data-act="save-patient">${p.id ? "Save patient" : "Create patient"}</button>
    </div>

    ${p.id ? patientBody(v, d, tr, f) : `<p class="muted">Create the patient first, then add records and set a login PIN.</p>`}
  `;
}
function patientBody(v, d, tr, f) {
  return `
    <div class="card"><h3>Login PIN</h3>
      <div class="field"><label>Set / reset PIN (share with patient)</label><input data-f="pin" placeholder="e.g. 1234"></div>
      <button class="btn light" data-act="set-pin">Save PIN</button>
      <button class="btn light" data-act="qr-poster">🖨️ Patient QR Poster</button>
      <p class="pin-note">Patient logs in with their OP number + this PIN. The QR poster opens the app with their OP pre-filled — they just enter the PIN.</p>
    </div>

    <div class="card"><h3>Current issue</h3>
      <div class="field"><label>Main issue</label><input data-f="issue" value="${esc(v.issue || "")}"></div>
      <div class="field"><label>History / symptoms</label><textarea data-f="history">${esc(v.history || "")}</textarea></div>
      <div class="field"><label>Medicines / treatments already taken</label><textarea data-f="previous_treatment">${esc(v.previous_treatment || "")}</textarea></div>
      <div class="field"><label>Other health issues</label>${chipRow("other_issues", HEALTH_ISSUES, v.other_issues)}</div>
      <div class="field"><label>Other (specify) — separate multiple with commas</label><input data-f="other_specify" value="${esc(((v.other_issues) || []).filter((x) => !HEALTH_ISSUES.some((h) => h.id === x)).join(", "))}"></div>
      <button class="btn block" data-act="save-visit">Save current issue</button>
    </div>

    <div class="card"><h3>Diagnosis (doctor only)</h3>
      <div class="field"><label>Diagnosis</label><textarea data-f="dx_text">${esc(d.text || "")}</textarea></div>
      <div class="field"><label>Clinical notes</label><textarea data-f="dx_notes">${esc(d.notes || "")}</textarea></div>
      <label class="switch-row"><input type="checkbox" data-f="dx_share" ${d.shared_with_patient ? "checked" : ""}> Share diagnosis with patient</label>
      <button class="btn block" data-act="save-diagnosis">Save diagnosis</button>
    </div>

    <div class="card"><h3>Treatment plan</h3>
      <div class="field"><label>Treatments (select one or more)</label>${treatChips("tr_names", "treatment", (tr.name || "").split(/\s*,\s*/).filter(Boolean))}</div>
      <div class="row2">
        <div class="field"><label>Suggested by (doctor / therapist)</label>${listSel("tr_by", "doctor", tr.by_doctor)}</div>
        <div class="field"><label>Duration (days)</label><input data-f="tr_days" type="number" value="${esc(tr.duration_days || 30)}"></div>
      </div>
      <div class="field"><label>Therapy instructions</label><textarea data-f="tr_instr">${esc(tr.instructions || "")}</textarea></div>
      <div class="field"><label>Advice — what to do</label>${adviceChips("advice_do", "advice_do", tr.advice_do)}</div>
      <div class="field"><label>Advice — what not to do</label>${adviceChips("advice_dont", "advice_dont", tr.advice_dont)}</div>
      <button class="btn block" data-act="save-treatment">Save treatment</button>
    </div>

    <div class="card"><h3>Medicines</h3>
      <div id="medlist">${(S.current.medicines || []).map(medRow).join("") || `<p class="muted">None yet.</p>`}</div>
      <div class="row2">
        <div class="field"><label>Medicine</label>${listSel("m_name", "medicine", "")}</div>
        <div class="field"><label>Timing</label><input data-f="m_timing" placeholder="7:00 AM, 7:00 PM"></div>
        <div class="field"><label>Dosage</label><input data-f="m_dosage" placeholder="15 ml with warm water"></div>
        <div class="field"><label>Before / after food</label><select data-f="m_food"><option value="before">Before food</option><option value="after">After food</option></select></div>
        <div class="field"><label>Refill date</label><input data-f="m_refill" type="date"></div>
        <div class="field"><label>Instructions</label><input data-f="m_instr"></div>
      </div>
      <button class="btn light" data-act="add-medicine">+ Add medicine</button>
    </div>

    <div class="card"><h3>Reminders</h3>
      <div id="remlist">${(S.current.reminders || []).map(remRow).join("") || `<p class="muted">None yet.</p>`}</div>
      <div class="row2">
        <div class="field"><label>Time</label><input data-f="r_time" type="time"></div>
        <div class="field"><label>Medicine / item (from your medicines)</label>${listSel("r_med", "medicine", "")}</div>
      </div>
      <button class="btn light" data-act="add-reminder">+ Add reminder</button>
    </div>

    <div class="card"><h3>Follow-up appointment</h3>
      <div class="row2">
        <div class="field"><label>Date</label><input data-f="f_date" type="date" value="${esc(f.date || "")}"></div>
        <div class="field"><label>Time</label><input data-f="f_time" type="time" value="${esc(f.time || "")}"></div>
      </div>
      <button class="btn block" data-act="save-followup">Save follow-up</button>
    </div>

    <div class="card"><h3>Danger zone</h3>
      <button class="btn danger" data-act="del-patient">Delete this patient</button>
      <p class="pin-note">Permanently removes the patient and all their records.</p>
    </div>`;
}
const medRow = (m) => `<div class="med"><div class="top"><strong>${esc(m.name)}</strong>
  <button class="btn danger sm" data-act="del-medicine" data-id="${m.id}">Remove</button></div>
  <div class="muted">${esc(m.timing || "")} · ${esc(m.dosage || "")} · ${m.food === "after" ? "after food" : "before food"}</div></div>`;
const remRow = (r) => `<div class="med"><div class="top"><strong>${esc(r.time)} — ${esc(r.label)}</strong>
  <button class="btn danger sm" data-act="del-reminder" data-id="${r.id}">Remove</button></div></div>`;

/* ---------- collect fields ---------- */
function fields() {
  const o = {};
  document.querySelectorAll("[data-f]").forEach((e) => { o[e.dataset.f] = e.type === "checkbox" ? e.checked : e.value; });
  document.querySelectorAll("[data-chips]").forEach((cs) => { o[cs.dataset.chips] = [...cs.querySelectorAll(".chip.on")].map((c) => c.dataset.id); });
  return o;
}

/* ---------- click routing ---------- */
function onChange(e) {
  const a = e.target.dataset && e.target.dataset.act;
  if (a === "offer-image") handleOfferImage(e.target);
  if (a === "brand-logo" && e.target.files[0]) {
    compress(e.target.files[0], 600, 0.85).then((url) => { pendingLogo = url; const pv = $("brand-preview"); if (pv) { pv.src = url; pv.classList.remove("hidden"); } });
  }
}
async function onClick(e) {
  const chip = e.target.closest(".chip"); if (chip) { chip.classList.toggle("on"); return; }
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act, id = b.dataset.id;
  const map = {
    "new-patient": newPatient,
    "open": () => openPatient(id),
    "back": () => { S.current = null; loadPatients(); },
    "save-patient": savePatient,
    "set-pin": setPin,
    "save-visit": saveVisit,
    "save-diagnosis": saveDiagnosis,
    "save-treatment": saveTreatment,
    "add-medicine": addMedicine,
    "del-medicine": () => delMedicine(id),
    "add-reminder": addReminder,
    "del-reminder": () => delReminder(id),
    "save-followup": saveFollowup,
    "del-patient": deletePatient,
    "add-list": () => addList(b.dataset.kind),
    "add-offer": addOffer,
    "del-offer": () => delOffer(id),
    "save-branding": saveBranding,
    "add-staff": addStaff,
    "del-staff": () => delStaff(id),
    "mood-seen": () => markMoodSeen(id),
    "mood-seen-all": markAllMoodsSeen,
    "qr-poster": () => makePoster({ op: S.current.patient.op_number, name: S.current.patient.name }),
    "clinic-qr": () => makePoster({}),
  };
  if (map[act]) { e.preventDefault(); try { await map[act](); } catch (err) { toast(err.message.slice(0, 80)); } }
}

/* ---------- saves ---------- */
async function savePatient() {
  const f = fields();
  const row = { name: f.name, age: f.age ? Number(f.age) : null, mobile: f.mobile, address: f.address, referred_by: f.referred_by, op_number: f.op_number };
  if (S.current.patient.id) {
    await rest("PATCH", `patients?id=eq.${S.current.patient.id}`, { body: row });
    toast("Saved");
  } else {
    const created = await rest("POST", "patients", { body: Object.assign({ clinic_id: S.clinicId }, row), prefer: "return=representation" });
    S.current.patient = created[0]; toast("Patient created");
    await loadPatients(); // refresh count/list cache
    renderPatient();
  }
}
async function deletePatient() {
  if (!S.current.patient.id) return;
  if (!confirm("Delete this patient and ALL their records permanently? This cannot be undone.")) return;
  await rest("DELETE", `patients?id=eq.${S.current.patient.id}`);
  toast("Patient deleted"); S.current = null; await loadPatients();
}
async function setPin() {
  const pin = (fields().pin || "").trim(); if (!pin) return toast("Enter a PIN");
  await rpc("set_patient_pin", { p_patient_id: S.current.patient.id, p_pin: pin });
  toast("PIN saved");
}
async function saveVisit() {
  const f = fields();
  const custom = (f.other_specify || "").split(",").map((s) => s.trim()).filter(Boolean);
  const other = [...(f.other_issues || []), ...custom];
  await rest("POST", "visits", { body: { patient_id: S.current.patient.id, issue: f.issue, history: f.history, previous_treatment: f.previous_treatment, other_issues: other } });
  toast("Saved"); await openPatient(S.current.patient.id);
}
async function saveDiagnosis() {
  const f = fields();
  await rest("POST", "diagnoses", { body: { patient_id: S.current.patient.id, text: f.dx_text, notes: f.dx_notes, shared_with_patient: !!f.dx_share } });
  toast("Saved"); await openPatient(S.current.patient.id);
}
async function saveTreatment() {
  const f = fields();
  const trName = (f.tr_names || []).join(", ");
  await rest("POST", "treatments", { body: { patient_id: S.current.patient.id, by_doctor: f.tr_by, name: trName, duration_days: Number(f.tr_days) || 30, instructions: f.tr_instr, advice_do: f.advice_do || [], advice_dont: f.advice_dont || [] } });
  toast("Saved"); await openPatient(S.current.patient.id);
}
async function addMedicine() {
  const f = fields(); if (!f.m_name) return;
  await rest("POST", "medicines", { body: { patient_id: S.current.patient.id, name: f.m_name, type: "kashayam", timing: f.m_timing, dosage: f.m_dosage, food: f.m_food, instructions: f.m_instr, refill_date: f.m_refill || null } });
  toast("Added"); await openPatient(S.current.patient.id);
}
async function delMedicine(id) { await rest("DELETE", `medicines?id=eq.${id}`); toast("Removed"); await openPatient(S.current.patient.id); }
async function addReminder() {
  const f = fields(); if (!f.r_time || !f.r_med) return;
  const label = f.r_med;
  const low = label.toLowerCase();
  const kind = /thailam|oil|external|lepam/.test(low) ? "external" : /kashayam/.test(low) ? "kashayam" : "medicine";
  await rest("POST", "reminders", { body: { patient_id: S.current.patient.id, time: f.r_time, label, kind } });
  toast("Added"); await openPatient(S.current.patient.id);
}
async function delReminder(id) { await rest("DELETE", `reminders?id=eq.${id}`); toast("Removed"); await openPatient(S.current.patient.id); }
async function saveFollowup() {
  const f = fields(); const pid = S.current.patient.id;
  await rest("DELETE", `appointments?patient_id=eq.${pid}&type=eq.followup`);
  await rest("POST", "appointments", { body: { patient_id: pid, date: f.f_date, time: f.f_time, type: "followup", status: "upcoming", reminder_mode: "both" } });
  toast("Saved"); await openPatient(pid);
}

/* ---------- Branding (white-label settings) ---------- */
function renderBranding() {
  const c = S.clinic || {};
  pendingLogo = null;
  $("view").innerHTML = `
    <div class="card"><h3>Clinic branding</h3>
      <p class="muted">These apply to both the patient app and this admin console. Changes go live after the apps reload.</p>
      <div class="field"><label>Logo</label>
        <input type="file" accept="image/*" data-act="brand-logo">
        <img id="brand-preview" class="offer-img ${c.logo_url ? "" : "hidden"}" src="${esc(c.logo_url || "")}">
      </div>
      <div class="row2">
        <div class="field"><label>Clinic name</label><input data-f="b_name" value="${esc(c.name || "")}"></div>
        <div class="field"><label>Theme colour</label><input data-f="b_color" type="color" value="${esc(c.theme_color || "#245b35")}"></div>
        <div class="field"><label>OP prefix (just a prefix, e.g. OP or TC)</label><input data-f="b_prefix" placeholder="OP" value="${esc(c.op_prefix || "")}"></div>
      </div>
      <div class="field"><label>Google review link</label><input data-f="b_review" value="${esc(c.review_url || "")}"></div>
      <h3 style="margin-top:18px">Clinic contact (shown to patients)</h3>
      <div class="row2">
        <div class="field"><label>Phone</label><input data-f="b_phone" value="${esc(c.phone || "")}"></div>
        <div class="field"><label>WhatsApp</label><input data-f="b_whatsapp" value="${esc(c.whatsapp || "")}"></div>
        <div class="field"><label>Email</label><input data-f="b_email" value="${esc(c.email || "")}"></div>
        <div class="field"><label>Google Maps link</label><input data-f="b_map" value="${esc(c.map_url || "")}"></div>
      </div>
      <div class="field"><label>Address</label><textarea data-f="b_address">${esc(c.address || "")}</textarea></div>
      <button class="btn block" data-act="save-branding">Save branding</button>
      <button class="btn light" data-act="clinic-qr" style="margin-top:8px">🖨️ Clinic QR Poster (for patients)</button>
      <p class="pin-note">Prints a poster with your clinic name + a QR code patients scan to open the app.</p>
    </div>`;
}
async function saveBranding() {
  const f = fields();
  const body = { name: f.b_name, theme_color: f.b_color, op_prefix: f.b_prefix, review_url: f.b_review,
    phone: f.b_phone, whatsapp: f.b_whatsapp, email: f.b_email, address: f.b_address, map_url: f.b_map };
  if (pendingLogo) body.logo_url = pendingLogo;
  await rest("PATCH", `clinics?id=eq.${S.clinicId}`, { body });
  Object.assign(S.clinic, body);
  if (pendingLogo) document.querySelector(".topbar-logo").src = pendingLogo;
  pendingLogo = null;
  toast("Branding saved");
}

/* ---------- Staff management (via manage-staff Edge Function) ---------- */
async function renderStaff() {
  $("view").innerHTML = `<p class="muted">Loading\u2026</p>`;
  let staff = [];
  try { staff = (await fnCall("manage-staff", { action: "list" })).staff || []; }
  catch (e) { $("view").innerHTML = `<div class="card"><p class="err">${esc(e.message)}</p><p class="muted">If this says Not Found, the manage-staff function is not deployed yet \u2014 see the setup guide.</p></div>`; return; }
  $("view").innerHTML = `
    <div class="card"><h3>Staff logins</h3>
      ${staff.map((s) => `<div class="med"><div class="top"><strong>${esc(s.name)}</strong>
        ${s.self ? `<span class="muted">you</span>` : `<button class="btn danger sm" data-act="del-staff" data-id="${s.id}">Remove</button>`}</div>
        <div class="muted">${esc(s.email)} \u00b7 ${esc(s.role)}</div></div>`).join("") || `<p class="muted">No staff yet.</p>`}
    </div>
    <div class="card"><h3>Add staff login</h3>
      <div class="row2">
        <div class="field"><label>Full name</label><input data-f="st_name"></div>
        <div class="field"><label>Email</label><input data-f="st_email" type="email"></div>
        <div class="field"><label>Password (6+ characters)</label><input data-f="st_pass"></div>
        <div class="field"><label>Role</label><select data-f="st_role"><option value="admin">Admin (full access)</option><option value="doctor">Doctor / staff</option></select></div>
      </div>
      <button class="btn block" data-act="add-staff">Create staff login</button>
      <p class="pin-note">They log in at this clinic's /admin/ URL with this email + password.</p>
    </div>`;
}
async function addStaff() {
  const f = fields();
  if (!f.st_email || !f.st_pass) { toast("Enter email and password"); return; }
  await fnCall("manage-staff", { action: "create", email: f.st_email, password: f.st_pass, name: f.st_name, role: f.st_role });
  toast("Staff added"); renderStaff();
}
async function delStaff(id) {
  if (!confirm("Remove this staff login?")) return;
  await fnCall("manage-staff", { action: "delete", staff_id: id });
  toast("Removed"); renderStaff();
}

/* ---------- Offers ---------- */
let pendingImg = null;
async function loadOffers() {
  $("view").innerHTML = `<p class="muted">Loading…</p>`;
  S.offers = await rest("GET", "offers?select=*&order=id.desc");
  $("view").innerHTML = `
    <div class="card"><h3>Add offer / update</h3>
      <div class="field"><label>Image (optional)</label><input type="file" accept="image/*" data-act="offer-image"><img id="offer-preview" class="offer-img hidden"></div>
      <div class="field"><label>Header (bold)</label><input data-f="o_title"></div>
      <div class="field"><label>Description</label><textarea data-f="o_body"></textarea></div>
      <div class="field"><label>Badge (optional)</label><input data-f="o_badge" placeholder="Offer / New"></div>
      <button class="btn block" data-act="add-offer">Publish offer</button>
    </div>
    <div class="card"><h3>Published offers</h3>
      ${S.offers.map((o) => `<div class="med"><div class="top"><strong>${esc(o.title || "")}</strong>
        <button class="btn danger sm" data-act="del-offer" data-id="${o.id}">Delete</button></div>
        <div class="muted">${esc(o.body || "")}</div>${o.image_url ? `<img class="offer-img" src="${esc(o.image_url)}">` : ""}</div>`).join("") || `<p class="muted">No offers yet.</p>`}
    </div>`;
}
function handleOfferImage(input) {
  if (!input.files[0]) return;
  compress(input.files[0]).then((url) => { pendingImg = url; const pv = $("offer-preview"); pv.src = url; pv.classList.remove("hidden"); });
}
async function addOffer() {
  const f = fields(); if (!f.o_title && !pendingImg) return toast("Add a header or image");
  await rest("POST", "offers", { body: { clinic_id: S.clinicId, title: f.o_title, body: f.o_body, badge: f.o_badge || null, image_url: pendingImg || null, active: true } });
  pendingImg = null; toast("Published"); loadOffers();
}
async function delOffer(id) { await rest("DELETE", `offers?id=eq.${id}`); toast("Deleted"); loadOffers(); }

/* ---------- QR poster (per-patient or generic clinic) ---------- */
function makePoster({ op, name } = {}) {
  if (typeof window.qrcode !== "function") { toast("QR library not loaded"); return; }
  // The patient app lives one level up from /admin/. Use the live origin so the
  // QR points at the clinic's real domain (not the config placeholder).
  const base = new URL("..", location.href).href.replace(/\/+$/, "");
  const url = op ? `${base}/?op=${encodeURIComponent(op)}` : `${base}/`;
  const clinicName = (S.clinic && S.clinic.name) || (CLINIC.name && CLINIC.name.en) || "Ayurveda Clinic";
  const logo = (S.clinic && S.clinic.logo_url) || new URL("../assets/logo.svg", location.href).href;

  const qr = window.qrcode(0, "M");
  qr.addData(url); qr.make();
  const qrImg = qr.createDataURL(8, 4);

  const heading = op ? "Scan to open your patient app" : "Scan to open the patient app";
  const sub = op
    ? `Your OP number is pre-filled — just enter your PIN.<br><strong>OP: ${esc(op)}</strong>${name ? " · " + esc(name) : ""}`
    : "Enter your OP number and PIN to log in.";

  const html = `<!doctype html><html><head><meta charset="utf-8">
    <title>${esc(clinicName)} — Patient QR</title>
    <style>
      *{box-sizing:border-box} body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        background:#fff;color:#1d2b1f;display:flex;align-items:center;justify-content:center;min-height:100vh}
      .poster{width:600px;max-width:92vw;text-align:center;border:2px solid #245b35;border-radius:20px;padding:40px}
      .logo{height:70px;margin-bottom:12px} h1{margin:0 0 4px;font-size:26px;color:#245b35}
      .tag{margin:0 0 24px;color:#697566;font-size:14px}
      .qr{width:300px;height:300px;margin:0 auto 20px;border:1px solid #dce8d5;border-radius:12px;padding:10px}
      .qr img{width:100%;height:100%;image-rendering:pixelated}
      .h2{font-size:18px;font-weight:600;margin:0 0 8px} .sub{color:#697566;font-size:14px;line-height:1.5;margin:0 0 8px}
      .url{word-break:break-all;color:#245b35;font-size:12px;margin-top:6px} .btns{margin-top:18px}
      .btns button{font:inherit;padding:10px 18px;border-radius:10px;border:1px solid #245b35;
        background:#245b35;color:#fff;cursor:pointer;margin:0 6px} .btns .ghost{background:#fff;color:#245b35}
      @media print{.btns{display:none}}
    </style></head><body>
    <div class="poster">
      <img class="logo" src="${logo}" alt="" onerror="this.style.display='none'">
      <h1>${esc(clinicName)}</h1>
      <p class="tag">Ayurveda Patient Care</p>
      <div class="qr"><img src="${qrImg}" alt="QR code"></div>
      <p class="h2">${heading}</p><p class="sub">${sub}</p>
      <p class="url">${esc(url)}</p>
      <div class="btns">
        <button onclick="window.print()">Print / Save as PDF</button>
        <button class="ghost" onclick="window.close()">Close</button>
      </div>
    </div></body></html>`;

  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) { toast("Allow pop-ups to print the poster"); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

function compress(file, maxW = 900, q = 0.72) {
  return new Promise((res) => {
    const rd = new FileReader();
    rd.onload = () => { const img = new Image(); img.onload = () => {
      const s = Math.min(1, maxW / img.width); const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", q));
    }; img.onerror = () => res(rd.result); img.src = rd.result; };
    rd.readAsDataURL(file);
  });
}

boot();
