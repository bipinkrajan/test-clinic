/* =============================================================
 * SCREENS — one render() function per screen.
 * Doctor role = editable forms. Patient role = read-only views
 * (admin fills records during the visit). Interactivity wired in
 * app.js via event delegation + data-action attributes.
 * ============================================================= */
import { t, L, getLang } from "./i18n.js";
import { getData, isDoctor } from "./store.js";
import { CLINIC } from "../config/clinic.config.js";
import { HEALTH_ISSUES, TREATMENTS, MEDICINES, ADVICE } from "../config/libraries.js";
import {
  card, row, pill, field, input, textarea, select, button,
  chipSelect, doctorOnly, esc,
} from "./components.js";

const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString(getLang() === "ml" ? "ml-IN" : "en-GB",
    { day: "2-digit", month: "short", year: "numeric" });
};
const labelFor = (list, id) => { const x = list.find((i) => i.id === id); return x ? L(x) : id; };

/* read-only labelled text block (for long fields) */
const block = (labelKey, text) =>
  `<div class="ro-block"><div class="ro-label">${t(labelKey)}</div><div class="ro-text">${esc(text || "-")}</div></div>`;
/* read-only pills from a library id list */
const pillList = (list, ids, tone = "") =>
  (ids && ids.length) ? ids.map((id) => pill(labelFor(list, id), tone)).join("") : `<span class="muted-note">${t("none")}</span>`;

/* ---------------- 1. DASHBOARD ---------------- */
export function dashboard() {
  const d = getData();
  const p = d.patient;
  const total = d.treatment.durationDays;
  const done = d.progress.completedDays;
  const issues = d.currentIssue.otherIssues.map((id) => labelFor(HEALTH_ISSUES, id));

  const MOODS = [
    { key: "love", emoji: "❤️", labelKey: "moodLove" },
    { key: "happy", emoji: "😊", labelKey: "moodHappy" },
    { key: "sad", emoji: "😢", labelKey: "moodSad" },
  ];
  const moodToday = d.mood && d.mood.today;
  const moodCard = card("moodTitle", `
    <div class="mood-row">
      ${MOODS.map((m) => `
        <button type="button" class="mood-btn ${moodToday === m.key ? "on" : ""}" data-action="mood" data-mood="${m.key}">
          <span class="mood-emoji">${m.emoji}</span>
          <span class="mood-lbl">${t(m.labelKey)}</span>
        </button>`).join("")}
    </div>
    <div class="mood-note">${moodToday ? t("moodSharedNote") : t("moodPrompt")}</div>
  `, { cls: "mood-card" });

  return `
    ${card("opNumber", `<div class="op-number">${esc(p.opNumber)}</div>`, { cls: "op-card" })}
    ${moodCard}
    ${card("patientOverview", `
      ${row("name", p.name)}
      ${row("age", p.age)}
      ${row("mobile", p.mobile)}
      ${row("address", p.address)}
      ${row("joined", fmtDate(p.joined))}
      ${row("lastVisit", fmtDate(p.lastVisit))}
    `)}
    ${card("latestHealth", `
      ${pill(d.currentIssue.issue, "red")}
      ${issues.map((i) => pill(i, "orange")).join("")}
      ${row("treatmentJourney", `${t("day")} ${done} ${t("of")} ${total}`, true)}
      <div class="progress"><div class="progress-bar" style="width:${Math.round(done/total*100)}%"></div></div>
    `)}
    ${card("todaysReminders", `
      ${d.reminders.map((r) => row(r.time, r.label, true)).join("")}
      ${button("markComplete", { action: "mark-complete" })}
    `)}
    ${card("nextFollowup", `
      ${row("date", fmtDate(d.followup.date))}
      ${row("time", d.followup.time)}
      ${button("viewAppointment", { cls: "light", action: "goto-followup" })}
    `)}`;
}

/* ---------------- 2. ADS / OFFERS (view + share; doctor can add) ---------------- */
function flyerHtml(a) {
  const doc = isDoctor();
  const media = a.image
    ? `<img class="flyer-img" src="${esc(a.image)}" alt="">`
    : `<div class="flyer-banner" style="background:${esc(a.color || "#245b35")}">
         ${a.badge ? `<span class="flyer-badge">${esc(L(a.badge))}</span>` : ""}
         <div class="flyer-title">${esc(L(a.title))}</div>
       </div>`;
  return `
    <div class="flyer">
      ${media}
      <div class="flyer-body">
        ${a.image ? `<div class="flyer-title dark">${esc(L(a.title))}</div>` : ""}
        <p>${esc(L(a.body))}</p>
        <div class="flyer-actions">
          <button class="btn small orange" data-action="share-ad" data-id="${a.id}"><span class="share-ic">⤴</span> ${t("share")}</button>
          ${doc ? `<button class="btn small light" data-action="delete-ad" data-id="${a.id}">${t("remove")}</button>` : ""}
        </div>
      </div>
    </div>`;
}

export function ads() {
  const d = getData();
  const list = (d.ads && d.ads.length)
    ? `<div class="flyers">${d.ads.map(flyerHtml).join("")}</div>`
    : `<p class="muted-note">${t("none")}</p>`;

  // doctor/admin: add-offer form with image upload
  const addForm = isDoctor() ? `
    <form data-form="newad">
    ${card("addOffer", `
      <div class="field">
        <label>${t("offerImage")}</label>
        <input type="file" accept="image/*" name="image" id="ad-image">
        <img id="ad-preview" class="ad-preview hidden" alt="">
      </div>
      ${field("offerHeader", input("title", ""))}
      ${field("offerText", textarea("body", ""))}
      ${button("publishOffer", { action: "publish-ad" })}
    `)}
    </form>` : "";

  return list + addForm;
}

/* ---------------- 3. REGISTRATION / VISIT ---------------- */
export function visit() {
  const d = getData();
  const p = d.patient;
  const ci = d.currentIssue;

  if (!isDoctor()) {
    return `
      ${card("patientOverview", `
        ${row("opNumber", p.opNumber)}
        ${row("name", p.name)}
        ${row("age", p.age)}
        ${row("mobileNumber", p.mobile)}
        ${row("address", p.address)}
        ${row("referredBy", p.referredBy)}
      `)}
      ${card("currentHealthIssue", `
        ${row("issue", ci.issue)}
        ${block("history", ci.history)}
        ${block("previousTreatment", ci.previousTreatment)}
        <div class="ro-label">${t("otherIssues")}</div>
        <div>${pillList(HEALTH_ISSUES, ci.otherIssues, "orange")}</div>
      `)}`;
  }

  return `
    <form data-form="visit">
    ${card("patientOverview", `
      ${field("opNumber", input("opNumber", p.opNumber))}
      ${field("name", input("name", p.name))}
      ${field("age", input("age", p.age, "number"))}
      ${field("mobileNumber", input("mobile", p.mobile))}
      ${field("address", textarea("address", p.address))}
      ${field("referredBy", input("referredBy", p.referredBy))}
    `)}
    ${card("currentHealthIssue", `
      ${field("issue", input("issue", ci.issue))}
      ${field("history", textarea("history", ci.history))}
      ${field("previousTreatment", textarea("previousTreatment", ci.previousTreatment))}
      ${field("otherIssues", chipSelect("otherIssues",
        HEALTH_ISSUES.map((i) => ({ id: i.id, label: L(i) })), ci.otherIssues))}
      ${button("saveVisit", { action: "save-visit" })}
    `)}
    </form>`;
}

/* ---------------- 4. DIAGNOSIS (doctor-only) ---------------- */
export function diagnosis() {
  const d = getData();
  const dx = d.diagnosis;
  if (!isDoctor()) {
    if (!dx.sharedWithPatient) {
      return card("diagnosis", `<p class="muted-note">🔒 ${t("hiddenFromPatient")}</p>`);
    }
    return card("diagnosis", `
      ${block("diagnosis", dx.text)}
      ${block("clinicalNotes", dx.notes)}`);
  }
  return `
    <form data-form="diagnosis">
    ${card("diagnosis", `
      ${doctorOnly()}
      ${field("diagnosis", textarea("text", dx.text))}
      ${field("clinicalNotes", textarea("notes", dx.notes))}
      <label class="switch-row">
        <input type="checkbox" name="sharedWithPatient" ${dx.sharedWithPatient ? "checked" : ""}>
        <span>${t("shareWithPatient")}</span>
      </label>
      ${button("saveDiagnosis", { action: "save-diagnosis" })}
    `)}
    </form>`;
}

/* ---------------- 5. TREATMENT PLAN (+ advice) ---------------- */
export function treatment() {
  const d = getData();
  const tr = d.treatment;
  const adv = d.pathya;

  if (!isDoctor()) {
    return `
      ${card("treatmentPlan", `
        ${row("treatmentBy", tr.by)}
        ${row("treatmentName", tr.name)}
        ${row("duration", tr.durationDays)}
        ${block("therapyInstructions", tr.instructions)}
      `)}
      ${card("adviceDo", pillList(ADVICE.do, adv.adviceDo))}
      ${card("adviceNotDo", pillList(ADVICE.dont, adv.adviceDont, "orange"))}`;
  }

  const docs = CLINIC.doctors.map((x) => ({ value: x.name, label: x.name }));
  const treatOpts = TREATMENTS.map((x) => ({ value: L(x), label: L(x) }));
  return `
    <form data-form="treatment">
    ${card("treatmentPlan", `
      ${field("treatmentBy", select("by", docs, tr.by))}
      ${field("treatmentName", select("name", treatOpts, tr.name))}
      ${field("duration", input("durationDays", tr.durationDays, "number"))}
      ${field("therapyInstructions", textarea("instructions", tr.instructions))}
    `)}
    ${card("adviceDo", chipSelect("adviceDo",
      ADVICE.do.map((x) => ({ id: x.id, label: L(x) })), adv.adviceDo))}
    ${card("adviceNotDo", chipSelect("adviceDont",
      ADVICE.dont.map((x) => ({ id: x.id, label: L(x) })), adv.adviceDont))}
    ${button("saveTreatment", { action: "save-treatment" })}
    </form>`;
}

/* ---------------- 6. MEDICINES & INTAKE + REFILL ---------------- */
export function medicine() {
  const d = getData();
  const list = d.medicines.map((m) => `
    <div class="med-item">
      <div class="med-head">
        <strong>${esc(m.name)}</strong>
        <span class="pill ${m.type === "thailam" ? "orange" : ""}">${esc(m.timing)}</span>
      </div>
      <div class="row"><span class="label">${t("dosage")}</span><span class="value">${esc(m.dosage)}</span></div>
      <div class="row"><span class="label">${t("foodTiming")}</span><span class="value">${m.food === "before" ? t("beforeFood") : t("afterFood")}</span></div>
      ${m.instructions ? `<p class="med-note">${esc(m.instructions)}</p>` : ""}
      <div class="refill-row">
        <span>💊 ${t("refillBody")} <strong>${fmtDate(m.refillDate)}</strong></span>
        <button class="btn small orange" data-action="refill" data-id="${m.id}">${t("refillReorder")}</button>
      </div>
    </div>`).join("");

  const listCard = card("currentMedicines", list || `<p class="muted-note">${t("none")}</p>`);
  if (!isDoctor()) return listCard; // patient: view + refill only

  const foodOpts = [
    { value: "before", label: t("beforeFood") },
    { value: "after", label: t("afterFood") },
  ];
  const medOpts = MEDICINES.map((m) => ({ value: L(m), label: L(m) }));
  return `
    ${listCard}
    <form data-form="medicine">
    ${card("addMedicine", `
      ${field("medicineName", select("name", medOpts, medOpts[0].value))}
      ${field("timing", input("timing", "7:00 AM, 7:00 PM"))}
      ${field("dosage", input("dosage", "15 ml with warm water"))}
      ${field("foodTiming", select("food", foodOpts, "before"))}
      ${field("specialInstructions", textarea("instructions", ""))}
      ${button("addMedicineReminder", { action: "add-medicine" })}
    `)}
    </form>`;
}

/* ---------------- 7. REMINDERS ---------------- */
export function reminders() {
  const d = getData();
  const byKind = (kind) => d.reminders.filter((r) => r.kind === kind);
  const rList = (arr) => arr.length
    ? arr.map((r) => row(r.time, r.label, true)).join("")
    : `<p class="muted-note">${t("none")}</p>`;

  return `
    ${card("enableNotifications", `
      <p class="muted-note" id="notif-status"></p>
      ${button("enableNotifications", { action: "enable-notif", cls: "light" })}
    `)}
    ${card("todaysReminders", rList(d.reminders))}
    ${CLINIC.features.kashayamReminders && byKind("kashayam").length ? card("kashayamReminders", rList(byKind("kashayam"))) : ""}
    ${CLINIC.features.externalApplication && byKind("external").length ? card("externalApplication", rList(byKind("external"))) : ""}
    ${card("appointmentReminder", d.appointments.map((a) =>
      row(fmtDate(a.date), a.time, true)).join("") || `<p class="muted-note">${t("none")}</p>`)}`;
}

/* ---------------- 8. CONTACTS ---------------- */
export function contacts() {
  const c = CLINIC.contact;
  const doc = CLINIC.doctors[0];
  const tel = (c.phone || "").replace(/[^\d+]/g, "");
  const wa = (c.whatsapp || "").replace(/[^\d]/g, "");
  return `
    ${card("contactsTitle", `
      ${row("doctorLabel", doc.name)}
      ${row("phoneLabel", c.phone)}
      ${c.email ? row("emailLabel", c.email) : ""}
      ${row("address", L(c.address))}
    `)}
    ${card("", `
      <div class="contact-actions">
        <a class="contact-btn" href="tel:${esc(tel)}"><span>📞</span>${t("call")}</a>
        <a class="contact-btn" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener"><span>💬</span>${t("whatsapp")}</a>
        <a class="contact-btn" href="mailto:${esc(c.email || "")}"><span>✉</span>${t("email")}</a>
        <a class="contact-btn" href="${esc(c.mapUrl)}" target="_blank" rel="noopener"><span>📍</span>${t("directions")}</a>
      </div>
    `)}
    ${card("patientReview", `
      <p class="muted-note">${t("reviewText")}</p>
      ${button("googleReview", { cls: "orange", action: "google-review" })}
    `)}`;
}

/* ---------------- 9. FOLLOW-UP -> APPOINTMENT ---------------- */
export function followup() {
  const d = getData();
  const f = d.followup;

  if (!isDoctor()) {
    return card("followupAppointment", `
      ${row("followupDate", fmtDate(f.date))}
      ${row("followupTime", f.time)}`);
  }

  const remOpts = [
    { value: "both", label: t("reminderBoth") },
    { value: "day", label: t("reminderDay") },
    { value: "hours", label: t("reminderHours") },
  ];
  return `
    <form data-form="followup">
    ${card("followupAppointment", `
      ${field("followupDate", input("date", f.date, "date"))}
      ${field("followupTime", input("time", f.time, "time"))}
      ${field("reminder", select("reminderMode", remOpts, f.reminderMode))}
      ${button("createAppointment", { action: "create-appointment" })}
    `)}
    </form>`;
}

/* ---------------- 10. REVIEW ---------------- */
export function review() {
  return card("patientReview", `
    <p class="muted-note">${t("reviewText")}</p>
    ${button("googleReview", { cls: "orange", action: "google-review" })}
    ${button("maybeLater", { cls: "light", action: "goto-dashboard" })}`);
}

/* Screen registry */
export const SCREENS = {
  dashboard: { render: dashboard, titleKey: "titleDashboard" },
  ads:       { render: ads,       titleKey: "adsTitle" },
  visit:     { render: visit,     titleKey: "newPatientVisit" },
  diagnosis: { render: diagnosis, titleKey: "diagnosis" },
  treatment: { render: treatment, titleKey: "treatmentPlan" },
  medicine:  { render: medicine,  titleKey: "medicinesIntake" },
  reminders: { render: reminders, titleKey: "remindersTitle" },
  contacts:  { render: contacts,  titleKey: "contactsTitle" },
  followup:  { render: followup,  titleKey: "followupAppointment" },
  review:    { render: review,    titleKey: "patientReview" },
};
