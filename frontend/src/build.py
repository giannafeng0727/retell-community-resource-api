from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

t = (HERE / 'template.html').read_text()
css_path = ROOT / 'node_modules/maplibre-gl/dist/maplibre-gl.css'
if css_path.exists():
    css = css_path.read_text()
else:
    existing = (HERE.parent / 'index.html').read_text()
    css_start = existing.index('<style>.maplibregl-map') + len('<style>')
    css_end = existing.index('</style>', css_start)
    css = existing[css_start:css_end]
data = (HERE / 'malibu.json').read_text()
app = (HERE / 'app.js').read_text()
out = t.replace('__MAPLIBRE_CSS__', css).replace('__DATA__', data.replace('</', '<\\/')).replace('__APP__', app)
(HERE.parent / 'index.html').write_text(out)
print(len(out))
