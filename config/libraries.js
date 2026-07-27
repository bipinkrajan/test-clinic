/* =============================================================
 * CLINICAL LIBRARIES  —  reusable, per-clinic reference lists
 * -------------------------------------------------------------
 * Doctors pick from these dropdowns instead of typing everything.
 * Extend / replace these for each clinic without touching app code.
 * Each entry carries en + ml so the whole app stays bilingual.
 * ============================================================= */

/* Common health issues (used by "Other health issues" chips).
 * "Other (Specify)" free-text is handled separately in the form. */
export const HEALTH_ISSUES = [
  { id: "back-pain", en: "Back Pain" },
  { id: "neck-pain", en: "Neck Pain" },
  { id: "knee-joint-pain", en: "Knee / Joint Pain" },
  { id: "shoulder-pain", en: "Shoulder Pain" },
  { id: "arthritis", en: "Arthritis" },
  { id: "acidity", en: "Acidity / Gastric" },
  { id: "indigestion", en: "Indigestion" },
  { id: "constipation", en: "Constipation" },
  { id: "ibs", en: "Irritable Bowel Syndrome (IBS)" },
  { id: "diabetes", en: "Diabetes" },
  { id: "hypertension", en: "High Blood Pressure (Hypertension)" },
  { id: "hypotension", en: "Low Blood Pressure (Hypotension)" },
  { id: "cholesterol", en: "High Cholesterol" },
  { id: "thyroid", en: "Thyroid Disorder" },
  { id: "asthma-allergy", en: "Asthma / Allergy" },
  { id: "sinusitis", en: "Sinusitis" },
  { id: "skin", en: "Skin Problem" },
  { id: "eczema-psoriasis", en: "Eczema / Psoriasis" },
  { id: "headache-migraine", en: "Headache / Migraine" },
  { id: "stress-anxiety", en: "Stress / Anxiety" },
  { id: "depression", en: "Depression" },
  { id: "insomnia", en: "Sleep Issue (Insomnia)" },
  { id: "obesity", en: "Weight / Obesity" },
  { id: "weight-loss", en: "Weight Loss" },
  { id: "weight-gain", en: "Weight Gain" },
  { id: "pcod", en: "PCOS / PCOD" },
  { id: "menstrual", en: "Menstrual Problems" },
  { id: "infertility", en: "Infertility" },
  { id: "urinary", en: "Urinary Problems" },
  { id: "kidney-stone", en: "Kidney Stone" },
  { id: "fatty-liver", en: "Fatty Liver" },
  { id: "piles", en: "Piles (Hemorrhoids)" },
  { id: "varicose", en: "Varicose Veins" },
  { id: "hair-fall", en: "Hair Fall" },
  { id: "fatigue", en: "General Weakness / Fatigue" },
  { id: "cervical-spondylosis", en: "Cervical Spondylosis" },
  { id: "lumbar-spondylosis", en: "Lumbar Spondylosis" },
  { id: "sciatica", en: "Sciatica" },
  { id: "frozen-shoulder", en: "Frozen Shoulder" },
  { id: "migraine", en: "Migraine" },
];

/* Treatment library */
export const TREATMENTS = [
  { id: "backcare-30", en: "Back Pain Ayurveda Care Plan", ml: "നടുവേദന ആയുര്‍വേദ പദ്ധതി", defaultDays: 30 },
  { id: "abhyangam", en: "Abhyangam (Oil Massage)", ml: "അഭ്യംഗം (എണ്ണ തിരുമ്മല്‍)", defaultDays: 14 },
  { id: "kizhi", en: "Kizhi (Herbal Bolus)", ml: "കിഴി", defaultDays: 7 },
  { id: "panchakarma", en: "Panchakarma Detox", ml: "പഞ്ചകര്‍മ്മ", defaultDays: 21 },
  { id: "nasyam", en: "Nasyam", ml: "നസ്യം", defaultDays: 7 },
  { id: "shirodhara", en: "Shirodhara", ml: "ശിരോധാര", defaultDays: 7 },
];

/* Medicine library */
export const MEDICINES = [
  { id: "kashayam", en: "Kashayam", ml: "കഷായം", form: "liquid", defaultDose: "15 ml with warm water" },
  { id: "gulika", en: "Gulika (Tablet)", ml: "ഗുളിക", form: "tablet", defaultDose: "1 tablet" },
  { id: "choornam", en: "Choornam (Powder)", ml: "ചൂര്‍ണം", form: "powder", defaultDose: "1 tsp" },
  { id: "lehyam", en: "Lehyam", ml: "ലേഹ്യം", form: "paste", defaultDose: "1 tsp" },
  { id: "arishtam", en: "Arishtam", ml: "അരിഷ്ടം", form: "liquid", defaultDose: "15 ml after food" },
  { id: "thailam", en: "Thailam (Oil)", ml: "തൈലം", form: "external", defaultDose: "Apply on affected area" },
];

/* Pathya (foods allowed) / Apathya (foods to avoid) library */
export const PATHYA = [
  { id: "warm-food", en: "Warm freshly cooked food", ml: "ചൂടുള്ള പുതിയ ഭക്ഷണം" },
  { id: "kanji", en: "Kanji (rice gruel)", ml: "കഞ്ഞി" },
  { id: "veg", en: "Cooked vegetables", ml: "വേവിച്ച പച്ചക്കറികള്‍" },
  { id: "cumin-water", en: "Cumin / ginger water", ml: "ജീരക / ഇഞ്ചി വെള്ളം" },
  { id: "buttermilk", en: "Fresh buttermilk", ml: "മോര്" },
];

export const APATHYA = [
  { id: "cold", en: "Cold food & drinks", ml: "തണുത്ത ഭക്ഷണം" },
  { id: "curd-night", en: "Curd at night", ml: "രാത്രി തൈര്" },
  { id: "fried", en: "Fried & oily food", ml: "എണ്ണയില്‍ വറുത്തത്" },
  { id: "bakery", en: "Bakery items", ml: "ബേക്കറി സാധനങ്ങള്‍" },
  { id: "cold-drinks", en: "Aerated / cold drinks", ml: "ശീതളപാനീയങ്ങള്‍" },
  { id: "maida", en: "Maida / refined flour", ml: "മൈദ" },
];

/* Doctor advice library (do / don't) */
export const ADVICE = {
  do: [
    { id: "walk", en: "Light walking daily", ml: "ദിവസവും ലഘു നടത്തം" },
    { id: "sleep-early", en: "Sleep early, wake early", ml: "നേരത്തെ ഉറങ്ങുക, നേരത്തെ എഴുന്നേല്‍ക്കുക" },
    { id: "warm-water", en: "Drink warm water", ml: "ചൂടുവെള്ളം കുടിക്കുക" },
    { id: "posture", en: "Maintain good posture", ml: "ശരിയായ ഇരിപ്പ് നിലനിര്‍ത്തുക" },
  ],
  dont: [
    { id: "no-lift", en: "Do not lift heavy weights", ml: "ഭാരം ഉയര്‍ത്തരുത്" },
    { id: "no-sit", en: "Avoid long sitting", ml: "ഏറെനേരം ഇരിക്കരുത്" },
    { id: "no-late", en: "Avoid sleeping late", ml: "വൈകി ഉറങ്ങരുത്" },
    { id: "no-cold", en: "Avoid cold exposure", ml: "തണുപ്പ് ഒഴിവാക്കുക" },
  ],
};
