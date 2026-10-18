# Night Desk: supervisor console (frontend)

Single-page console for the LA Resilience Line drill: a simulated Malibu wildfire.

- `index.html` is self-contained. Open it in a browser or serve the folder statically (Vercel works as is). MapLibre GL 4.7.1 loads from cdnjs.
- `src/` holds the sources: `template.html` (markup and CSS), `app.js` (simulation, scoring, map), `malibu.json` (map data built by `prep.py`), and `build.py`, which inlines them.

## Rebuild
```
npm i maplibre-gl@4.7.1        # build.py inlines its CSS
python3 src/build.py           # run from src/ after adjusting paths, writes night-desk-malibu.html
```

## Wiring to the API
Callers are simulated in `app.js` with the field names used by `/api/assistance-requests/create`
(`people_count`, `children_count`, `location_confidence`, `assistance_reference_code`, …).
To go live, add a GET endpoint that lists saved requests and replace `genCase()` and `step()` with polling.

All callers, feeds and numbers are simulated.
