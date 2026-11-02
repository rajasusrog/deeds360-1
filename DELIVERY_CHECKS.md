# Verification record — 31 October 2026

Complete revised source based on Deed360_Complete_GitHub_Source.zip. These are scoped test results, not an error-free or production-security guarantee.

## Executed checks
| Check | Result | Scope |
| --- | --- | --- |
| Clean npm ci | PASS | Locked dependency installation; 420 packages; Node 24.22.1 |
| npm run build | PASS | Frontend/backend type checks and Vite frontend build |
| npm test | PASS | Eight existing suites plus new release-regression suite, separate disposable processes |
| API regression journey | PASS | Synthetic verified identities; create, party/survey search, save/reload, export, second-user denial |
| npm start | PASS | Custom PORT honored; frontend and health API served with disposable local storage |
| Desktop login | PASS | Chromium at 1440x1000, logo load, no old labels/runtime errors/horizontal overflow |
| Mobile login | PASS | Chromium at 390x844, logo load, Tamil font load, no horizontal overflow |
| Actual browser PDF | PASS | Synthetic bilingual multi-survey Sale Deed; generated in browser and rendered with Poppler |
| PDF visual review | PASS for tested sample | Three pages inspected; Tamil including signatures readable, no trailing blank page, section-aware breaks |
| DOCX generation | PASS | Synthetic sample produces a real non-empty DOCX; Microsoft Word visual layout not tested |

## Real fixes made in this revision
- Initialized server-side sanitizer used by shared deed compilation. Server HTML retains safe markup instead of escaping every legal tag.
- Removed fake headless PDF success. Node without a browser now reports the capability unavailable. Tests no longer call an empty placeholder PDF a successful export.
- Replaced incompatible canvas renderer; actual Tailwind color handling exercised in Chromium PDF generation.
- Bundled self-hosted Noto Sans Tamil fonts and license, including print-window font declarations. Browser PDF/print waits for fonts.
- PDF strips use whitespace/section boundaries, page margins and trailing-padding trimming. Temporary export DOM is cleaned even on rendering failure.
- UI/API share document search for party names and correct multi-survey fields. Authorization remains before search; PAN/Aadhaar are not searchable by this helper.
- Environment loads before database/PII modules. Removed unused local JWT_SECRET production requirement; database bootstrap failure stops production startup.
- Larger logo on desktop/mobile login. Existing navy/gold/warm-white branding retained.

## Important limits
- Live Google OAuth, live Supabase/PostgreSQL migrations/RLS, provider APIs and production deployment were NOT tested or modified.
- Auth regression uses synthetic signed tokens/test verifiers. SQL migration executor checks are mock-backed; do not interpret them as a live PostgreSQL test.
- Authenticated browser navigation and all role dashboards were not end-to-end tested. Only login layout was browser-checked at the stated sizes.
- PDF visual check covers one synthetic Sale Deed fixture, not every deed, long-text layout, page size or legal scenario. A screenshot-based PDF is not a tagged/selectable-text document.
- Client upload storage and live AI workbench integrations are still unfinished. Demonstration tools remain labelled/restricted. Registry verification is unconnected.
- Main JS bundle remains large (~2.3 MB before gzip). No load testing or current dependency vulnerability advisory audit is claimed.
- Legal/template correctness requires appropriate human review; this delivery is not a legal certification.

## Reproduce
`npm ci`, `npm run build`, `npm test`, `npm start`.
Optional real-browser checks: set CHROMIUM_EXECUTABLE_PATH to a compatible Chrome/Chromium binary and run `npm run test:browser`. This starts an isolated local development server and generates synthetic outputs in a temporary directory. Browser tools are a development dependency; no Chrome binary is included.

## Apply
This ZIP is the full project, not a patch. Back up the current repository, extract and replace matching source paths, including public/fonts and scripts. Keep credentials configured separately. No .env, local records, node_modules, dist, screenshots, QA PDFs, or test Chrome binary is included. Historical SQL migrations are preserved. Remove any old bun.lock left in an existing repository; use npm/package-lock.json.
