# Android foundation — development branch

Status: **scaffold only; APK not yet built or validated**.

## Scope
This Android shell wraps the existing XPD / UECS Lite Field Capture QCM PWA. It does not extend the application into enterprise documentation or change UECS custody policy. Production web deployment remains on `main`.

## Initial architecture
- Capacitor Android shell with `dist/` as bundled web assets.
- Retain existing JavaScript QCM and shot-list logic.
- Preserve the existing Supabase / Vercel control plane; do not embed server secrets in the APK.
- Keep current IndexedDB data model for first compatibility tests; native storage migration requires a separate, tested plan.
- Native camera capture must retain original bytes separately from previews/derivatives before any evidence-integrity claim.
- Do not treat app-local offline access as authorization to mutate revoked assignments.

## Local bootstrap (not yet executed)
1. On this branch, add compatible Capacitor CLI/core/android dependencies and lockfile, then install.
2. Run `npm test` and `npm run build`.
3. Run `npx cap add android` and `npx cap sync android`.
4. Open Android Studio with `npx cap open android`; configure a compatible Android SDK/JDK and deploy to a test device.
5. Validate camera permission, offline cold launch, IndexedDB persistence, QCM, export, login, sync, and recovery from process termination.
6. Verify external HTTPS requests to the deployed Vercel API from the packaged app, including authentication and CORS/origin policies.

## Release gates
- Confirm source commit and reconcile package version / service-worker cache version.
- Confirm all web regression tests pass.
- No silent migration or loss of existing browser data.
- Preserve unmodified original photo bytes and test hash/manifest association before describing the output as evidence-grade.
- Verify Android WebView/service-worker behavior and offline loading; do not assume PWA caching behaves identically inside Capacitor.
- Keep Android branch isolated until QA approval and documented rollback.
