# Digital Seba Public Intelligence Monitor

Production-oriented public-source monitoring dashboard for researched Bangladesh digital service portals.

## Safety model

- Static registry only; no arbitrary URL scanning.
- Public `GET` requests only.
- No login automation or credential submission.
- No NID, phone, DOB, payment-reference, or other personal-data submission.
- Redirects are revalidated against the hostname allowlist.
- DNS targets resolving to private/reserved IP ranges are blocked.
- Response size and timeout limits are enforced.
- Raw HTML is not stored.
- Website claims are shown separately from corroborated research.

## Stack

Next.js 16.3.3, React 19, TypeScript, optional PostgreSQL persistence via `postgres`, and Cheerio for public HTML parsing.

## Production mode

The app works immediately in stateless mode. For persistent history and scheduled scans, configure:

```env
DATABASE_URL=postgresql://...
CRON_SECRET=<long-random-secret>
```

Then run `npm run db:init` once against the database.

Optional scan controls:

```env
SCAN_MIN_INTERVAL_SECONDS=900
SCAN_TIMEOUT_MS=12000
SCAN_MAX_BYTES=1500000
SCAN_MAX_REDIRECTS=5
```

## Endpoints

- `GET /api/health`
- `GET /api/portals`
- `POST /api/scan` with `{ "id": "nidmaker" }`
- `GET /api/export`
- `GET /api/cron/scan` protected by `CRON_SECRET`

## Interpretation

A network failure is not proof that a site is offline. Likewise, a site advertising a sensitive capability does not prove that the capability works or that the operator has authorized access to any government system.
