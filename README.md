# Healthcare Risk Prediction — Frontend

A React interface for the Healthcare Risk Prediction system: a single, category-organized intake form (not three separate per-disease forms), drag-and-drop lab report upload with live field extraction, email-OTP authentication, a results view that surfaces model probability, SHAP-based reasoning, and an AI-generated explanation together, and a browsable history of past assessments.

**Live App:** https://healthriskkk-ai.vercel.app/
**Backend repo:** https://github.com/wajidkhanzada-exe/healthcare-risk-prediction-backend
**Backend API:** https://healthcare-risk-prediction-backend.vercel.app/

---

## Overview

The backend runs three independent disease models (Diabetes, Heart Disease, CKD), each trained on its own dataset with its own feature set. A literal translation of that into UI would be three separate forms — which is what this started as, and what it deliberately isn't anymore.

This frontend's core job is to hide that internal structure from the person filling it in: one form, organized the way a patient actually thinks about their own health data (personal info, vitals, blood sugar, cholesterol, kidney labs, symptoms, history), where an answer given once is silently routed to every disease model that needs it.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React (Vite) |
| Styling | Tailwind CSS |
| HTTP | Axios |
| Auth | Supabase Auth (email OTP, no passwords) |
| Data | Supabase Database (assessment history) |
| Hosting | Vercel |

---

## Key UI/UX Engineering Decisions

**1. One form, not three.**
A `FIELD_CATALOG` — a single array of field definitions grouped by medical category — is the one source of truth for the entire form. Each field declares its own `targets`: which disease payload(s) it feeds, and any transform needed to get there (e.g. `Male`/`Female` becomes `M`/`F` for the Heart model, a raw Fasting Blood Sugar reading becomes a `>120` boolean flag for the Heart model but stays a raw number for CKD). Adding, removing, or re-labeling a question is a one-line change in the catalog, not an edit in three different form sections.

**2. Merging fields is not automatic — each merge is a judgment call.**
Age, Gender, Smoking History, BMI, Systolic BP, HbA1c, and Total Cholesterol are genuinely the same measurement across the diseases that use them, so they're asked once. Diabetes's random blood glucose reading and the fasting blood sugar reading used by Heart/CKD are deliberately **not** merged — they're clinically different measurements, and collapsing them would silently corrupt the data. Where a merge target's encoding was uncertain (CKD's `Gender` column has no published data dictionary), that's called out in a code comment rather than quietly assumed correct — see the backend README's Limitations section.

**3. The form never blocks submission.**
An earlier version hard-required ~15 fields client-side before allowing submit. That was removed. The backend already imputes missing values and marks a disease as "skipped" with a stated reason when it truly can't produce a reliable result — client-side gatekeeping was duplicating (and fighting) logic the backend already handles correctly. The only remaining client-side guard is refusing a completely empty submission.

**4. Multi-file upload is additive, not destructive.**
A patient rarely has one report with everything on it — a CBC, a lipid panel, and a kidney panel are normally separate documents. The upload zone (drag-and-drop or click-to-browse) accepts multiple files, extracts each independently via the backend's Gemini-based extractor, and merges results into the form without erasing what's already there. Removing an uploaded file removes only the fields *that file* contributed, tracked per-file rather than as one undifferentiated blob of extracted data.

**5. The results view shows the model's reasoning, not just its output.**
Each disease's card shows probability and risk category, but also a **SHAP-based "Top Contributing Factors" list** (which fields pushed the risk up or down, and by how much, rendered as small directional bars) alongside the Gemini-generated plain-language explanation. Showing both is intentional: the SHAP factors are the model's actual reasoning; the Gemini text is a readable narrative around it. Neither is presented as a substitute for the other.

**6. Data completeness is surfaced, not hidden.**
When a result was partly estimated, the card shows `data_completeness` and which specific fields were imputed. A confident-looking percentage with no caveats would be misleading for a system that's explicitly designed to work on partial data.

**7. The form resets on success, not on failure.**
After a successful submission, all fields and uploaded files clear so the next assessment starts clean — but only on success. A failed request (network error, validation error) never costs the user their entered data.

**8. Assessment history is a first-class feature, not an afterthought.**
Every completed report is saved (tied to the authenticated user via Supabase) and browsable from a "History" tab — patient name, age, timestamp, and highest-risk summary at a glance, with a full report view and a Print/Save PDF option per entry. This turns the app from a one-off calculator into something a patient can actually track over time.

---

## Project Structure

```
src/
  App.jsx         # FIELD_CATALOG, payload builder, upload zone, form, results view
  Auth.jsx          # Supabase email-OTP sign-in
  supabaseClient.js  # Supabase client init (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
```

---

## Setup

```bash
npm install
```

Create a `.env` file in the project root:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Vite only reads `.env` at dev-server startup. After creating or editing it, restart `npm run dev` — otherwise the values load as `undefined`.

Run locally:
```bash
npm run dev
```

By default the app calls the backend at `http://127.0.0.1:5000`. For local development, run the [backend](https://github.com/wajidkhanzada-exe/healthcare-risk-prediction-backend) alongside this, or point `API_BASE` in `App.jsx` at the deployed backend.

---

## Authentication

Sign-in uses Supabase's email OTP flow instead of a traditional password: the user enters their email, receives a one-time code, and enters it to unlock the assessment form. Note that Supabase's OTP code length is a per-project mailer setting (`GOTRUE_MAILER_OTP_LENGTH`) and isn't guaranteed to be 6 digits — this project's default sends 8-digit codes, so the OTP input isn't hardcoded to a specific length.

---

## Disclaimer

This application produces probabilistic risk estimates from models trained on public and synthetic datasets. It is not a diagnostic tool and does not replace professional medical advice — this is shown to the user on every report.
