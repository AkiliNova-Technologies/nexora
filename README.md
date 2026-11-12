# Nexora Home frontend

Next.js 16 frontend for the Smart Estate Spring Boot API. It preserves the original in-browser simulator and adds an explicit backend integration mode.

## Local backend mode

1. Start the Spring Boot API on `http://localhost:8080` with its `dev` profile and PostgreSQL configuration.
2. Copy `.env.example` to `.env.local` and keep `NEXT_PUBLIC_SMART_ESTATE_MODE=BACKEND`.
3. Run `npm install` and `npm run dev`, then open `http://localhost:3000`.
4. Register a user or sign in. An account without a house can create the development demo house only when both the backend `dev` profile and `NEXT_PUBLIC_ENABLE_DEV_ONBOARDING=true` are active.

The API base URL must include `/api/v1`. Spring CORS must allow the exact frontend origin and credentials. Authentication uses the backend session cookie; mutations first acquire `/csrf` and send `X-XSRF-TOKEN`. The app opens a credentialed named-event SSE stream and reloads authoritative REST state whenever that stream reconnects.

## Mock mode

Set `NEXT_PUBLIC_SMART_ESTATE_MODE=MOCK` (or omit it) to use the deterministic local `DeviceStore` simulator. Mock mode makes no backend calls. This separation prevents backend failures from silently falling back to demo data.

## Verification

```bash
npm run lint
npx tsc --noEmit --incremental false
npm test
npm run build
```

The production build inlines all `NEXT_PUBLIC_*` values. Configure them before building.
