# RepTrack v2 — Supabase integration

GitHub Pages: https://smsfrancis-wq.github.io/reptrack/
Supabase project: https://mcbzabueipossapkkoil.supabase.co

## 1 — Install v2 on GitHub

Extract the **entire** RepTrack-v2-Supabase.zip file. Replace the existing files in the **root** of `smsfrancis-wq/reptrack`, keeping the same directory layout (including `icons/` and `supabase/`). GitHub repository: https://github.com/smsfrancis-wq/reptrack.

The update modifies `index.html`, `app.js`, `sw.js`, `README.md` and adds `cloud.js`, `SUPABASE_SETUP.md` and `supabase/setup.sql`. The existing data model and local data key (`reptrack.data.v1`) are unchanged.

Wait for the Pages build to succeed in GitHub **Actions**. Reload the app; for an installed PWA, close it fully and reopen to receive the new service worker. If an older view persists, refresh the browser while online. **Do not clear site data**, as it contains your workout records.

## 2 — Create secured Supabase tables

Open the project's [Supabase SQL Editor](https://supabase.com/dashboard/project/mcbzabueipossapkkoil/sql/new). Copy and run the entire contents of **`supabase/setup.sql`**. A successful run creates one table and one function with strict authenticated-only row-level security.

Do not turn off RLS. Do not put personal data in the public GitHub repository. The `service_role` and `sb_secret_` keys are never appropriate for a browser app.

## 3 — Obtain the publishable key

In Supabase, open **Project Settings → API Keys** (sometimes under **Connect → API Keys**). Copy the **publishable** key (`sb_publishable_...`) or the legacy `anon` JWT key. The project URL is prefilled in RepTrack. The key is public by design; protecting data depends on authentication and row-level security.

The app never needs the database password, personal access token, secret key or service-role key.

## 4 — Create or sign in to your account

Open RepTrack → **Settings → Cloud synchronisation**. Paste the publishable key and select **Connect Supabase**. Create an account with an email and strong password, or sign in to an existing Supabase Auth account.

If email confirmation is enabled (the default for many Supabase projects), confirm the email and then sign in. Under **Authentication → URL Configuration**, set the **Site URL** to `https://smsfrancis-wq.github.io/reptrack/` and add it to the allowed redirect URLs.

Once authenticated, existing device records are saved to your own private Supabase row. Another device using the same Supabase account can download those records. When records differ on two devices, RepTrack stops and asks which complete version to keep rather than silently overwriting one.

## 5 — Test cross-device sync

1. On the first device, go to Settings and download a JSON backup **before** signing in.
2. Sign in and select **Sync now**. Check the top bar says **CLOUD SYNCED**.
3. On another browser/device, install/open the same RepTrack URL, paste the same publishable key, sign in with the same account and select **Sync now**.
4. Verify the body weight and session history match. Record a test creatine check-in on one device, then use **Sync now** on the other and verify it appears.
5. If a **SYNC CONFLICT** appears, export backups and choose which complete version to retain. This v2 release does not merge divergent snapshots automatically.

## Offline behaviour and safeguards

- Workouts continue saving locally if the internet or Supabase is unavailable.
- Changes queue for upload when reconnected and the page is open. It does not synchronise while all tabs and PWAs are closed.
- Cloud updates use an optimistic revision check and reject stale writes. Signing in on a new device will not silently replace existing records there.
- The app retains local backups and supports JSON export/restore. Keep an occasional external backup.
- Cloud auth is stored by the Supabase browser SDK on each device. Avoid installing it on untrusted/shared machines.
- GitHub Pages hosts public **code only**; Supabase stores private data per signed-in account.

## Troubleshooting

- **Relation `reptrack_data` does not exist / schema cache:** Run `supabase/setup.sql` in the correct Supabase project. Refresh the app.
- **Could not find function `reptrack_write`:** Run the full SQL file (including the function and grant); refresh.
- **Invalid API key:** Verify `sb_publishable_...` (or legacy anon JWT) is from this project. Never use `sb_secret_...`.
- **Email not confirmed:** Complete confirmation in your inbox, then sign in manually.
- **CLOUD NOT SIGNED IN:** Go to Settings and sign in. Local tracking still works.
- **SYNC CONFLICT:** Your two devices diverged. Export both JSON backups before choosing the authoritative version.
- **Site shows the old version:** Wait for a successful Pages deployment, close and reopen the installed app, then refresh online. Do not clear storage.
