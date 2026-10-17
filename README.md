# Retell Community Resource API — Node.js + Vercel

This Vercel API supports two Retell custom functions:

- `search_community_resources` searches short-term resources.
- `create_assistance_callback` saves a consented callback request to Supabase.

The resource search returns at most three matching shelter, food, water, or
transportation options.

> All included organizations, addresses, and phone numbers are fictional demo
> data. Replace them with verified sources before any real-world use.

## Endpoint after deployment

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

## Deploy with the Vercel dashboard

1. Put this folder in a GitHub repository.
2. Sign in to Vercel and select **Add New → Project**.
3. Import the repository.
4. Keep the framework preset as **Other**.
5. Add the `RESOURCE_API_KEY` environment variable.
6. Select **Deploy**.
7. Copy the production domain into the Retell API Endpoint field.

## Expected request body

```json
{
  "resource_type": "shelter",
  "location": "90007",
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
