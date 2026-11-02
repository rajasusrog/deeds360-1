# UNIKORN360 Deed360

Complete source assembled from build (6) with the branding and feature-clarity update. Includes the new logo, updated login/loading/sidebar and navy/gold/warm-white theme. Source code only; not a configured live deployment.

## Upload to GitHub
Extract the ZIP, then upload the files and folders at its root to your repository. Do not upload only the ZIP. Include public/, src/, backend/, package.json, package-lock.json, configuration files and .gitignore. Back up an existing repository before overwriting its files. Remove obsolete bun.lock from earlier versions; this package uses npm.

Credentials, .env, node_modules, dist and runtime data are intentionally excluded. Configure secrets through the hosting platform; never commit them. .env.example is a blank template.

## Run
Use Node 22.12 or later:

```sh
npm ci
npm run build
npm start
```

Development: `npm run dev`. Type checks: `npm run typecheck`.
Frontend VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set before building. Backend secrets and DATABASE_URL stay server-side. Production requires durable PostgreSQL and PII encryption configuration. Uploading to GitHub does not provision Google login or a database.

## Limits
Live OAuth/PostgreSQL, full browser save/reload/export and all-template export layouts remain unverified. Several AI workbench actions are demonstrations, disabled outside explicit development demo mode. Client upload storage is not connected. Simulated account security has been replaced with provider-managed account guidance. Historical migrations retain checksums; existing organization values are not bulk rewritten. See DELIVERY_CHECKS.md for the newly executed API, browser and PDF checks. No production-readiness or security certification is claimed.


## Verification commands
- `npm test`: disposable local regression suites; no live Supabase access.
- `npm run test:browser`: requires CHROMIUM_EXECUTABLE_PATH; exercises login at desktop/mobile sizes and browser PDF/DOCX generation with synthetic data.

This revised source fixes the previously uninitialized server sanitizer, incorrect search fields, false headless PDF success and browser PDF color/font/pagination failures. The full current validation record is in DELIVERY_CHECKS.md. No software package can be guaranteed error-free.
