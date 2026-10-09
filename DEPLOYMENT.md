# Deployment

## Vercel

1. Connect repo `omarreact/ilm_app`.
2. Set environment variables from `.env.example` (at least nothing required for BDRIS-only mode).
3. Optional: `PORICHOY_API_KEY` for authorized Porichoy birth path.
4. Deploy. Node.js 22+ runtime.

## Modes

- **No Porichoy key** → birth verification via official BDRIS + user CAPTCHA.
- **With Porichoy key** → birth verification via Porichoy API (no CAPTCHA UI).

## Smoke checks after deploy

- `GET /api/health` → `birthVerification.mode` is `bdris` or `porichoy`.
- `GET /api/captcha/bdris` → returns `captchaImage` + `sessionId` (when BDRIS mode).
- UI loads CAPTCHA on the birth form when in BDRIS mode.
