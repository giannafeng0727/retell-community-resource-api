import json
t=open('template.html').read()
css=open('node_modules/maplibre-gl/dist/maplibre-gl.css').read()
data=open('malibu.json').read()
app=open('app.js').read()
out=t.replace('__MAPLIBRE_CSS__',css).replace('__DATA__',data.replace('</','<\\/')).replace('__APP__',app)
open('night-desk-malibu.html','w').write(out)
# local test copy uses the npm build instead of the CDN
loc=out.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js"></script>','<script src="node_modules/maplibre-gl/dist/maplibre-gl.js"></script>').replace('<link rel="stylesheet" href="https://fonts.googleapis.com','<link rel="x" href="https://fonts.googleapis.com')
open('test.html','w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>'+loc+'</body></html>')
print(len(out))
