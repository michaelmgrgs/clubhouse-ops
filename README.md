# Clubhouse Ops

Daily reporting for the CFC clubhouses (Oriana & Festival Living), built to make the
clubhouse manager's contractual duties verifiable:

- **GPS-locked:** check-in, every checklist answer, photo, incident and snag carries a live GPS fix.
  The server rejects anything outside the clubhouse geofence, with weak accuracy, or with a stale fix.
- **Minimum time on site:** while checked in, the app sends a GPS heartbeat (default every 60 s).
  Only intervals where consecutive heartbeats are inside the geofence count as verified time.
  The daily report for a clubhouse can't be submitted until **90 min** of verified time (configurable).
- **Live camera photos only:** photos are taken from the camera, resized, and stamped with
  clubhouse / item / time / coordinates. Gallery photos older than 10 minutes are rejected.
- **30-day photo retention:** photo files are deleted after 30 days (configurable); the record
  stays so reports show "photo expired".

## Manager app (`/m`, phone)
Check in → Checklist (Reception, Gym, Pool, Facility, Manager duties; OK / Issue / N/A, required photos)
→ Staff (Present / Late / Absent / Off, uniform, on post, no phone, photo each) → Incidents
→ Maintenance snags (48 h SLA, close with an "after" photo) → Submit report → Check out.

## Admin (`/admin`)
Dashboard (live on-site status, today's progress, 14-day compliance grid), daily reports with photos and
GPS evidence, incidents, maintenance SLA, monthly attendance (printable), staff roster (incl. lifeguard
certificate expiry), clubhouse geofences, users, settings.

## Run locally
```bash
npm install
npx prisma db push      # create tables
npm run db:seed         # clubhouses, admin + manager (see SEED_* in .env), placeholder staff
npm run dev -- -p 3100
```
`NEXT_PUBLIC_DEV_GEO=1` shows a "DEV GPS" simulator in the manager app so you can test from a
laptop. **Never set it in production.**

Geolocation in browsers requires HTTPS (or localhost). To test on a real phone on your Wi-Fi use
`npm run dev:lan` (self-signed HTTPS) and open `https://<your-mac-ip>:3000`.

## Before going live
1. Set the real coordinates for each clubhouse on **Admin → Clubhouses** (stand in the clubhouse and tap
   "Use my current location"), and tune the radius (default 150 m).
2. Replace the placeholder staff on **Staff roster**, set lifeguard certificate expiry dates.
3. Change seeded passwords, and delete the `tester-*@test.local` accounts.
4. Photo storage: `src/lib/storage.ts` writes to local disk. On a host without a persistent disk
   (e.g. Vercel) swap it for S3 / Cloudflare R2 (same `put / get / remove` interface).
5. Schedule the retention job daily: `GET /api/cron/cleanup` with `Authorization: Bearer $CRON_SECRET`
   (Vercel Cron does this automatically) or `npm run cleanup` from system cron.
   The admin dashboard also runs it at most every 12 h as a fallback.

## Limits worth knowing
GPS can be spoofed by a determined user with a fake-GPS app (mostly Android). The heartbeat trail,
watermarked live photos and staff photos make that much harder to sustain for 3 hours a day, and every
report shows the GPS evidence (heartbeats, % inside, furthest distance) so anomalies are visible.
Time only counts while the app is open — the app keeps the screen awake while checked in.
