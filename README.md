# Ayurveda Clinic — Patient Care PWA (Master Template)

A mobile-first, installable Progressive Web App for Ayurveda clinics: OP-number patient
records, doctor-only diagnosis, treatment plans, medicine + kashayam/external reminders,
pathya/apathya, doctor advice, follow-ups, refill reminders, Google review, and an
English / Malayalam switcher. Plain HTML + CSS + ES modules — no build step. Data is served
per-clinic from that clinic's own Supabase project.

This repo is the **reusable master template**. Each customer is a clone of it with their own
config, their own Supabase project, and their own domain.

## Re-brand for a new clinic — edit only these
| To change | Edit | Field |
|---|---|---|
| Supabase project (this clinic's DB) | `config/supabase.config.js` | `url`, `anonKey` |
| Clinic identity, contact, domain | `config/clinic.config.js` | `id`, `name`, `brand`, `contact`, `siteUrl` |
| OP number format | `config/clinic.config.js` | `opNumber.prefix` |
| Theme colours | `config/clinic.config.js` | `theme.*` |
| Google review link | `config/clinic.config.js` | `googleReviewUrl` |
| Features on/off | `config/clinic.config.js` | `features.*` |
| 3-day demo trial | `config/clinic.config.js` | `trial.active`, `trial.expiresOn` |
| Clinical libraries | `config/libraries.js` | `TREATMENTS`, `MEDICINES`, `HEALTH_ISSUES`, `PATHYA`, `APATHYA`, `ADVICE` |
| Logo | replace `assets/logo.svg` + icons | — |
| App title / install name | `index.html` `<title>`, `manifest.json` | `name`, `short_name` |

## What's new in this template vs. the base app
- **3-day demo trial** (`config/clinic.config.js` → `trial`). When active and expired, the
  patient app shows a "trial ended — contact us" screen. Logic in `js/app.js` + `trialExpired()`.
- **QR posters** in the admin console:
  - Branding tab → **Clinic QR Poster** (clinic name + QR to the app).
  - Patient page → **Patient QR Poster** (QR opens the app with that patient's OP pre-filled).
  - The patient app reads `?op=` from the URL to pre-fill the OP field (the PIN is never in a link).
  - QR library vendored offline at `assets/vendor/qrcode-generator.js` (MIT).
- **Multi-select treatment plan** in the admin (pick several treatments; ＋ adds new types).

## Run locally
Serve over HTTP (service workers need it):
```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Onboarding a customer
See **ONBOARDING.md** (worked example: Aroma Ayurveda Clinic), and record each customer in
the Master Registry spreadsheet. The database is created by running `master-schema.sql` in
each new Supabase project.
