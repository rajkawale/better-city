---
title: Better City — Product Spec v1
owner: Raj
status: Draft
created: 2026-09-24
---

# Better City — Product Spec v1

> Field executives capture civic problems (potholes, broken streetlights, garbage, open manholes…) with photos and location. Everything lands in an admin panel. The owner then turns the verified evidence into a clean, credible presentation for city administrators.

**Launch city:** Pune. Cities are data, not code — new cities are added from the Admin Panel as the team grows.

**Three UIs, one backend:**

| # | UI | Who uses it | Device | Purpose |
|---|----|-------------|--------|---------|
| 1 | **Executive App** | Field executives (1 now, many later) | Any phone — Android or iPhone (mobile web app, no app store) | Capture & upload issues on the ground |
| 2 | **Admin Panel** | Owner (Raj) + future reviewers | Laptop / desktop | Review, verify, organise, manage team |
| 3 | **City Showcase** | City administrators, commissioners, ward officers | Laptop / projector / tablet | Read-only, polished view of verified issues |

```
 Executive App ──upload──▶  Backend (DB + photo storage + auth)  ◀──manage── Admin Panel
                                        │
                                        └──curated, verified data only──▶ City Showcase
```

---

## 1. Problem Statement

Civic problems like potholes and open drains are everywhere, but there is no organised, evidence-backed record of them that can be put in front of the people who can fix them. Complaints to the city are scattered (WhatsApp photos, verbal reports) with no location, date, or proof, so they are easy to ignore. Better City creates a structured, geo-tagged, time-stamped evidence base collected by our own field team, which the owner can present to city administrators to push for action.

## 2. Goals

1. **Fast capture:** an executive can report an issue in **under 60 seconds** from opening the app.
2. **Trustworthy evidence:** **100%** of reports carry a photo, GPS location, and capture timestamp that cannot be edited by the executive.
3. **Instant visibility:** a submitted report appears in the Admin Panel within **1 minute** on a normal 4G connection (or automatically after the phone reconnects).
4. **Presentation-ready:** the owner can build and share a city/ward presentation from verified issues in **under 15 minutes**, with no manual copy-pasting into PowerPoint.
5. **Scale-ready:** adding a new executive or a new city takes **under 5 minutes** in the Admin Panel, with no code change.

## 3. Non-Goals (v1)

| Out of scope | Why |
|---|---|
| Public / citizen reporting | Keeps data quality high; only trained executives report in v1. Designed for later (P2). |
| City officials updating status inside our system | Needs buy-in from the city first. v1 is a *show* tool; the owner updates status manually. |
| Integration with government grievance portals | Every city's system is different; revisit once a city partners. |
| AI auto-detection of pothole size / severity | Nice, but manual categorisation is enough to prove value. |
| Payments / payroll for executives | Handle outside the product for now. |

---

## 4. Users & Roles

| Role | Description | Can do | Cannot do |
|---|---|---|---|
| **Super Admin (Owner)** | Raj | Everything: team, cities, categories, reviews, showcase links, exports | — |
| **Reviewer** *(P1, future)* | Staff who help verify reports | Review/verify/edit reports, build collections | Manage team, delete data, change settings |
| **Field Executive** | Assistant(s) on the ground | Create reports, see & edit **own** reports while *Submitted / Needs info* | See others' reports, delete after verification, access Admin Panel |
| **City Viewer** | City administrator / officer | View the showcase links shared with them | See unverified data, executive names, internal notes |

**Rule:** accounts are created by the Admin only. No self sign-up anywhere.

**Login method (all roles): email + password via Supabase Auth.**
1. Admin opens *Team → Add executive* and enters name, email, phone, assigned cities, and a temporary password (or clicks "Generate").
2. The system creates the Supabase Auth user (already confirmed, so no verification email) and the executive's profile with role `executive`.
3. Admin sees the login details once, with a **Copy** button, and sends them to the executive (WhatsApp / SMS / in person).
4. On first login the executive must set their own password.

---

## 5. Core Data: What a Report Contains

| Field | Source | Required | Notes |
|---|---|---|---|
| Photos (1–10) | Camera **or** gallery (both fully allowed) | ✅ min 1 | Each photo records its source (`camera` / `gallery`). Compressed on phone before upload; original kept for evidence |
| Category | Executive picks | ✅ | See list below; admin-configurable |
| Severity | Executive picks — **their own judgement** | ✅ | Low / Medium / High / Critical. No fixed rubric: the executive decides what feels critical on the ground. Admin can filter by it and adjust it during review. |
| Short title | Auto from category + area, editable | ✅ | e.g. "Pothole – FC Road near Goodluck Chowk" |
| Description | Executive types / dictates | ✅ | What the problem is |
| Details | Structured, per category | Optional | e.g. pothole: approx size (S/M/L), depth, lane; streetlight: pole number |
| Remarks | Executive types | Optional | Anything extra: "3rd time seen", "near school", "accident risk at night" |
| GPS location (lat/long + accuracy) | Camera: phone GPS at capture. Gallery: photo's embedded location if present, else phone's current GPS, else pin dropped on map | ✅ | Stores **how** location was obtained (`live_gps` / `photo_metadata` / `manual_pin`). Executive can fine-tune the pin |
| Address / landmark | Auto (reverse geocode) + editable landmark | ✅ | |
| City | Picked from the active cities list (pre-selected if the executive has only one city) | ✅ | Dynamic list managed in Admin (Pune at launch) |
| **Area** | Picked from a **searchable dropdown** of areas for the selected city | ✅ | Admin-managed names, e.g. Pune → Kothrud, Baner, Hadapsar, Shivajinagar. If the area isn't listed, executive picks **"Other – not in list"** and types the name; admin can add it to the list in one click. |
| Ward | Picked from a dropdown of wards for the selected city; auto-filled if the chosen area is linked to a ward | Optional | Admin-managed list. Can stay empty if the city has no wards set up. |
| Captured at | Camera: capture time. Gallery: photo's original date if available, else upload time | ✅ | Server upload time always stored separately; not editable |
| Submitted by | Auto | ✅ | Hidden from City Showcase |
| Status | System / Admin | ✅ | See lifecycle below |
| Internal notes | Admin | Optional | Never shown to executives' peers or city |

**Location structure:** `City → Area → (optional) Ward`. All three lists are managed by the admin; nothing is hard-coded.

**Default categories:** Pothole · Road damage / cracks · Open / broken manhole · Waterlogging / blocked drain · Garbage dump / overflowing bin · Broken / non-working streetlight · Damaged footpath · Encroachment · Broken signage / signal · Fallen tree / branches · Stray animal hazard · Other.

### Issue lifecycle (status)

```
Draft (on phone) → Submitted → Under Review ─┬─→ Verified → Reported to City → Acknowledged → Resolved → Closed
                                             ├─→ Needs Info → (executive edits) → Submitted
                                             ├─→ Duplicate (merged into another report)
                                             └─→ Rejected (with reason)
```

- Only **Verified** (or later) issues can appear in the City Showcase.
- **Resolved** requires an "after" photo so the showcase can show before/after.

---

## 6. UI 1 — Executive App (mobile)

Goal: dead-simple, camera-first, works in bad network, used one-handed on the street.

**Platform decision:** a mobile **web app (PWA)**, not a native app. Works on whatever phone the executive has (Android Chrome or iPhone Safari). Executive opens a link once and taps **"Add to Home Screen"** so it behaves like an app. No Play Store / App Store release needed; updates go live instantly.

### P0 — Must have

| # | Feature | Description | Acceptance criteria |
|---|---|---|---|
| E1 | **Login** | Email + password (Supabase Auth), using the details the admin sent. No sign-up screen. "Forgot password?" shows "Contact your admin to reset it". | Given an admin-created account, when the executive enters the correct email and password, they land on Home. On first login they must set a new password before continuing. Wrong password shows a clear error. Deactivated accounts cannot log in. Session stays logged in for 30 days. |
| E2 | **Home screen** | Big **"+ Report Issue"** button, today's count, list of recent reports with status chips. | Home loads in < 2 s; shows counts for today / this week. |
| E3 | **Camera + gallery capture** | "Report" screen has two equal buttons: **📷 Take photo** (opens phone camera) and **🖼 Choose from gallery**. Mix both in one report. 1–10 photos; retake / delete. | Works on Android Chrome and iPhone Safari. Min 1 photo enforced. Each photo tagged with its source (camera/gallery) — shown to admin as info, not as a warning. |
| E4 | **Location** | Camera photos: live GPS at capture, shown on a small map with accuracy ("±8 m"). Gallery photos: use the photo's embedded location if present; otherwise use current GPS and ask "Is this where the photo was taken?"; otherwise executive drops a pin. | If GPS accuracy is worse than 50 m, show "Waiting for better GPS…" with option to proceed anyway. Location source (`live_gps` / `photo_metadata` / `manual_pin`) always saved. If the browser location permission is denied, show a clear how-to-enable screen for Android and iPhone. |
| E5 | **Photo stamp** | Date, time, and coordinates stamped on a copy of the photo (like a GPS camera app). | Stamped copy used in showcase; clean original kept too. Gallery photos stamped with their original date if known. |
| E6 | **Issue form** | City (pre-selected if only one assigned; Pune at launch), **Area** (searchable dropdown for that city, with "Other – not in list" + text box), Ward (optional dropdown; auto-filled from area when linked), Category (icon grid), Severity (executive's own judgement: Low / Medium / High / Critical), Description, Category-specific details, Remarks, Landmark. | Form fits on ≤ 2 screens. Submit disabled until required fields are filled. Area list shows only areas of the selected city. Typing "kot" finds "Kothrud". Area/ward lists are cached on the phone so the form works offline. The app remembers the last-used area to speed up repeat reports in the same place. |
| E7 | **Offline mode & upload queue** | Reports saved on the phone first (browser storage); upload automatically when network returns while the app is open. Retry automatically. | With airplane mode on, executive can create 20 reports; all upload successfully once online and the app is opened, none lost or duplicated. Queue shows "3 waiting to upload". App warns before logout if uploads are pending. |
| E8 | **My reports** | List + detail of own reports, with status and admin feedback. Filter by status/date. | Executive only sees own reports. |
| E9 | **Fix "Needs Info"** | When admin marks "Needs info" with a comment, executive can add photos / edit text and resubmit. | Location and capture time remain locked on resubmit. |
| E10 | **Edit window** | Executive can edit own report only while status is *Submitted* or *Needs Info*. | Once *Under Review*, report is read-only for the executive. |

### P1 — Nice to have

| # | Feature | Description |
|---|---|---|
| E11 | **Nearby duplicate warning** | "A pothole was already reported 15 m away 3 days ago — add a follow-up photo instead?" |
| E12 | **Follow-up / revisit** | Add new dated photos to an existing report (shows problem still unfixed, or fixed → "after" photo). |
| E13 | **Voice note / voice-to-text** | Speak the description in Marathi / Hindi / English. |
| E14 | **Local language UI** | App available in English, Hindi, Marathi. |
| E15 | **Push notifications** | "Admin needs more info on report #231", "Your report was verified". (Web push works on Android; on iPhone only after the app is added to Home Screen.) |
| E16 | **Daily summary** | Reports submitted today, distance covered, streak. |
| E17 | **Assigned areas / tasks** | See ward or route assigned by admin for the day (useful once there are multiple executives). |

### P2 — Future

- Auto-suggest category from photo (AI).
- Pothole size estimation from photo.
- Route tracking (breadcrumbs) of the executive's day for coverage maps.

---

## 7. UI 2 — Admin Panel (web)

Goal: see everything coming in, verify it, keep data clean, manage the team, and prepare what the city will see.

### P0 — Must have

| # | Feature | Description | Acceptance criteria |
|---|---|---|---|
| A1 | **Admin login** | Email + password via Supabase Auth (+ optional 2FA). | Only Admin/Reviewer roles can access; an executive account trying to open `/admin` is refused. |
| A2 | **Dashboard** | Counts: new today, pending review, verified, by category, by severity, **by area**, by ward. Latest submissions feed. | Numbers match the issue list exactly. |
| A3 | **Issue list (table)** | All reports with thumbnail, title, category, severity, city, area, ward, executive, date, status. | Filters: status, category, **severity (multi-select, e.g. "Critical + High")**, city, **area (multi-select)**, ward, executive, photo source (camera/gallery), date range. Search by text/ID. Sort by any column. Handles 10,000+ rows with pagination. A **city switcher** at the top scopes the whole panel to one city or "All cities". |
| A4 | **Map view** | All issues as pins (colour = category or severity), clustered when zoomed out. Same filters as list. | Clicking a pin opens a preview card → full detail. |
| A5 | **Issue detail** | Photo gallery (zoom, full-screen, original vs stamped), all fields, mini-map, timeline of status changes, executive info, per-photo source (camera/gallery), location source and GPS accuracy. | Every change is visible in the timeline with who/when. |
| A6 | **Review actions** | Verify · Needs info (with comment) · Reject (with reason) · Mark duplicate (pick original). Bulk verify from list. | Needs-info comment reaches executive app. Rejected reports never appear in showcase. |
| A7 | **Edit report** | Fix category, severity, description, title, city, area, ward, landmark. For reports with "Other" area: **Add to area list** (creates the area and links the report) or **Map to existing area**. Cannot edit capture time or original GPS. | Edits are logged in audit trail with old → new values. If admin changes severity, the executive's original severity is still kept and visible. |
| A8 | **Status updates after reporting** | Move Verified → Reported to City → Acknowledged → Resolved (upload "after" photo) → Closed. | Resolved requires at least one "after" photo. |
| A9 | **Team management** | **Add executive:** name, email, phone, assigned cities, temporary password (typed or generated) → creates the Supabase Auth account + profile. Login details shown once with a **Copy** button to send to the executive. **Reset password:** admin sets a new temporary password (executive must change it at next login). **Deactivate / reactivate.** See each executive's report count and quality (verified % vs rejected %). | Creating an executive takes < 1 min and they can log in immediately. Duplicate email is refused with a clear message. Account creation runs on the server only (the admin secret key is never sent to the browser). Deactivated executive is logged out within 5 min and cannot upload; their past reports remain. |
| A10 | **Cities, areas & wards setup (dynamic)** | **Cities:** add / edit / deactivate (name, state, map centre). Pune is seeded at launch. **Areas (per city):** add / rename / deactivate area names (e.g. Kothrud, Baner, Hadapsar); bulk-add by pasting a list, one per line; optionally link an area to a ward. **Wards (per city):** simple list of ward names/numbers for a dropdown, or none. **"Other" queue:** list of area names typed by executives, with *Add to list* / *Map to existing* actions. Assign each executive to one or more cities. | New city/area usable by executives immediately, with no code change or redeploy. Duplicate area names in the same city are refused. Renaming an area updates it everywhere (reports link to the area, not a copy of its name). Deactivated city/area hidden from the executive app; its reports remain. Executives only see cities they are assigned to. |
| A11 | **Categories setup** | Add/rename/disable categories, set icon and category-specific detail fields. | Disabled category no longer shown in app; old reports keep it. |
| A12 | **Export** | Export filtered list to CSV/Excel; download photos as ZIP. | Export respects current filters. |
| A13 | **Audit log** | Who did what, when (logins, edits, status changes, exports, share links). | Cannot be edited or deleted from the UI. |

### P1 — Nice to have

| # | Feature | Description |
|---|---|---|
| A14 | **Collections (dossiers)** | Group verified issues into a named set, e.g. "Kothrud – Potholes – Oct 2026" or "Top 20 critical hazards", to show to a specific official. Drives the City Showcase. |
| A15 | **Share link management** | Create a showcase link for a collection, area, or ward: optional password, expiry date, revoke anytime, see view count / last viewed. |
| A16 | **PDF report generator** | One-click PDF: cover page, summary stats, map, one page per issue with photos, location, dates, status. Letterhead-ready. |
| A17 | **Duplicate detection** | Auto-suggest possible duplicates (same category within ~25 m in last 30 days). |
| A18 | **Privacy tools** | Blur faces / vehicle number plates in photos before they go to the showcase (manual brush first, auto later). |
| A19 | **Reviewer role** | Add staff who can review but not manage team/settings. |
| A20 | **Executive activity view** | Per-executive: reports per day, map of where they reported, average review outcome. |
| A21 | **Notifications** | Email/WhatsApp digest for new Critical issues. |

### P2 — Future

- Assign areas/routes to executives and track coverage (which streets have been surveyed).
- Area and ward **boundary maps** (GeoJSON/KML) so area/ward are auto-filled from GPS instead of picked from the dropdown.
- Executive self-service "forgot password" by email.
- SLA tracking: days since reported to city, days to resolve, per ward.
- Public/citizen submissions queue (separate moderation).
- API/integration with city grievance systems.

---

## 8. UI 3 — City Showcase (web, read-only)

Goal: something the owner can open in front of a Municipal Commissioner, or send as a link, that looks professional and makes the problem undeniable.

### P0 — Must have

| # | Feature | Description | Acceptance criteria |
|---|---|---|---|
| S1 | **Secure access** | Opened via a share link created in Admin (optionally password-protected, with expiry). No account needed for v1. | Expired/revoked link shows "This link is no longer active". Link only exposes the issues in its scope. |
| S2 | **Only verified data** | Shows only Verified-or-later issues in the link's scope (city / area / ward / collection). | Unverified, rejected, duplicate issues never appear — enforced on the server, not just hidden in the UI. |
| S3 | **Summary header** | City / area / ward name, date range, total issues, breakdown by category, severity and area, # critical hazards. | Numbers match what's listed below. |
| S4 | **Map** | All issues on a map, colour by severity; click for photo + details. | Works on a projector (large, readable). |
| S5 | **Issue cards / gallery** | Photo, category, severity, area, address/landmark, date first reported, days open, current status. | No executive names, no internal notes, no phone numbers shown. |
| S6 | **Issue detail** | Full photo gallery (stamped photos), description, area + location, timeline (reported → acknowledged → resolved). | Before/after photos side by side for resolved issues. |
| S7 | **Filters** | By area, ward, category, severity, status. | |
| S8 | **Mobile-friendly** | Officials may open the link on their phone. | Usable on a 375 px wide screen. |

### P1 — Nice to have

| # | Feature | Description |
|---|---|---|
| S9 | **Presentation mode** | Full-screen slideshow: summary slide → map slide → one slide per issue (big photo + key facts). Arrow keys / clicker to advance. For meetings. |
| S10 | **Download PDF** | Same PDF as A16, downloadable by the official. |
| S11 | **Area / ward report card** | Issues per area (and per ward), % resolved, average days open — ranked. |
| S12 | **Trends** | Issues reported vs resolved over time (weekly chart). |
| S13 | **Branding** | Better City logo + optional city logo/letterhead on showcase and PDF. |
| S14 | **Local language** | Toggle English / Marathi / Hindi for labels. |

### P2 — Future

- **City official login** where officers can mark issues "Acknowledged" / "Work order raised" / "Resolved" themselves, and assign to their ward engineer.
- Public version of the showcase (transparency dashboard for citizens).
- Embeddable widget for news media.

---

## 9. Cross-Cutting Requirements

| Area | Requirement |
|---|---|
| **Security** | Role-based access enforced on the server/database (not just the UI). Executives can only read/write their own reports. Showcase links read only verified data in scope. |
| **Evidence integrity** | Capture time + GPS are stored from the device *and* the server upload time is recorded. Photo source and location source are stored for every photo so admin always knows where evidence came from. Original photos are never overwritten. |
| **Multi-city** | Every report, area, ward, collection, and share link belongs to a city. No city, area, or ward name is hard-coded anywhere. |
| **Accounts** | Supabase Auth, email + password for every role. Role (`admin` / `reviewer` / `executive`) stored in a profile table and checked by database security rules. Admin-only actions (create user, reset password) run server-side with the Supabase service key, never in the browser. |
| **Browser support** | Executive app: Chrome on Android 10+, Safari on iOS 16+. Admin & Showcase: latest Chrome, Edge, Safari. HTTPS required (camera and GPS only work on secure sites). |
| **Photo handling** | Compress on phone (~1–2 MB per photo) for fast upload; keep original resolution in storage. Generate thumbnails for lists. |
| **Privacy** | Showcase never exposes executive identity, phone numbers, internal notes. Face / number-plate blurring before public/showcase use (P1). |
| **Offline** | Executive app must not lose data if the app is closed, the phone restarts, or network drops mid-upload. |
| **Performance** | Admin list & map load in < 3 s with 10k issues. Showcase loads in < 3 s on 4G. |
| **Backups** | Daily DB backup; photo storage with versioning. |
| **Audit** | All admin actions logged (see A13). |
| **Languages** | English in v1; structure text so Hindi/Marathi can be added (P1). |

---

## 10. Success Metrics

**Leading (first 2–4 weeks)**
- Median time to submit a report: **≤ 60 s** (target), ≤ 90 s (acceptable).
- Upload success rate: **≥ 99%** of reports reach the server within 24 h.
- Reports with GPS accuracy ≤ 20 m: **≥ 90%**.
- Admin review turnaround: **≤ 48 h** for 90% of reports.
- Reject / "needs info" rate: **< 15%** (signals executive training is working).

**Lagging (1–3 months)**
- Number of city administrator presentations / share links viewed.
- % of reported-to-city issues **acknowledged** by the city.
- % of reported-to-city issues **resolved** (with after-photo), and median days to resolve.
- Number of executives and cities onboarded without code changes.

---

## 11. Decisions Log

| Date | Decision | Impact on spec |
|---|---|---|
| 2026-09-24 | **Cities are dynamic.** Launch with Pune; add more cities from Admin as the team grows. | A10 rewritten; city switcher in A3; every record belongs to a city. |
| 2026-09-24 | **Both camera and gallery uploads allowed.** | E3/E4 rewritten; photo source + location source stored as info, not as a red flag. |
| 2026-09-24 | **Executive app is a mobile web app (PWA), not native.** Works on any Android or iPhone. | §6 platform note, E7 offline behaviour, §14 tech stack. |
| 2026-09-24 | **Severity is the executive's own judgement** (no fixed rubric). Admin can filter and adjust it. | Data table, E6, A3 multi-select filter, A7 keeps original severity. |
| 2026-09-24 | **Login is email + password via Supabase Auth.** Admin creates each account and sends the details to the executive. | §4 login flow, E1, A1, A9, §9 Accounts. |
| 2026-09-24 | **Wards are a simple dropdown** (no boundary maps in v1). **Areas added as a required, admin-managed list per city.** | §5 location structure, E6, A3, A7, A10, showcase S2–S7, S11. Boundary maps moved to P2. |

## 12. Open Questions

| # | Question | Who answers | Blocking? |
|---|---|---|---|
| 1 | Initial list of Pune area names (and wards, if we want them day 1) to load before the pilot. | Owner | ✅ Needed before pilot (not before building) |
| 2 | Will city administrators just get a link, or do we want them to log in (needed for P2 status updates)? | Owner / City | Non-blocking for v1 |
| 3 | Any legal/privacy rules about photographing public places and people for a government presentation? | Legal | Non-blocking (blurring covers most) |
| 4 | Are executives paid per report? (If yes, stronger anti-fraud checks are needed.) | Owner | Non-blocking |
| 5 | Final list of categories (default list in §5 is the starting point). | Owner | Non-blocking |
| 6 | Which languages must the executive app support on day 1? | Owner | Non-blocking |
| 7 | Branding: product name, logo, do we put the city logo on showcase/PDF? | Owner | Non-blocking |

---

## 13. Phasing

| Phase | Scope | Rough effort |
|---|---|---|
| **Phase 1 — Capture & Review** | Executive App P0 (E1–E10) + Admin Panel P0 (A1–A13) | ~3–4 weeks |
| **Phase 2 — Show the City** | City Showcase P0 (S1–S8) + Collections (A14), Share links (A15), PDF (A16), Presentation mode (S9) | ~2–3 weeks |
| **Phase 3 — Scale the team** | Reviewer role, duplicate detection, assignments, notifications, local languages, privacy blurring | ~3–4 weeks |
| **Phase 4 — City partnership** | City official login & status updates, SLA tracking, public dashboard, citizen reports | TBD after first city partnership |

**Pilot plan:** run Phase 1 with the one executive across a few Pune areas for 2 weeks, fix pain points, then build Phase 2 using real data (a showcase with 50–100 real, verified issues is far more convincing than a demo).

---

## 14. Tech Approach

- **One web app for all three UIs** (Next.js), split by area:
  - `/field` — Executive PWA (mobile-first, installable to Home Screen)
  - `/admin` — Admin Panel
  - `/show/[link]` — City Showcase
  One codebase, one deploy, shared components (maps, photo gallery, issue cards).
- **Backend:** Supabase — Postgres (+ PostGIS for "issues within 25 m"), Auth (email + password; admin creates users server-side with `auth.admin.createUser`), Storage for photos, Row-Level Security to enforce the roles in §4 and city access at the database level.
- **Location tables:** `cities` → `areas` (city_id, name, optional ward_id) and `wards` (city_id, name). Reports store `city_id`, `area_id` (or `area_other_text`), `ward_id`.
- **Camera & gallery:** standard browser photo picker (`capture` for camera, plain picker for gallery) — works on Android and iPhone without a native app. Photo compression and stamping done in the browser before upload.
- **Offline:** reports + photos saved in browser storage (IndexedDB) and uploaded by a queue whenever the app is open and online.
- **Maps:** MapLibre + OpenStreetMap (free) or Mapbox.
- **PDF:** server-side generation from the same showcase templates.

**Known web-app limits (accepted trade-offs):**

| Limit | Mitigation |
|---|---|
| iPhone does not upload in the background when the app is closed | Pending-upload banner; uploads resume as soon as the app is opened; logout blocked while uploads pending |
| iPhone can clear website storage for sites not used for a while | Ask executives to "Add to Home Screen" (installed web apps are kept); upload queue normally empties within minutes anyway |
| Gallery photos shared via WhatsApp have their location/date removed | Fall back to current GPS / manual pin (E4); location source recorded |
| Web push on iPhone needs Home Screen install | Onboarding step: install to Home Screen on first login |
