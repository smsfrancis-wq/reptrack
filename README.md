# RepTrack — personal strength and body-weight tracker

Mobile-first, offline-capable personal workout tracker designed around a **Marcy MWM-900** home gym. No framework or build step required. Works offline; optional authenticated Supabase synchronisation.

## Features

- Three-session-per-week full-body routine, seven exercises, 2 starting sets each
- Log kg / repetitions (or seconds), tick completed sets, add/remove sets
- Exercise-specific notes and general session notes
- Autosave in this browser; resume unfinished workouts
- Previous logged machine weights suggested on new sessions
- Completed-session history, review, edit and delete
- Body-weight log (lbs), line chart, goal-weight difference
- Daily creatine check-in, 7-day calendar, 14-day adherence and streak
- Adjustable weight, protein, calorie and creatine goals
- Full JSON backup and restore; completed sets exported as Excel-friendly CSV
- Responsive Android/PC UI and progressive web app install support

Initial defaults: 208 lb baseline, 195 lb goal, 170 g protein, 2,200 kcal and 5 g creatine/day. These are editable.

## Run locally

Open `index.html` in a browser for basic use, or serve the folder via a local HTTP server for offline service worker support:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Deploy to GitHub Pages

1. Create a new **separate** GitHub repository named `reptrack`. Do not place these files in Reef Command.
2. Upload the contents of this folder to the **root** of the repository (not the enclosing `reptrack/` folder).
3. In the repo, open **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, and save.
4. Open the URL GitHub shows after deployment; on Android Chrome select **Add to Home screen / Install app**. On desktop Chrome or Edge, use **Install app** in the browser menu when offered.

Note: GitHub Pages normally requires an appropriate public repository for free-tier accounts. **Never commit exported backups to a public repository.** The application code contains no personal workout data; browser records are stored on-device.

## Privacy and synchronisation

Records remain in browser `localStorage` and all core features work without a cloud account. Supabase cloud sync is available in v2 with email/password authentication, strict row-level security, and optimistic revision checks. A separate project stores only private workout snapshots under the signed-in user's UUID. **Before using sync, run `supabase/setup.sql` in the new Supabase project's SQL Editor and provide the publishable/anon key in RepTrack Settings.** See [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) for exact instructions.

Never commit workout exports or private Supabase keys (service_role / sb_secret) to GitHub. You can safely keep the public project URL and publishable/anon key in a client app provided RLS is enforced. Divergent offline edits require an explicit resolution; this release does not automatically merge them. Export JSON backups regularly.

## Health note

The programme and diet targets are planning aids, not medical guidance. Start with comfortable loads, progress gradually, and adjust to personal health and recovery.

## File map

- `index.html` — application shell
- `app.js` — state, workout logging, dashboards, import/export
- `styles.css` — responsive dark UI
- `manifest.webmanifest` — app metadata
- `sw.js` — offline caching
- `cloud.js` — optional Supabase sign-in and synchronisation
- `supabase/setup.sql` — authenticated-only table, RLS policies and concurrency-safe RPC
- `SUPABASE_SETUP.md` — step-by-step connection instructions
- `icons/` — app icon
