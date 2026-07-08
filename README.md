# XPD Field Capture QCM v1.0

**XPD Field Capture QCM | UECS Lite Intake System**

Phase 1 phone-first PWA for **XPD documentation packages only**. Guides field users through UECS Lite project intake, required shot lists, phone camera capture, per-image QCM scoring, coverage tracking, and structured export for admin review.

> **Version 1.0 scope:** Field Capture QCM is intentionally limited to XPD and UECS Lite workflows. Enterprise documentation levels (EAS/EDIS, Levels I–V, spatial, inspection, LiDAR, controlled evidence, etc.) will be implemented in a future Enterprise capture module.

> This system supports visual and spatial documentation quality control only. QCM results evaluate image clarity, coverage, metadata, and documentation readiness. QCM does not provide engineering opinions, inspection conclusions, code compliance determinations, damage diagnosis, or repair recommendations.

---

## What This System Does

Field Capture QCM answers these questions **before you leave the site**:

- Did I capture the required areas?
- Are the photos sharp enough?
- Are the photos properly exposed?
- Are there missing required views?
- Do I have the correct minimum image count?
- Are wide-context and closeup images paired correctly?
- Is the package ready for admin review?

It is a **documentation quality control system**, not a camera app.

---

## How to Run Locally

### Option 1 — Simple HTTP server (recommended)

PWA features (service worker, camera) require HTTPS or `localhost`.

```bash
cd field-capture-qcm
npx serve .
```

Then open `http://localhost:3000` (or the port shown).

### Option 2 — Python

```bash
cd field-capture-qcm
python -m http.server 8080
```

Open `http://localhost:8080`.

### Option 3 — VS Code / Cursor Live Server

Open `index.html` with a local server extension. Do **not** open the file directly (`file://`) — service worker and modules will not work.

---

## How to Install as PWA

1. Serve the app over HTTPS or localhost (see above).
2. Open in **Chrome** (Android) or **Safari** (iOS).
3. **Android:** Menu → *Install app* or *Add to Home screen*.
4. **iOS:** Share → *Add to Home Screen*.
5. Launch from home screen for full-screen, offline-capable field use.

---

## How to Start a Project

1. Tap **Start Field Capture**.
2. Complete **Project Intake** (client, address, field user, XPD package).
3. Select an **XPD Documentation Package** (or import from UECS Lite / ClientFlow).
4. Review the auto-generated **Shot List Dashboard**.
5. Tap **Capture Required Shot** for each zone.
6. After each capture, tap **Run QCM**, then **Accept Image** or **Retake Image**.
7. Monitor **Coverage Dashboard** for missing zones and package readiness.
8. Use **Final Review** before export.
9. Tap **Export Project Packet** to download JSON + HTML files.

---

## XPD Documentation Packages (v1.0)

| Package | Target Images | Doc Control |
|---------|---------------|-------------|
| XPD StormReady Residential – Pre-Storm Baseline | 25–45 | UECS Lite |
| XPD StormReady Residential – Post-Storm Comparison | 20–40 | UECS Lite |
| XPD Storm Snapshot | 15–30 | UECS Lite |
| XPD Exterior Baseline Snapshot | 25–45 | UECS Lite |
| XPD Exterior Property Record | 45–75 | UECS Lite |
| XPD Exterior + Aerial Baseline | 25–45 | UECS Lite |

Every project sets `documentation_family: "XPD"` and `documentation_control_classification: "UECS Lite"`.

---

## How QCM Works

After each capture, QCM runs **offline** in the browser:

| Check | Weight |
|-------|--------|
| Sharpness (Laplacian variance) | 25 pts |
| Exposure (brightness analysis) | 20 pts |
| Resolution (long edge) | 15 pts |
| Shot-list relevance | 20 pts |
| Metadata completeness | 10 pts |
| Coverage contribution | 10 pts |

**Status thresholds:**

- 90–100 → PASS
- 75–89 → PASS WITH NOTE
- 60–74 → WARNING
- 0–59 → RETAKE RECOMMENDED

Additional flags: duplicate zone warnings, wide/closeup pairing, missing zones, admin review.

---

## Exports Created

| File | Contents |
|------|----------|
| `project_packet.json` | Full UECS/XPD/ClientFlow-ready project packet |
| `image_manifest.json` | Per-image metadata manifest |
| `qcm_summary.json` | QCM scores and package readiness |
| `field_capture_report.html` | Human-readable field summary with disclaimer |

Default integration fields: `review_status: qcm_pending`, `qcm_status: field_qcm_completed`, `admin_review_required: true`.

---

## Local Storage & Field Data

- **IndexedDB:** projects, images, image blobs, QCM results, shot list status, export records
- **localStorage:** active project ID

Works fully offline after first load.

**Important limitations:**

1. Data is local to the device/browser.
2. Clearing browser data can remove saved projects.
3. **Export project packet before deleting browser data.**
4. This is not cloud sync — ClientFlow API sync is a future phase.

---

## Security / Privacy (Phase 1)

Phase 1 stores field capture data locally on the user's device until export. **No images or project records are uploaded to a server** unless a future ClientFlow sync endpoint is added.

---

## XPD Ground-Based Capture Structure

Three coverage groups map to the Simple Field Method passes:

| Group | Pass | Target |
|-------|------|--------|
| Required Core Coverage | Pass 1 — Four-Side Exterior Record | 18–28 images |
| Condition / Detail Coverage | Pass 2 — Controlled Detail Capture | 5–12 images |
| Optional Context Coverage | Pass 3 — Final QA / justified context | 3–5 images (optional) |

**Recommended total:** 25–40 images · **Controlled upper:** 40–45 (with context justification)

Overcapture warnings appear above 40 usable images without context justification, and above 45 with admin review flag on export.

---

## XPD Exterior Baseline — Simple Field Method

When **XPD Exterior Baseline Snapshot** is selected, the app uses the **Simple Field Method** by default:

| Pass | Name | Target |
|------|------|--------|
| Pass 1 | Four-Side Exterior Record | 18–25 usable images, 12 required views |
| Pass 2 | Controlled Detail Capture | 7–15 usable images, 10 detail categories |
| Pass 3 | Final QA Fill | Replacement / QA only (not extra image count) |

Overall package target: **25–45 exterior images**.

Pass 3 checklist must be completed before the package can be marked ready for admin review. Site limitations (not accessible, blocked, etc.) require a field note.

---

## Phase 1 Includes

- Mobile-first HTML/PWA interface
- Project intake screen
- Service pathway selector (7 pathways)
- Required shot-list generator
- Phone camera capture (file input + optional live preview)
- Image preview with accept/retake/admin review
- Per-image QCM scoring (10 checks)
- Required coverage tracker
- Missing-shot warnings
- Local offline storage (IndexedDB)
- JSON + HTML export
- Final QCM summary screen
- PWA install / offline app shell

---

## Phase 1 Does NOT Include

- Sony camera control
- Drone capture control
- LiDAR capture
- Direct Pix4D processing
- Full ClientFlow API submission
- User authentication
- Payment
- Client-facing delivery portal
- AI defect detection
- Inspection conclusions

---

## Future Phases

| Phase | Focus |
|-------|-------|
| **Phase 2** | Sony camera import / tethered capture |
| **Phase 3** | Tether dashboard for multi-device field ops |
| **Phase 4** | ClientFlow API sync and automated delivery |

---

## Deploy to Vercel

**Release:** EAS Field Capture QCM v1.0 — Phase 1 Phone Camera PWA

### Build settings

| Setting | Value |
|---------|-------|
| Framework Preset | Other |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### Local build test

```bash
cd field-capture-qcm
npm install
npm run build
npm run preview
```

Open `http://localhost:4173` (or use `python -m http.server 8080` from project root for dev).

### Recommended domain

```text
field-capture.eyeamstudios.com
```

Add in Vercel → Settings → Domains. DNS (example):

```text
Type: CNAME
Name: field-capture
Value: cname.vercel-dns.com
```

### Service worker cache

Update `CACHE_NAME` in `service-worker.js` when releasing (e.g. `field-capture-qcm-v1.0.1`) so phones fetch updated assets after deploy.

---
```
field-capture-qcm/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── vercel.json
├── package.json
├── vite.config.js
├── scripts/build-static.js
├── css/styles.css
├── js/
│   ├── app.js
│   ├── camera.js
│   ├── export.js
│   ├── qcm.js
│   ├── shotlists.js
│   ├── simple-field-method.js
│   ├── storage.js
│   ├── utils.js
│   └── xpd-ground-capture.js
└── assets/icons/
```

---

## Version

**EAS Field Capture QCM v1.0**  
**XPD Field Capture QCM v1.0**

© EYE AM STUDIOS
