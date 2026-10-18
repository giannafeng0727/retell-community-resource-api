import json, math, random
from shapely.geometry import shape, mapping, Polygon, LineString, Point, box, MultiPolygon
from shapely.ops import unary_union

BB = box(-119.06, 33.93, -118.44, 34.24)
R = lambda g, n=5: json.loads(json.dumps(mapping(g)), parse_float=lambda x: round(float(x), n))

def rnd(o, n=5):
    if isinstance(o, float): return round(o, n)
    if isinstance(o, (list, tuple)): return [rnd(x, n) for x in o]
    if isinstance(o, dict): return {k: rnd(v, n) for k, v in o.items()}
    return o

hoods = json.load(open('hoods_clip.geojson'))['features']
hp = []
for f in hoods:
    g = shape(f['geometry']).buffer(0).intersection(BB)
    if g.is_empty: continue
    hp.append((f['properties']['name'], g))
county = unary_union([g for _, g in hp]).buffer(0.0006).buffer(-0.0006)
def nohole(g):
    ps = g.geoms if hasattr(g, 'geoms') else [g]
    return unary_union([Polygon(p.exterior) for p in ps if p.geom_type == 'Polygon'])
county = nohole(county)

lc = json.load(open('land_clip.geojson'))
geoms = lc.get('geometries') or [f['geometry'] for f in lc.get('features', [])]
if lc.get('type') in ('Polygon', 'MultiPolygon'): geoms = [lc]
land10 = unary_union([shape(g).buffer(0) for g in geoms]).intersection(BB)
other = land10.difference(county.buffer(0.004))
parts = [p for p in (other.geoms if hasattr(other, 'geoms') else [other]) if p.area > 0.0004]
other = unary_union(parts).buffer(0.004).difference(county) if parts else Polygon()
land = nohole(unary_union([county, other]))

# simplify for size
tol = 0.00025
land_s = land.simplify(tol, preserve_topology=True)
feat_land = {'type': 'Feature', 'properties': {}, 'geometry': rnd(mapping(land_s))}
lines = []
for n, g in hp:
    b = g.boundary.intersection(county.buffer(-0.0005)).simplify(tol)
    if not b.is_empty: lines.append({'type': 'Feature', 'properties': {'n': n}, 'geometry': rnd(mapping(b))})

# roads: Natural Earth (PCH, 101, 23, 405) + simplified canyon roads (approximate alignments)
rr = json.load(open('/home/claude/geo/malibu_roads_raw.geojson'))['features']
roads = []
for f in rr:
    p = f['properties']; g = shape(f['geometry']).intersection(BB)
    if g.is_empty: continue
    nm = {'1': 'Pacific Coast Hwy', '101': 'US-101'}.get(p['name'], p['name'])
    cls = 'pch' if p['name'] == '1' else 'fwy'
    roads.append({'type': 'Feature', 'properties': {'n': nm, 'c': cls}, 'geometry': rnd(mapping(g))})
canyon = {
    'Kanan Dume Rd': [(-118.792, 34.024), (-118.796, 34.046), (-118.789, 34.070), (-118.776, 34.094), (-118.766, 34.120), (-118.762, 34.146)],
    'Malibu Canyon Rd': [(-118.687, 34.034), (-118.695, 34.060), (-118.704, 34.084), (-118.705, 34.106), (-118.710, 34.130), (-118.708, 34.147)],
    'Topanga Canyon Blvd': [(-118.583, 34.039), (-118.592, 34.062), (-118.601, 34.093), (-118.600, 34.121), (-118.605, 34.156)],
    'Latigo Canyon Rd': [(-118.757, 34.029), (-118.757, 34.050), (-118.765, 34.074), (-118.779, 34.091)],
    'Corral Canyon Rd': [(-118.731, 34.033), (-118.735, 34.056), (-118.739, 34.077)],
}
for n, cs in canyon.items():
    roads.append({'type': 'Feature', 'properties': {'n': n, 'c': 'canyon'}, 'geometry': {'type': 'LineString', 'coordinates': cs}})

# PCH: Natural Earth line is too coarse here, so trace it ~300 m inland of the coastline, cutting across Point Dume
from shapely.geometry import LineString as LS
def coast_lat(x):
    v = LS([(x, 33.9), (x, 34.2)]).intersection(land)
    if v.is_empty: return None
    gs = v.geoms if hasattr(v, 'geoms') else [v]
    return min(min(c[1] for c in g.coords) for g in gs)
xs = [ -118.95 + i*0.0025 for i in range(int((0.45)/0.0025)+1)]
pts = []
for x in xs:
    if -118.818 < x < -118.786: continue
    c = coast_lat(x)
    if c is None: continue
    pts.append([x, c + 0.0028])
# smooth
sm = []
for i in range(len(pts)):
    w = pts[max(0,i-3):i+4]
    sm.append((pts[i][0], sum(p[1] for p in w)/len(w)))
pch = LS(sm).simplify(0.0003)
roads = [f for f in roads if f['properties']['c'] != 'pch']
roads.append({'type': 'Feature', 'properties': {'n': 'Pacific Coast Hwy', 'c': 'pch'}, 'geometry': rnd(mapping(pch))})
def pch_y(x):
    v = pch.intersection(LS([(x, 33.9), (x, 34.2)]))
    return v.y if v.geom_type == 'Point' else list(v.geoms)[0].y
for f in roads:
    if f['properties']['c'] == 'canyon':
        cs = f['geometry']['coordinates']; cs[0] = (cs[0][0], round(pch_y(cs[0][0]), 5))

# fire stages: drifting ellipse from origin toward SW (Santa Ana wind), clipped to land
O = (-118.742, 34.083)
KX = 92.2; KY = 111.0  # km per degree
ang = math.atan2(-(34.083 - 34.022) * KY, -(118.742 - 118.786) * KX * -1)  # direction toward (-118.786, 34.022)
dx, dy = (-118.786 + 118.742) * KX, (34.022 - 34.083) * KY
L0 = math.hypot(dx, dy); ux, uy = dx / L0, dy / L0
random.seed(7)
noise = [random.uniform(-1, 1) for _ in range(12)]
def stage(len_km, wid_km, back_km=0.4):
    pts = []
    for i in range(96):
        t = 2 * math.pi * i / 96
        # ellipse along wind axis, centred ahead of origin
        a = (len_km + back_km) / 2; b = wid_km / 2
        c = (len_km - back_km) / 2
        ex = c + a * math.cos(t); ey = b * math.sin(t)
        wob = 1 + 0.10 * sum(noise[k] * math.sin((k + 2) * t + k) for k in range(5)) / 2.2
        ex *= wob; ey *= wob
        x = ex * ux - ey * uy; y = ex * uy + ey * ux
        pts.append((O[0] + x / KX, O[1] + y / KY))
    return Polygon(pts).buffer(0).intersection(land)
stages = []
spec = [(2, 0.35, 0.25), (9, 0.9, 0.5), (14, 1.6, 0.8), (20, 2.4, 1.1), (26, 3.2, 1.4), (32, 4.0, 1.7), (40, 5.0, 2.0), (50, 6.0, 2.3), (60, 7.2, 2.6), (75, 8.4, 2.9)]
ACRE = 0.004046856  # km2
for m, L, W in spec:
    g = stage(L, W, 0.3 + 0.12 * L).simplify(0.0001)
    area_km2 = g.area * KX * KY
    stages.append({'m': m, 'acres': int(round(area_km2 / ACRE, -1)), 'g': rnd(mapping(g))})

def Z(name, kind_steps, cs):
    g = Polygon(cs).intersection(land).simplify(0.0002)
    return {'name': name, 'steps': kind_steps, 'g': rnd(mapping(g))}
zones = [
    Z('Latigo–Corral Canyon', [[18, 'order']], [(-118.775, 34.105), (-118.722, 34.100), (-118.716, 34.060), (-118.728, 34.034), (-118.745, 34.040), (-118.770, 34.062), (-118.786, 34.090)]),
    Z('Point Dume–Paradise Cove', [[18, 'warning'], [28, 'order']], [(-118.770, 34.062), (-118.745, 34.040), (-118.728, 34.034), (-118.728, 34.020), (-118.790, 33.985), (-118.818, 33.995), (-118.800, 34.040)]),
    Z('Zuma Beach–Kanan', [[28, 'warning']], [(-118.786, 34.090), (-118.770, 34.062), (-118.800, 34.040), (-118.818, 33.995), (-118.850, 34.010), (-118.845, 34.060), (-118.810, 34.100)]),
    Z('Malibu Bluffs–Pepperdine', [[28, 'warning']], [(-118.722, 34.100), (-118.690, 34.098), (-118.672, 34.050), (-118.680, 34.020), (-118.728, 34.020), (-118.728, 34.034), (-118.716, 34.060)]),
]

def clip_line(line, x0, x1):
    g = line.intersection(box(min(x0, x1), 33.9, max(x0, x1), 34.3))
    return rnd(mapping(g))
closures = [
    {'m': 24, 'name': 'PCH closed both ways, Kanan Dume Rd to Malibu Canyon Rd', 'src': 'CHP', 'g': clip_line(pch, -118.792, -118.687)},
    {'m': 34, 'name': 'Kanan Dume Rd closed, PCH to Mulholland Hwy', 'src': 'Caltrans', 'g': rnd(mapping(LineString(canyon['Kanan Dume Rd'][:4])))},
]

places = [
    ['Leo Carrillo', -118.934, 34.046], ['Zuma Beach', -118.826, 34.021], ['Point Dume', -118.807, 34.000],
    ['Paradise Cove', -118.786, 34.016], ['Pepperdine', -118.709, 34.044], ['Malibu Pier', -118.677, 34.032],
    ['Topanga', -118.601, 34.094], ['Calabasas', -118.640, 34.152], ['Agoura Hills', -118.762, 34.152],
    ['Pacific Palisades', -118.528, 34.050], ['Corral Canyon', -118.733, 34.068], ['Malibu Creek State Park', -118.716, 34.100],
]

out = {'land': {'type': 'FeatureCollection', 'features': [feat_land]},
       'hoods': {'type': 'FeatureCollection', 'features': lines},
       'roads': {'type': 'FeatureCollection', 'features': roads},
       'stages': stages, 'zones': zones, 'closures': closures, 'places': places, 'origin': O}
s = json.dumps(out, separators=(',', ':'))
open('malibu.json', 'w').write(s)
print(len(s), [(x['m'], x['acres']) for x in stages])
