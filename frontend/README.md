# Night Desk: supervisor console (frontend)

Single-page live operations console. The deployed root page shows assistance
requests and family reunification cases saved by Retell in Supabase, refreshing
every 10 seconds.

- `index.html` is the generated self-contained dashboard.
- `src/template.html` contains the layout and styles.
- `src/app.js` loads and renders both live queues.
- `src/build.py` generates `frontend/index.html`.

## Rebuild
```
npm i maplibre-gl@4.7.1        # build.py inlines its CSS
pnpm build:frontend            # run from the repository root, writes frontend/index.html
```

## Wiring to the API
Retell saves resource requests through `/api/assistance-requests/create` and
family reunification records through `/api/reunification-cases/create`. The
dashboard polls both matching `/list` endpoints. New records appear within about
10 seconds.

The public dashboard contains callback numbers and locations. This deployment
intentionally has no dashboard login.
