# Retell Community Resource Platform — Frontend + Node.js API

This repository deploys the Night Desk supervisor console and its Retell-backed
Vercel API as one project. The dashboard is served at `/`, while serverless API
routes remain available under `/api`.

The API supports two Retell custom functions:

- `search_community_resources` searches short-term resources.
- `create_assistance_callback` saves a consented callback request to Supabase.

The resource search returns at most three matching shelter, food, water, or
transportation options. The bundled catalog uses real Malibu-area place names
and addresses, but every availability, capacity, phone number, and service
detail is explicitly simulation-only. If Retell sends a Malibu landmark or
street name without coordinates, the demo resolves common locations such as
Point Dume, Zuma Beach, Pepperdine, Latigo Canyon, and Corral Canyon locally so
distance ranking still works.

## Project layout

```text
frontend/                     Static Night Desk supervisor console
api/                          Vercel serverless function entry points
lib/                          Shared backend logic
scripts/                      Backend tests
vercel.json                   Frontend route and function configuration
```

> All included organizations, addresses, and phone numbers are fictional demo
> data. Replace them with verified sources before any real-world use.

## URLs after deployment

Supervisor console:

```text
https://YOUR-PROJECT.vercel.app/
```

Resource search endpoint:

```text
POST https://YOUR-PROJECT.vercel.app/api/resources/search
```

Health check:

```text
GET https://YOUR-PROJECT.vercel.app/api/health
```

Callback queue endpoint:

```text
POST https://YOUR-PROJECT.vercel.app/api/assistance-requests/create
```

Live dashboard data endpoint:

```text
GET https://YOUR-PROJECT.vercel.app/api/assistance-requests/list
```

Family reunification endpoints:

```text
POST https://YOUR-PROJECT.vercel.app/api/reunification-cases/create
GET  https://YOUR-PROJECT.vercel.app/api/reunification-cases/list
POST https://YOUR-PROJECT.vercel.app/api/reunification-cases/update
```

New `search_person` and `register_safe` cases are automatically compared using
normalized names, phone numbers, and approximate locations. A confident match
is stored in both records' metadata and returned to Retell with
`notification_status: "ready_for_retell"`. The dashboard exposes a Family
Reunification filter and persists take/resolve status changes.

The dashboard polls both list endpoints every 10 seconds. The current deployment
does not require dashboard authentication, so callback numbers, approximate
locations, and reunification records returned by these endpoints are publicly
accessible.

The callback endpoint requires `Authorization: Bearer RETELL_CALLBACK_API_KEY`.
It rejects immediate-danger requests because emergency escalation must happen
before this function is called.

## Required Vercel environment variables

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
RETELL_CALLBACK_API_KEY
```

`SUPABASE_SECRET_KEY` must remain server-side and must never be placed in Retell,
a browser, source control, or a client application.

Use the complete Supabase secret key value (`sb_secret_...`), not the example
placeholder. New Supabase secret keys must be sent in the `apikey` header; they
are not JWTs and must not be sent as `Authorization: Bearer ...`.

## Retell custom-function settings

- Method: `POST`
- Payload args only: `ON`
- Timeout: `10 seconds`
- Max retries: `1`
- Header name: `Authorization`
- Header value for `create_assistance_callback`: `Bearer YOUR_RETELL_CALLBACK_API_KEY`

Create the same `RETELL_CALLBACK_API_KEY` value in Vercel under Project Settings
→ Environment Variables. This Retell-to-Vercel key is separate from the
server-only `SUPABASE_SECRET_KEY`.

## Test

```bash
npm test
```

To preview the frontend locally from the repository root:

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000/frontend/`. The production root route is
handled by the rewrite in `vercel.json`.

## Deploy with the Vercel dashboard

1. Sign in to Vercel and select **Add New → Project**.
2. Import this repository.
3. Keep the framework preset as **Other** and the root directory as the
   repository root.
4. Add `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and
   `RETELL_CALLBACK_API_KEY`.
5. Select **Deploy**.
6. Open the production domain to verify the dashboard, then copy the relevant
   `/api/...` URLs into the Retell custom-function settings.

## Expected request body

```json
{
  "resource_type": "shelter",
  "location": "Malibu Civic Center",
  "coordinates": {
    "latitude": 34.0366,
    "longitude": -118.6874
  },
  "people_count": 3,
  "children_count": 1,
  "accessibility_required": false,
  "medical_power_required": false,
  "has_pet": true,
  "has_service_animal": false,
  "needs_transportation": false,
  "preferred_language": "Spanish",
  "max_distance_miles": 10
}
```
