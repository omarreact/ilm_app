# জন্ম নিবন্ধন যাচাই | Birth Certificate Verification

Privacy-first Bangladesh **birth registration** verification for the ILM project.

Uses the official BDRIS portal ([everify.bdris.gov.bd](https://everify.bdris.gov.bd/)) with **user-solved CAPTCHA** (no bypass). Optionally uses authorized Porichoy API when `PORICHOY_API_KEY` is configured.

## Features

- 17-digit UBRN + date of birth validation
- Official BDRIS form submit + HTML result parsing
- CAPTCHA proxy (`GET /api/captcha/bdris`) — user solves, server never bypasses
- Optional Porichoy birth path when API key is present
- Rate limiting, masked identifiers, no input storage
- Consent required before verification

## Stack

Next.js 16, React 19, TypeScript (Node.js ≥ 22).

## Environment

Copy `.env.example`:

```env
# Optional — preferred when set
PORICHOY_API_KEY=
PORICHOY_BASE_URL=https://api.porichoybd.com
PORICHOY_BIRTH_PATH=/api/v1/verifications/autofill
PORICHOY_TIMEOUT_MS=15000

# Official BDRIS (default path when no Porichoy key)
BDRIS_BASE_URL=https://everify.bdris.gov.bd
BDRIS_TIMEOUT_MS=20000

VERIFY_RATE_LIMIT=6
VERIFY_RATE_WINDOW_MS=300000
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health + BDRIS/Porichoy reachability |
| `GET` | `/api/captcha/bdris` | CAPTCHA image + `sessionId` |
| `POST` | `/api/verify/birth` | Verify birth registration |

### Verify request (BDRIS mode)

```json
{
  "birthRegistrationNumber": "20082692543019571",
  "dateOfBirth": "2008-01-10",
  "consent": true,
  "sessionId": "<from captcha endpoint>",
  "captchaAnswer": "27",
  "provider": "bdris"
}
```

### Verify request (Porichoy mode)

When `PORICHOY_API_KEY` is set, CAPTCHA fields are not required:

```json
{
  "birthRegistrationNumber": "20082692543019571",
  "dateOfBirth": "2008-01-10",
  "consent": true
}
```

## Local development

```bash
npm install
npm run dev
```

## Safety

- Not an official government website
- Does not bypass CAPTCHA, login, or access controls
- Does not store UBRN/DOB in a database
- Server-side credentials only (no `NEXT_PUBLIC_` secrets)
