/* =============================================================
 * COMPONENTS — small reusable UI builders (return HTML strings)
 * Keeps screens declarative and consistent.
 * ============================================================= */
import { t } from "./i18n.js";

/* Escape user text for safe HTML injection */
export function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export const card = (titleKey, bodyHtml, opts = {}) => `
  <div class="card ${opts.cls || ""}">
    ${titleKey ? `<div class="card-title">${opts.rawTitle ? titleKey : t(titleKey)}</div>` : ""}
    ${bodyHtml}
  </div>`;

export const row = (labelKey, value, raw = false) => `
  <div class="row"><span class="label">${raw ? labelKey : t(labelKey)}</span>
  <span class="value">${esc(value)}</span></div>`;

export const pill = (text, tone = "") => `<span class="pill ${tone}">${esc(text)}</span>`;

export const field = (labelKey, inputHtml) => `
  <div class="field"><label>${t(labelKey)}</label>${inputHtml}</div>`;

export const input = (name, value = "", type = "text") =>
  `<input name="${name}" type="${type}" value="${esc(value)}">`;

export const textarea = (name, value = "") =>
  `<textarea name="${name}">${esc(value)}</textarea>`;

export const select = (name, options, selected) => `
  <select name="${name}">
    ${options.map((o) => `<option value="${esc(o.value)}" ${o.value === selected ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
  </select>`;

export const button = (labelKey, opts = {}) =>
  `<button class="btn ${opts.cls || ""}" ${opts.attrs || ""} ${opts.action ? `data-action="${opts.action}"` : ""}>${opts.raw ? labelKey : t(labelKey)}</button>`;

/* Multi-select chips list (for other issues / pathya / advice) */
export const chipSelect = (name, options, selectedIds = []) => `
  <div class="chips" data-chipselect="${name}">
    ${options.map((o) => `
      <button type="button" class="chip ${selectedIds.includes(o.id) ? "on" : ""}" data-id="${o.id}">${esc(o.label)}</button>
    `).join("")}
  </div>`;

/* Doctor-only banner */
export const doctorOnly = () => `<div class="doctor-only">${t("doctorOnly")}</div>`;

/* Toast helper */
export function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 1800);
}
