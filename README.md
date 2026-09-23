# z3d's CS Enhancer — iPhone PWA v0.1.0

This is the no-Mac iPhone version.

## What this version does
- Installs from Safari using **Add to Home Screen**
- FACEIT Data API sync
- Local match-ID deduplication
- Dashboard, Coach, Refrag Training, Matches, Trends, Schedule and Settings
- Monday/Wednesday 7 PM team sessions preconfigured
- Saturday/Sunday can be enabled each week
- Team-night planning: warm-up → team training → 1–2 team FACEIT games → reset → solo pugs → short corrective work
- Local-only match history/settings on the device
- Offline app shell after first load

## Important: FACEIT key type
This web app is frontend JavaScript. Use a **FACEIT client-side API key**.
Do NOT paste a server-side secret into a public/browser app.

FACEIT documents client-side keys specifically for frontend JavaScript and distributed apps.

## Upload to your existing GitHub Pages site

You already have `z3dcs.github.io`.

Upload these files/folders to the root of that repository:
- index.html
- styles.css
- app.js
- manifest.webmanifest
- sw.js
- assets/

If GitHub Pages is configured for `main` + `/ (root)`, committing these files will publish the app.

## Install on iPhone

1. Open your GitHub Pages URL in **Safari** on the iPhone.
2. Tap the **Share** button.
3. Choose **Add to Home Screen**.
4. Make sure **Open as Web App** is enabled if Safari shows that option.
5. Tap **Add**.
6. Launch **CS Enhancer** from the new Home Screen icon.
7. Go to Settings, paste your FACEIT profile URL and a FACEIT client-side API key.
8. Tap **Save & test connection**.

## Updating
Replace the files in GitHub with the new build. Safari's service worker may keep the previous shell briefly; reopening the web app or refreshing the page will pick up the new version.
