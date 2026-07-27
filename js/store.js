/* =============================================================
 * STORE (patient app) — holds the logged-in patient's record.
 * Data comes from Supabase via api.patientLogin() and is cached
 * in localStorage so the app also opens offline.
 * ============================================================= */

const LS_SESSION = "ayusree.session.v1";
const LS_CREDS = "ayusree.creds.v1";   // OP + PIN, kept so the app can post a daily mood
let cache = null;
let creds = null;

/* Map the Supabase patient_portal bundle -> the shape screens expect */
export function mapBundle(b) {
  const p = b.patient || {};
  const v = b.visit || {};
  const tr = b.treatment || {};
  const appts = (b.appointments || []).map((a, i) => ({
    id: "a" + i, date: a.date, time: a.time, type: a.type, status: a.status,
  }));
  const fu = (b.appointments || []).find((a) => a.type === "followup") || {};
  return {
    patient: {
      opNumber: p.op_number || "", name: p.name || "", age: p.age ?? "",
      mobile: p.mobile || "", address: p.address || "", referredBy: p.referred_by || "",
      joined: p.joined_at || null, lastVisit: p.last_visit_at || null,
    },
    currentIssue: {
      issue: v.issue || "", history: v.history || "",
      previousTreatment: v.previous_treatment || "", otherIssues: v.other_issues || [],
    },
    diagnosis: b.diagnosis
      ? { text: b.diagnosis.text || "", notes: b.diagnosis.notes || "", sharedWithPatient: true }
      : { text: "", notes: "", sharedWithPatient: false },
    treatment: {
      by: tr.by_doctor || "", name: tr.name || "",
      durationDays: tr.duration_days || 30, startDate: tr.start_date || null,
      instructions: tr.instructions || "",
    },
    pathya: {
      allowed: [], avoid: [],
      adviceDo: tr.advice_do || [], adviceDont: tr.advice_dont || [],
    },
    medicines: (b.medicines || []).map((m, i) => ({
      id: m.id || "m" + i, name: m.name, type: m.type || "kashayam",
      timing: m.timing || "", dosage: m.dosage || "", food: m.food || "before",
      instructions: m.instructions || "", refillDate: m.refill_date || null,
    })),
    reminders: (b.reminders || []).map((r, i) => ({
      id: "r" + i, time: r.time, label: r.label, kind: r.kind,
    })),
    appointments: appts,
    followup: { date: fu.date || null, time: fu.time || "", reminderMode: fu.reminder_mode || "both" },
    progress: { completedDays: p.completed_days || 0 },
    ads: (b.offers || []).map((o) => ({
      id: "ad" + o.id, image: o.image_url || null, color: "#245b35",
      title: o.title || "", body: o.body || "", badge: o.badge || null,
    })),
    mood: { today: b.mood_today || null },
  };
}

/* ---------- Session ---------- */
export function loginWithBundle(raw, cred) {
  cache = mapBundle(raw);
  localStorage.setItem(LS_SESSION, JSON.stringify(cache));
  if (cred && cred.op && cred.pin) {
    creds = { op: cred.op, pin: cred.pin };
    localStorage.setItem(LS_CREDS, JSON.stringify(creds));
  }
  return cache;
}
export function isLoggedIn() {
  return !!(cache || localStorage.getItem(LS_SESSION));
}
export function logout() {
  cache = null; creds = null;
  localStorage.removeItem(LS_SESSION);
  localStorage.removeItem(LS_CREDS);
}

/* OP + PIN of the logged-in patient (used only to post a daily mood) */
export function getCreds() {
  if (creds) return creds;
  const raw = localStorage.getItem(LS_CREDS);
  creds = raw ? JSON.parse(raw) : null;
  return creds;
}

/* Remember today's chosen mood locally so the dashboard shows it selected */
export function setMoodToday(mood) {
  const d = getData(); if (!d) return null;
  d.mood = { today: mood };
  localStorage.setItem(LS_SESSION, JSON.stringify(d));
  return d;
}

export function getData() {
  if (cache) return cache;
  const raw = localStorage.getItem(LS_SESSION);
  cache = raw ? JSON.parse(raw) : null;
  return cache;
}

/* Local-only cosmetic update (e.g. mark-today-complete); persists to cache */
export function update(section, patch) {
  const d = getData(); if (!d) return null;
  d[section] = Array.isArray(patch) ? patch : { ...d[section], ...patch };
  localStorage.setItem(LS_SESSION, JSON.stringify(d));
  return d;
}

/* Patient app is always the patient view (admin editing lives in the Admin app) */
export function isDoctor() { return false; }
