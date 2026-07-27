# Customer Onboarding Runbook — Ayurveda Clinic SaaS

**Model:** template & clone. Each customer = their own GitHub repo + their own free Supabase
project + their own domain. You (super admin) keep the record of all of them.

Worked example throughout: onboarding **Aroma Ayurveda Clinic** (`aroma-clinic`, domain `aromaclinic.com`).

> ⚠️ **Ayu:sree is never touched.** You are creating a brand-new repo and a brand-new Supabase
> project. Ayu:sree's live site and database stay exactly as they are.

---

## A. One-time: prepare the master template
Do this once. You keep a clean copy of `ayurveda-master-template` (the folder in this kit).

1. Create a GitHub repo to hold the pristine template, e.g. `ayurveda-master-template`, and upload the template folder's contents. Never point a domain at this — it's just the source you copy.
2. Keep the **master schema SQL** file (`master-schema.sql`) alongside it. *(This file is produced once you send me your current Ayu:sree Supabase schema — see the note at the end.)*

---

## B. Onboard a NEW PAYING CUSTOMER (≈15–20 min)

### Step 1 — Create their Supabase project
1. Go to supabase.com → **New project** (free tier is fine — one project per clinic).
2. Name it after the clinic, e.g. `aroma-clinic`. Choose a region near the clinic. Set a strong database password and **save it in the clinic's own credentials note** (not the shared registry).
3. Wait for the project to finish provisioning.

### Step 2 — Build their database
1. In the project: **SQL Editor → New query**.
2. Paste the entire contents of `master-schema.sql` and click **Run**.
3. This creates all tables, security rules, and functions — an empty copy of the Ayu:sree structure.

### Step 3 — Create the MAIN admin login (you do this)
1. Supabase → **Authentication → Users → Add user**: the clinic admin's email + a password, tick "Auto Confirm".
2. Copy that user's **UUID**.
3. SQL Editor → run (replace the UUID and the slug from your seed):
   ```sql
   insert into public.staff (auth_user_id, clinic_id, name, role)
   select '<PASTE_AUTH_USER_UUID>', id, 'Clinic Admin', 'admin'
   from public.clinics where slug = 'aroma-clinic';
   ```
4. Hand over the login. **The clinic's admin then adds all other staff** from the admin console
   (Staff tab → Add staff) — you only ever create the first admin.

### Step 3b — Deploy the `manage-staff` Edge Function
Included at `supabase/functions/manage-staff/index.ts` (dynamic CORS — no edits).
1. Supabase → **Edge Functions → Create a new function** → name it exactly **`manage-staff`**.
2. Paste the file's contents → **Deploy**. No secrets to set (Supabase injects them).

### Step 4 — Copy the app into a new GitHub repo
1. On GitHub: **New repository**, e.g. `aroma-clinic` (public).
2. Upload the **entire `ayurveda-master-template`** folder contents into it (Add file → Upload files → commit).

### Step 5 — Configure the two files
Edit only these two files in the new repo:

1. **`config/supabase.config.js`** → paste this clinic's Supabase **Project URL** and **anon public key** (Supabase → Project Settings → API).
2. **`config/clinic.config.js`** → set:
   - `id` → `"aroma-clinic"`
   - `name`, `brand`, `tagline` → Aroma's names (EN + ML)
   - `doctors`, `contact`, `opNumber.prefix` (e.g. `"AR-OP"`)
   - `siteUrl` → `"https://aromaclinic.com"`
   - `googleReviewUrl` → Aroma's Google review link
   - `theme.*` → their brand colours (optional)
   - `features.*` → turn modules on/off for this clinic
   - Leave `trial.active = false` (real customer, never locks)
3. Optional branding: replace `assets/logo.svg` and regenerate the icons; update `index.html` `<title>` and `manifest.json` name.
4. Commit.

### Step 6 — Turn on hosting + their domain
1. Repo → **Settings → Pages** → Source = `main` branch → Save. The site goes live at `https://<you>.github.io/aroma-clinic/`.
2. Add their custom domain: put a `CNAME` file containing `aromaclinic.com` in the repo root (or set it in Settings → Pages → Custom domain).
3. In the clinic's DNS (GoDaddy etc.): point the domain to GitHub Pages
   (A records → 185.199.108.153 / 109.153 / 110.153 / 111.153, and CNAME `www` → `<you>.github.io`).
4. Wait for DNS + HTTPS to go green.

### Step 7 — Record it
Add a row to the **Master Registry** spreadsheet: clinic name, slug, repo URL, Supabase project URL, admin email, domain, enabled features, status = Live. **No secret keys in the registry.**

### Step 8 — Hand over
1. Log in to `aromaclinic.com/admin/` with the admin login.
2. Add the first patients, set their PINs.
3. Print QR posters (Section D) for reception.

---

## C. Set up a 3-DAY DEMO for a prospect
Same as Section B, but two differences — and you can skip the custom domain.

1. Do Steps 1–5 above (own Supabase project + own repo). Name them `demo-<prospect>`.
2. In **`config/clinic.config.js`** set the trial block:
   ```js
   trial: {
     active: true,
     expiresOn: "2026-08-01",          // 3 days from when you send it
     contactEmail: "you@yourcompany.com",
     contactPhone: "+91 00000 00000",
   }
   ```
3. Seed a little sample data + a demo patient login (e.g. OP `DEMO-001` / PIN `1234`) so they can explore immediately.
4. Deploy on the free GitHub Pages URL (no custom domain needed) and send the link + demo login.
5. On/after `expiresOn`, the patient app automatically shows a **"Your 3-day trial has ended — contact us"** screen. To reopen, just change `expiresOn` to a later date and commit; to convert to a paying customer, set `trial.active = false` and follow Section B Steps 6–8.

---

## D. Patient QR posters (built into every clinic's admin)
Two posters, both open the clinic's patient app when scanned. The PIN is **never** in the QR.

- **Clinic poster (reception):** Admin → **Branding** tab → **🖨️ Clinic QR Poster**. Shows clinic name + QR that opens the app. Print or Save as PDF.
- **Per-patient poster/card:** open a patient → **Login PIN** card → **🖨️ Patient QR Poster**. The QR opens the app with that patient's OP number pre-filled — they just type their PIN.

The QR always points at the clinic's real domain (it reads the live address), so posters printed from `aromaclinic.com/admin/` link to `aromaclinic.com`.

---

## E. Change a customer's features later
Feature flags live in code (per your decision). To change them for a customer:
1. Open that customer's repo → `config/clinic.config.js` → `features.*`.
2. Flip the flag → commit. GitHub Pages redeploys. Done.

---

## F. Super-admin: "enter any account"
You hold every customer's logins in your records. To modify a customer:
- **App/features:** edit their GitHub repo (above).
- **Data / patients / staff:** log in to their `/admin/` console, or their Supabase project.
Keep GitHub + Supabase + admin logins per customer in each customer's own private credentials note; keep only non-secret pointers in the shared Master Registry.

---

## ✅ master-schema.sql — ready
`master-schema.sql` is in this folder (built from the live Ayu:sree schema). Section B **Step 2**
is a single paste-and-run: open the new project's SQL Editor, paste the whole file, Run. Then
edit the SEED block's 3 values and create the first admin per the comments at the bottom of the file.

**Staff management is included** — the `manage-staff` Edge Function ships at
`supabase/functions/manage-staff/index.ts`. Deploy it per clinic (Step 3b) and the clinic's admin
adds/removes all other staff from the Staff tab. You only ever create the first admin (Step 3).
