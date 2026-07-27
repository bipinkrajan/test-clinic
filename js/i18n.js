/* Tiny i18n engine — no dependencies.
 * t(key)      -> translated string in current language
 * L(obj)      -> pick .en/.ml from a bilingual object (used for library data)
 * setLang()   -> switch language, persist, re-render
 * onLangChange-> subscribe (screens re-render on switch) */
import { STRINGS } from "./i18n.strings.js";

const LS_KEY = "ayushree.lang";
let lang = localStorage.getItem(LS_KEY) || "en";
const listeners = new Set();

export function getLang() { return lang; }

export function t(key) {
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
}

/* Pick localized value from a { en, ml } object */
export function L(obj) {
  if (obj == null) return "";
  if (typeof obj === "string") return obj;
  return obj[lang] || obj.en || "";
}

export function setLang(next) {
  if (next === lang) return;
  lang = next;
  localStorage.setItem(LS_KEY, lang);
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* Translate any static markup that uses data-i18n attributes */
export function applyStaticI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
}
