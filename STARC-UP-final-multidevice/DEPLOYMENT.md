# STARC-UP final multi-device deployment

This build keeps the existing frontend/UI but moves shared event state to a secure Vercel API backed by Firebase Realtime Database.

## 1. Vercel Root Directory

If the repository contains the `starcup` folder, set Vercel **Project Settings → Build and Deployment → Root Directory** to:

`STARC-UP-corrected/starcup`

(or simply `starcup` if that is the repository root).

Do not remove the `api/` folder or the `img/` folder.

## 2. Google Sheets

Create/keep three Google Form response sheets:

- Registration sheet
- Round 1 submission response sheet
- Round 2 submission response sheet

Make each response sheet readable by the server. For the simplest event setup, use Google Sheets **Share → General access → Anyone with the link → Viewer**.

Set these Vercel Production environment variables:

- `REGISTRATION_SHEET_URL`
- `ROUND1_SHEET_URL`
- `ROUND2_SHEET_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_SHA256`
- `APP_SESSION_SECRET` (recommended: a long random secret; keep it private)

The registration name header should contain `name`. The login service reads the sheet on every login, so new registrations are picked up without a Vercel redeploy.

Participant password rule remains:

`first real word, first 4 letters, uppercase + @1234`

Example: `Dharani S` → `DHAR@1234`.

## 3. Firebase Realtime Database — shared state for all computers

Create a Firebase project at https://console.firebase.google.com/.

### A. Create Realtime Database

Firebase Console → **Build → Realtime Database → Create Database**.

Choose a nearby region. For this architecture, database rules can remain locked down because the Vercel server authenticates using a Google service account. Do not put a Firebase service-account private key in the frontend.

### B. Create a service account

Firebase Console → **Project settings → Service accounts → Firebase Admin SDK → Generate new private key**.

Download the JSON file once. Do not upload it to GitHub or put it inside the website ZIP.

From that JSON, copy these values into Vercel Production variables:

- `FIREBASE_PROJECT_ID` = `project_id`
- `FIREBASE_CLIENT_EMAIL` = `client_email`
- `FIREBASE_PRIVATE_KEY` = `private_key` (keep the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines)
- `FIREBASE_DATABASE_URL` = your Realtime Database URL, for example `https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com`

The backend converts escaped `\\n` sequences in `FIREBASE_PRIVATE_KEY` automatically.

### C. Recommended database rules

Because only the Vercel backend should access the database, use locked rules:

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

The server uses a service-account OAuth access token, so it can still access the database as an administrator.

## 4. Admin credentials

The backend expects the SHA-256 hash of `ADMIN_USERNAME:ADMIN_PASSWORD`.

For the sample credentials:

- Username: `admin`
- Password: `STARC@2026`

`ADMIN_PASSWORD_SHA256` is:

`2672dc50892882306b909f8c442dcd2af4b89633d29e3d3594cad493603d62fa`

Do not put the normal password in `ADMIN_PASSWORD_SHA256`.

## 5. Redeploy after environment variables

After adding/changing Vercel environment variables:

**Deployments → latest Production deployment → ⋯ → Redeploy**.

Environment variables are injected into new deployments.

## 6. Multi-device behavior

The admin controls are no longer stored only in browser `localStorage`.

Admin actions are written to:

`/api/state?resource=ctl`

Participant state is stored under:

`/api/state?resource=mem&key=...`

Every logged-in browser polls the shared state every 2 seconds.

This supports one admin and up to 100 normal participant browsers without relying on browser-to-browser communication.

## 7. AI tool images

Round 1 shows ChatGPT, Gemini, Claude and Figure Labs. Round 2 shows Gemini only, as required by the existing event instructions.

The tool images are local files under `img/` and are referenced with absolute `/img/...` paths. Keep that folder in the deployment root.

If an image is missing, the portal automatically displays the tool's letter fallback instead of a broken image.

## 8. Final pre-event test

After deployment:

1. Open the deployed URL on the admin computer.
2. Admin login: `admin` / `STARC@2026`.
3. Run **Check Links**.
4. Confirm `Shared event database` is green.
5. Open the event.
6. Open the participant login page on a second computer.
7. Register a test name in the Google Form and wait for the response row to appear.
8. Log in using the generated password.
9. On the admin computer, open Round 1.
10. Confirm the second computer sees Round 1 open within a few seconds.
11. Repeat with Round 2 after shortlisting.
12. Run ML evaluation for both rounds and verify the live response counts.

Do this full test before the paid event.
