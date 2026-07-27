/* =============================================================
 * CLINIC CONFIG  —  ★ THE ONE FILE YOU EDIT PER CUSTOMER ★
 * -------------------------------------------------------------
 * This is the MASTER TEMPLATE. To onboard a new clinic:
 *   1. Copy this whole repo into a new GitHub repo.
 *   2. Edit the values below (identity, contact, theme, features).
 *   3. Edit config/supabase.config.js with that clinic's Supabase URL + anon key.
 *   4. For a 3-DAY DEMO: set trial.active = true and trial.expiresOn = a date.
 *      For a real customer: leave trial.active = false.
 *   5. Deploy (GitHub Pages) and point the clinic's domain at it.
 *   6. Record it in the Master Registry spreadsheet.
 * Nothing clinic-specific is hard-coded anywhere else in the app.
 * ============================================================= */

export const CLINIC = {
  /* ---- Identity ----  (slug must be unique per clinic) */
  id: "test-clinic",                  // MUST match the clinics.slug in Supabase
  name: {
    en: "Test Clinic",
    ml: "Test Clinic",
  },
  brand: {
    en: "Test Clinic",
    ml: "Test Clinic",
  },
  tagline: {
    en: "Ayurvedic Clinic",
    ml: "ആയുര്‍വേദിക് ക്ലിനിക്",
  },

  /* ---- Logo (path relative to app root) ---- */
  logo: "assets/logo.svg",            // replace assets/logo.svg + regenerate icons

  /* ---- Doctors ---- */
  doctors: [
    { id: "dr-1", name: "Doctor 1", specialty: "Ayurveda Physician" },
  ],
  defaultDoctorId: "dr-1",

  /* ---- OP Number format ----  {PREFIX}-{YEAR}-{SEQ} */
  opNumber: {
    prefix: "OP",                     // e.g. "AR-OP"
    seqPadding: 5,                    // 00125
    example: "OP-2026-00001",
  },

  /* ---- Contact ---- */
  contact: {
    phone: "+91 00000 00000",
    whatsapp: "+91 00000 00000",
    email: "clinic@example.com",
    address: {
      en: "REPLACE Address",
      ml: "REPLACE Address (ML)",
    },
    mapUrl: "https://maps.google.com/?q=REPLACE+Clinic+Name",
  },

  /* ---- Public site URL (this clinic's own domain) ----
   * Used for the QR poster link and Ads share links. No trailing slash. */
  siteUrl: "https://REPLACE-domain.com",

  /* ---- Google Review link ----
   * From the clinic's Google Business Profile → "Get more reviews". */
  googleReviewUrl: "https://search.google.com/local/writereview?placeid=REPLACE_WITH_PLACE_ID",

  /* ---- Theme colours (also mirrored as CSS variables) ---- */
  theme: {
    green: "#245b35",
    green2: "#3f7a45",
    light: "#f4f8ef",
    cream: "#fff9ed",
    orange: "#d9822b",
    text: "#1d2b1f",
    muted: "#697566",
    border: "#dce8d5",
  },

  /* ---- Feature flags (turn modules on/off per clinic) ----
   * To change a customer's features: edit here and commit. */
  features: {
    kashayamReminders: true,
    externalApplication: true,
    medicineRefill: true,
    googleReview: true,
    languages: ["en", "ml"],
  },

  /* ---- Trial / demo control ----
   * Real customer  -> active: false (app never locks).
   * 3-day demo     -> active: true, expiresOn: "YYYY-MM-DD" (local date).
   * On/after expiresOn the patient app shows a "trial ended" screen. */
  trial: {
    active: false,
    expiresOn: null,                  // e.g. "2026-08-01"
    contactEmail: "you@yourcompany.com",
    contactPhone: "+91 00000 00000",
  },
};

/* Apply theme colours to CSS variables at runtime */
export function applyTheme(theme = CLINIC.theme) {
  const root = document.documentElement.style;
  root.setProperty("--green", theme.green);
  root.setProperty("--green2", theme.green2);
  root.setProperty("--light", theme.light);
  root.setProperty("--cream", theme.cream);
  root.setProperty("--orange", theme.orange);
  root.setProperty("--text", theme.text);
  root.setProperty("--muted", theme.muted);
  root.setProperty("--border", theme.border);
}

/* Trial helper: returns true when a demo trial has expired.
 * Used by the patient app boot to gate access. */
export function trialExpired(clinic = CLINIC) {
  const tr = clinic.trial;
  if (!tr || !tr.active || !tr.expiresOn) return false;
  const end = new Date(tr.expiresOn + "T23:59:59");
  return Number.isFinite(end.getTime()) && Date.now() > end.getTime();
}
