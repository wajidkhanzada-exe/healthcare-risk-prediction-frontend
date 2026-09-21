# Healthcare Risk Prediction — Frontend

A React application that lets a patient log in, upload lab reports or fill
in their own health information, and receive an AI-generated risk report
for Diabetes, Heart Disease, and Chronic Kidney Disease.

This is the client for the [Flask backend](#) (separate repository), which
performs the actual ML predictions and generates the explanations.

---

## Overview

- Passwordless authentication (email + one-time code) via Supabase Auth.
- A single, deduplicated intake form: each piece of information (age,
  gender, blood pressure, etc.) is asked once and automatically mapped to
  whichever disease models need it, instead of repeating the same
  question three times.
- Drag-and-drop upload of lab report PDFs/images. Each uploaded file is
  sent to the backend for extraction, and any fields it finds are merged
  into the form. Removing an uploaded file also clears exactly the fields
  that file contributed (unless a later edit or upload has since
  overwritten them).
- Submitting generates a full report: risk probability, category
  (Low/Medium/High), a plain-language explanation, and personalized
  lifestyle recommendations grounded in official health guidelines.
- Works correctly with partial information — the backend imputes
  missing non-critical fields and clearly reports which fields in the
  result were estimated versus provided by the patient.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React + Vite |
| Styling | Tailwind CSS |
| Auth | Supabase (`@supabase/supabase-js`), email OTP |
| HTTP client | Axios |

## Project Structure

```
frontend/
├── src/
│   ├── App.jsx              # Main app: field catalog, form, upload panel, results
│   ├── Auth.jsx              # Email + OTP login flow
│   ├── supabaseClient.js     # Supabase client initialization
│   └── index.css
├── .env                       # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (not committed)
├── vite.config.js
└── package.json
```

## Getting Started

### Prerequisites
- Node.js (LTS)
- A Supabase project with Email OTP configured (see backend repo notes)
- The backend API running (locally or deployed)

### Setup

```bash
npm install
```

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> The Supabase **anon** key is safe to expose in the frontend by design.
> Never put the `service_role` key here — that belongs only in the
> backend's environment.

### Run

```bash
npm run dev
```

The app runs at `http://localhost:5173` by default and expects the
backend at `http://127.0.0.1:5000` (configurable via `API_BASE` in
`App.jsx`).

## Authentication Flow

1. User enters their email and requests a code (`supabase.auth.signInWithOtp`).
2. Supabase emails a one-time numeric code.
3. User enters the code (`supabase.auth.verifyOtp`), which returns a
   session containing an access token.
4. That token is attached as a `Bearer` header on every request to the
   backend's prediction/extraction endpoints.
5. Session state is kept in sync across page reloads and sign-out via
   `supabase.auth.onAuthStateChange`.

## The Field Catalog

All patient-facing fields are defined once in a single `FIELD_CATALOG`
array in `App.jsx`, grouped by medical category (Personal Information,
Body Measurements, Blood Pressure, Blood Sugar, Cholesterol, Kidney
Function Labs, Symptoms, Medical History). Each field declares:

- Its input type, valid range, and whether it's required.
- A `targets` list describing which disease(s) it feeds into and any
  unit/format conversion needed (e.g. converting a fasting blood sugar
  reading into the binary flag the heart model expects).

This means adding, removing, or relabeling a field only requires editing
one entry, and it is guaranteed to reach every relevant disease payload
correctly and consistently.

## Report Upload & Extraction

- Supports multiple files, click-to-browse or drag-and-drop.
- Each file shows a live status: processing, N fields extracted, no
  fields found, or failed.
- A `fieldOwners` map tracks which uploaded file most recently supplied
  each field's value, so removing a file only clears the fields it is
  still responsible for — fields a user has since edited by hand, or
  that a later upload has overwritten, are left untouched.

## Result Display

Each disease's card shows:

- Risk probability and category, color-coded (green/amber/red).
- Any out-of-training-range warnings.
- Data completeness and which fields were estimated, if any.
- The Gemini-generated explanation and recommendations, with the source
  document(s) cited.
- Any disease-specific reliability disclaimer (e.g. for CKD).

A summary banner highlights the single highest-risk condition, and a
persistent footer note reminds the user this is not a medical diagnosis.

## Known Limitations

- The mapping of `Gender` to the CKD model's numeric encoding
  (Male → 1, Female → 0) is an assumption based on scikit-learn's default
  label encoding and has not been independently verified against the
  original training notebook.
- Free-tier Gemini quotas can cause the report generation step to be
  temporarily unavailable; the backend retries automatically, but a
  request may still occasionally fail during periods of high demand.
