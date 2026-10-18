# Night Desk: supervisor console (frontend)

Single-page console for the LA Resilience Line. The deployed root page shows
live assistance requests saved by Retell in Supabase and refreshes every 10
seconds.

- `index.html` is self-contained. MapLibre GL 4.7.1 loads from cdnjs.
- `src/` holds the sources: `template.html` (markup and CSS), `app.js` (simulation, scoring, map), `malibu.json` (map data built by `prep.py`), and `build.py`, which inlines them.

Open `/?demo=1` to use the original simulated wildfire drill instead of live
Retell data.

## Rebuild
```
npm i maplibre-gl@4.7.1        # build.py inlines its CSS
pnpm build:frontend            # run from the repository root, writes frontend/index.html
```

## Wiring to the API
Retell saves callers through `/api/assistance-requests/create`. The dashboard
polls `/api/assistance-requests/list` and maps each saved row to the caller list,
profile, severity tier, and map. New records appear within about 10 seconds.

The public dashboard contains callback numbers and locations. This deployment
intentionally has no dashboard login.
