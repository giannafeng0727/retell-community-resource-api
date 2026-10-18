(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LIVE = new URLSearchParams(location.search).get('demo') !== '1';

/* ---------- clock ---------- */
const T0 = 16 * 60 + 2;          // fire first reported at 4:02 PM (drill minute 0)
const LOAD_T = 9;                // the page opens at 4:11 PM
const SEC_PER_MIN = 10;          // 1 drill minute = 10 real seconds at 1x
const fmt = m => {
  if (LIVE) return new Date(m * 60000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const x = Math.floor(T0 + m + 1e-6); let h = Math.floor(x / 60) % 24; const mm = ((x % 60) + 60) % 60; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(mm).padStart(2, '0') + ' ' + ap;
};
const dur = m => { m = Math.max(0, Math.floor(m + 1e-6)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };

/* ---------- random ---------- */
let seed = 1;
function rng() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const pick = a => a[Math.floor(rng() * a.length)];
const wpick = pairs => { let s = 0; for (const p of pairs) s += p[1]; let r = rng() * s; for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; } return pairs[pairs.length - 1][0]; };
function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
const gauss = () => (rng() + rng() + rng() - 1.5) / 1.5;

/* ---------- geometry ---------- */
const KX = 92.2, KY = 111.0;
const LAND = MAPDATA.land.features[0].geometry;
const PCH = MAPDATA.roads.features.find(f => f.properties.c === 'pch').geometry.coordinates;
function inRing(p, r) { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }
function inPoly(p, g) { if (!g) return false; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; for (const poly of polys) { if (inRing(p, poly[0])) { let hole = false; for (let k = 1; k < poly.length; k++) if (inRing(p, poly[k])) hole = true; if (!hole) return true; } } return false; }
function segDist(p, a, b) { const ax = (a[0] - p[0]) * KX, ay = (a[1] - p[1]) * KY, bx = (b[0] - p[0]) * KX, by = (b[1] - p[1]) * KY, dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? -(ax * dx + ay * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(ax + t * dx, ay + t * dy); }
function lineDist(p, g) { if (!g) return 1e9; const ls = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []; let d = 1e9; for (const l of ls) for (let i = 1; i < l.length; i++) d = Math.min(d, segDist(p, l[i - 1], l[i])); return d; }
function pchLat(x) { for (let i = 1; i < PCH.length; i++) { const a = PCH[i - 1], b = PCH[i]; if ((a[0] - x) * (b[0] - x) <= 0) { const t = (x - a[0]) / ((b[0] - a[0]) || 1); return a[1] + t * (b[1] - a[1]); } } return 34.03; }

/* ---------- reference tables ---------- */
const TIERS = ['Red flag', 'Person now', 'Person soon', 'AI follow-up', 'Info'];
const NEED = {
  mobility_assistance: [28, 'Can’t leave without help'],
  medical_device_power: [24, 'Power for a medical device'],
  medication: [24, 'Needs medication'],
  evacuation_transport: [20, 'Needs a ride out'],
  shelter: [12, 'Needs shelter tonight'],
  food_water: [8, 'Food or water'],
  pets: [8, 'Help moving animals'],
  other: [8, 'Which roads are open'],
  info: [3, 'Information only']
};
const CONF = { caller_confirmed: [1, 'Caller confirmed'], landmark: [0.8, 'Landmark'], approximate: [0.7, 'Approximate'], unknown: [0.6, 'Unknown'] };
const block = (lo, hi, st) => (Math.floor((lo + rng() * (hi - lo)) / 100) * 100) + ' block of ' + st;
const HOT = {
  zuma:     { c: [-118.826, 34.0195], s: 0.35, vis: 0.85, conf: 'landmark', name: 'Zuma Beach', addr: () => 'Zuma Beach, parking lot ' + (1 + Math.floor(rng() * 12)) },
  dume:     { c: [-118.801, 34.007], s: 0.45, vis: 0.12, conf: 'caller_confirmed', name: 'Point Dume', addr: () => block(6000, 7400, pick(['Cliffside Dr', 'Dume Dr', 'Fernhill Dr', 'Grayfox St', 'Birdview Ave', 'Wildlife Rd', 'Zumirez Dr'])) },
  paradise: { c: [-118.787, 34.0215], s: 0.16, vis: 0.8, conf: 'landmark', name: 'Paradise Cove', addr: () => 'Paradise Cove, beach parking' },
  latigo:   { c: [-118.761, 34.062], s: 0.55, vis: 0.25, conf: 'caller_confirmed', name: 'Latigo Canyon', addr: () => block(2000, 4800, 'Latigo Canyon Rd') },
  corral:   { c: [-118.735, 34.056], s: 0.45, vis: 0.15, conf: 'caller_confirmed', name: 'Corral Canyon', addr: () => block(3000, 4400, 'Corral Canyon Rd') },
  escondido:{ c: [-118.768, 34.0285], s: 0.28, vis: 0.6, conf: 'landmark', name: 'Escondido Beach', addr: () => 'Escondido Beach, by PCH' },
  pch:      { c: [-118.748, 34.031], s: 0.9, vis: 0.6, conf: 'approximate', name: 'PCH', pch: true, addr: () => 'On PCH near ' + pick(['Latigo Canyon', 'Corral Canyon', 'Puerco Canyon', 'Escondido Beach', 'Kanan Dume Rd']) + ', ' + pick(['north', 'south']) + 'bound' },
  pep:      { c: [-118.709, 34.0425], s: 0.3, vis: 0.35, conf: 'landmark', name: 'Pepperdine', addr: () => 'Pepperdine University, ' + pick(['Seaver Dr', 'Drescher campus', 'Alumni Park']) },
  solstice: { c: [-118.748, 34.043], s: 0.3, vis: 0.7, conf: 'landmark', name: 'Solstice Canyon', addr: () => 'Solstice Canyon trail' },
  mcsp:     { c: [-118.722, 34.097], s: 0.5, vis: 0.7, conf: 'approximate', name: 'Malibu Creek State Park', addr: () => 'Malibu Creek State Park, Crags Rd trail' },
  kanan:    { c: [-118.791, 34.060], s: 0.45, vis: 0.2, conf: 'caller_confirmed', name: 'Kanan Dume Rd', addr: () => block(5000, 7800, 'Kanan Dume Rd') },
  pier:     { c: [-118.677, 34.0355], s: 0.18, vis: 0.9, conf: 'landmark', name: 'Malibu Pier', addr: () => 'Malibu Pier' },
  matador:  { c: [-118.876, 34.0395], s: 0.22, vis: 0.9, conf: 'landmark', name: 'El Matador Beach', addr: () => 'El Matador State Beach' },
  bluffs:   { c: [-118.695, 34.0345], s: 0.35, vis: 0.2, conf: 'caller_confirmed', name: 'Malibu Road', addr: () => block(23000, 25400, 'Malibu Rd') }
};
const ORIG = {
  us: { lang: 'English', f: ['Emily','Jake','Megan','Ryan','Olivia','Ethan','Sarah','Brandon','Lauren','Tyler','Jessica','Kevin','Rachel','Andrew','Hannah','Chris','Taylor','Jordan','Morgan','Dylan','Grace','Noah','Ava','Mason','Chloe','Liam'], l: ['Carter','Morrison','Bennett','Hayes','Coleman','Foster','Russell','Griffin','Sullivan','Brooks','Price','Jenkins','Perry','Powell','Patterson','Hughes','Butler','Simmons','Wallace','Ward','Turner','Parker'], homes: [['Phoenix, AZ','602'],['Las Vegas, NV','702'],['Austin, TX','512'],['Seattle, WA','206'],['Chicago, IL','312'],['New York, NY','917'],['Denver, CO','303']] },
  es: { lang: 'Spanish', f: ['María','José','Lucía','Carlos','Ana','Diego','Sofía','Javier','Camila','Miguel','Valentina','Luis','Gabriela','Andrés'], l: ['Hernández','García','Morales','Reyes','Castillo','Flores','Ramírez','Torres','Vargas','Mendoza','Ortiz','Ruiz'], homes: [['Guadalajara, Mexico'],['Mexico City, Mexico'],['Monterrey, Mexico']] },
  zh: { lang: 'Mandarin', fam: true, f: ['Wei','Li Na','Hao','Mei Lin','Jun','Xiu Ying','Yang','Jing','Lei','Fang'], l: ['Chen','Zhang','Liu','Wang','Huang','Zhao','Wu','Zhou','Lin'], homes: [['Shanghai, China'],['Beijing, China'],['Taipei, Taiwan']] },
  kr: { lang: 'Korean', fam: true, f: ['Ji-ho','Min-jun','Seo-yeon','Ji-woo','Ha-eun','Do-yun'], l: ['Kim','Lee','Park','Choi','Jung','Kang'], homes: [['Seoul, South Korea'],['Busan, South Korea']] },
  jp: { lang: 'Japanese', fam: true, f: ['Haruto','Yui','Sota','Aoi','Ren','Hina'], l: ['Sato','Suzuki','Takahashi','Tanaka','Ito','Watanabe'], homes: [['Tokyo, Japan'],['Osaka, Japan']] },
  uk: { lang: 'English', f: ['Oliver','Amelia','George','Isla','Harry','Poppy'], l: ['Hughes','Clarke','Evans','Walsh','Wright','Thompson'], homes: [['London, UK'],['Manchester, UK']], uk: true },
  au: { lang: 'English', f: ['Lachlan','Chloe','Mitchell','Matilda','Riley','Ruby'], l: ['Nguyen','Kelly','Ryan','Campbell','Stewart','Murphy'], homes: [['Sydney, Australia'],['Melbourne, Australia']] },
  de: { lang: 'German', f: ['Lukas','Anna','Felix','Lena','Jonas','Marie'], l: ['Becker','Schmidt','Wagner','Fischer','Weber','Hoffmann'], homes: [['Munich, Germany'],['Hamburg, Germany']] },
  fr: { lang: 'French', f: ['Camille','Louis','Chloé','Hugo','Léa','Jules'], l: ['Dubois','Martin','Bernard','Moreau','Laurent','Lefèvre'], homes: [['Paris, France'],['Lyon, France']] }
};
const REP_NAMES = ['Ana','Marcus','Priya','Tom','Grace','Luis','Kenji','Dana','Omar','Beth','Sam','Ivy','Raúl','Nina','Theo'];
const EVENTS = [
  { m: 2,  src: 'Callers', unv: true, text: 'First calls report smoke above Corral Canyon' },
  { m: 11, src: 'Callers', unv: true, text: '4 callers say flames have crossed Latigo Canyon Rd' },
  { m: 14, src: 'CAL FIRE', text: 'Solstice Fire confirmed, about 320 acres, 0% contained' },
  { m: 18, src: 'LA County OEM', text: 'Evacuation order for Latigo–Corral Canyon. Warning for Point Dume–Paradise Cove' },
  { m: 24, src: 'CHP', text: 'PCH closed both ways from Kanan Dume Rd to Malibu Canyon Rd' },
  { m: 28, src: 'LA County OEM', text: 'Order expanded to Point Dume–Paradise Cove. New warnings for Zuma Beach–Kanan and Malibu Bluffs–Pepperdine' },
  { m: 34, src: 'Caltrans', text: 'Kanan Dume Rd closed from PCH to Mulholland Hwy' },
  { m: 40, src: 'CAL FIRE', text: 'Solstice Fire about 2,280 acres, 0% contained, moving toward Point Dume' }
];
const RESOURCES = [
  { resource_id: 'shelter_m01', name: 'Evacuation center, Pierce College', types: ['shelter', 'food', 'water'], address: '6201 Winnetka Ave, Woodland Hills', capacity_remaining: 240, accepts_pets: true, medical_power_available: true, languages: ['English', 'Spanish'] },
  { resource_id: 'shelter_m02', name: 'Evacuation center, Westwood Recreation Center', types: ['shelter', 'food', 'water'], address: '1350 S Sepulveda Blvd, Los Angeles', capacity_remaining: 85, accepts_pets: false, medical_power_available: true, languages: ['English', 'Spanish', 'Mandarin'] },
  { resource_id: 'transport_m01', name: 'County evacuation bus', types: ['transportation'], address: 'Picks up along PCH west of Kanan Dume Rd', capacity_remaining: 30, accepts_pets: true, medical_power_available: false, languages: ['English', 'Spanish'] }
];

/* ---------- scripted callers ---------- */
const HEROES = [
  { at: 3.2, name: 'Daniel Okafor', phone: '(310) 555-0142', origin: 'us', home: 'Resident, Santa Monica', people: 3, need: 'evacuation_transport', loc: [-118.7505, 34.0512], addr: 'Solstice Canyon trail, near the Tropical Terrace ruins', conf: 'landmark', danger: true, casualty: 'Friend coughing, trouble breathing', bad: true,
    convo: [['c','We’re on the Solstice Canyon trail near the old house ruins. Smoke is coming down the canyon.'],['a','Is anyone hurt?'],['c','My friend is coughing a lot and can’t catch her breath.'],['a','Please call 911 now. I’m flagging this for a coordinator too. If you can, walk downhill toward the parking lot and stay low.']] },
  { at: 5, name: 'Ruth Abernathy', phone: '(310) 555-0187', origin: 'us', age: 78, people: 1, need: 'medical_device_power', medpower: true, access: true, transport: true, loc: [-118.7372, 34.0602], addr: '3400 block of Corral Canyon Rd', conf: 'caller_confirmed', escAt: 10.5, escText: 'Called again: smoke is in the house and she can’t leave alone',
    convo: [['c','I’m on oxygen and the power just went out. The concentrator battery lasts about two hours.'],['a','Thank you, Ruth. Is anyone with you?'],['c','No. I don’t drive anymore, and my daughter is in Pasadena.'],['a','I’ve saved your request and marked it urgent. A coordinator will call you back on this number.']] },
  { at: 6.5, name: 'Lucía Morales', phone: '(424) 555-0119', origin: 'es', visitor: true, home: 'Visitor from Guadalajara, Mexico', people: 5, kids: 3, need: 'other', loc: [-118.7628, 34.0668], addr: 'Vacation rental, 2700 block of Latigo Canyon Rd', conf: 'caller_confirmed', escAt: 8.2, escText: 'Called again: flames visible across the road',
    convo: [['c','Estamos en una casa de renta en Latigo Canyon. No conocemos las calles. ¿Por dónde salimos?'],['a','(Spanish) Drive down Latigo Canyon Road to the coast, then turn left on PCH toward Santa Monica.'],['c','Vemos llamas al otro lado del camino. Tengo tres niños.'],['a','(Spanish) If the road is blocked by fire, call 911 now. I’m sending a coordinator to call you back.']] },
  { at: 8, name: 'Hannah Becker', phone: '(424) 555-0163', origin: 'de', visitor: true, home: 'Visitor from Munich, Germany', people: 3, kids: 1, need: 'evacuation_transport', transport: true, loc: [-118.8285, 34.0205], addr: 'Zuma Beach, parking lot 6', conf: 'landmark', lang: 'German',
    convo: [['c','We are at Zuma Beach. We came with a rideshare and now no driver accepts. We see smoke.'],['a','(Agent continued in English) Is anyone hurt? How many people are with you?'],['c','Nobody is hurt. Me, my husband and our son, he is six.'],['a','I’ve saved your request for a ride out. Stay near the lifeguard tower at lot 6. A coordinator will call you back.']] },
  { at: 10.5, name: 'Chen Wei-ming', phone: '(310) 555-0128', origin: 'zh', age: 81, people: 2, need: 'mobility_assistance', access: true, transport: true, loc: [-118.7985, 34.0093], addr: '6300 block of Birdview Ave, Point Dume', conf: 'caller_confirmed',
    convo: [['c','（普通话）我和太太在家。她用助行器，我晚上不能开车。'],['a','(Mandarin) Translated: “My wife and I are at home. She uses a walker and I can’t drive at night.”'],['a','(Mandarin) I’ve saved your request for help leaving. A coordinator who speaks Mandarin will call you back.']] },
  { at: 12.5, name: 'Jasmine Reyes', phone: '(818) 555-0174', origin: 'us', home: 'Pepperdine student', people: 7, need: 'shelter', loc: [-118.7095, 34.0418], addr: 'Pepperdine University, Seaver Dr', conf: 'landmark',
    convo: [['c','There are seven of us in a dorm lounge. Campus says shelter in place, but our parents want us to leave. Where do we go?'],['a','Pepperdine is not under an order right now. If that changes, the nearest evacuation center is Pierce College in Woodland Hills.']] },
  { at: 15, name: 'Marco Bellini', phone: '(702) 555-0151', origin: 'us', visitor: true, home: 'Visitor from Las Vegas, NV', people: 2, need: 'evacuation_transport', pet: true, transport: true, loc: [-118.7325, 34.0336], addr: 'On PCH near Corral Canyon, northbound', conf: 'approximate',
    convo: [['c','My car is overheating in this traffic. I have my dog with me. The smoke is getting thick.'],['a','Can you pull off safely? I’ve saved your request and asked a coordinator to call you back.']] },
  { at: 19, name: 'Kim Ji-ho', phone: '(424) 555-0136', origin: 'kr', visitor: true, home: 'Visitor from Seoul, South Korea', people: 4, need: 'evacuation_transport', loc: [-118.7275, 34.1015], addr: 'Malibu Creek State Park, somewhere on a trail', conf: 'unknown', escAt: 31, escText: 'Called again: smoke all around, phone at 8%',
    convo: [['c','We are hiking and we lost the trail. My phone has 12 percent.'],['a','(Agent continued in English) Can you see a sign, a road or the creek?'],['c','Only rocks and a big hill. We see smoke behind us.'],['a','I’ve saved your request. Stay together and save your battery. A coordinator will call you back.']] },
  { at: 22, name: 'Natalie Brooks', phone: '(310) 555-0109', origin: 'us', home: 'Event planner, wedding at Paradise Cove', people: 8, kids: 6, need: 'evacuation_transport', transport: true, loc: [-118.7868, 34.0222], addr: 'Paradise Cove, beach parking', conf: 'landmark',
    convo: [['c','I’m running a wedding at Paradise Cove with forty guests. The shuttle bus left and PCH is jammed. There are kids and grandparents.'],['a','I’ve saved this as a group of eight or more. A coordinator will call you back about a bus.']] },
  { at: 26, name: 'Aisha Rahman', phone: '(310) 555-0193', origin: 'us', people: 3, kids: 1, need: 'medical_device_power', medpower: true, access: true, loc: [-118.8032, 34.0118], addr: '6700 block of Wildlife Rd, Point Dume', conf: 'caller_confirmed',
    convo: [['c','My son is on a home ventilator. If the power goes out we have about four hours of battery.'],['a','I’ve saved your request and marked it urgent. A coordinator will call you back on this number.']] },
  { at: 30, name: 'Mateo (child caller)', phone: '(805) 555-0147', origin: 'es', lang: 'English', age: null, people: 2, kids: 2, childAlone: true, need: 'evacuation_transport', loc: [-118.7905, 34.0575], addr: '5800 block of Kanan Dume Rd', conf: 'caller_confirmed',
    convo: [['c','I’m home with my little sister. My mom is at work. There’s a lot of smoke outside.'],['a','You did the right thing calling. Please stay inside with your sister. I’m getting a person to call you right now.']] },
  { at: 36, name: 'Frank Delgado', phone: '(818) 555-0158', origin: 'us', age: 70, people: 1, need: 'pets', pet: true, loc: [-118.7685, 34.0745], addr: '3900 block of Latigo Canyon Rd', conf: 'caller_confirmed',
    convo: [['c','I have two horses and my trailer has a flat. I’m not leaving without them.'],['a','I’ve saved your request for help moving large animals. A coordinator will call you back.']] }
];

/* ---------- scenarios ---------- */
const HERO_BY = n => HEROES.find(h => h.name === n);
const SMALL_EVENTS = [
  { m: 2,  src: 'Callers', unv: true, text: 'First calls report smoke above Corral Canyon' },
  { m: 11, src: 'Callers', unv: true, text: 'Callers report flames on the ridge above Latigo Canyon Rd' },
  { m: 14, src: 'CAL FIRE', text: 'Solstice Fire confirmed, about 120 acres, 0% contained' },
  { m: 18, src: 'LA County OEM', text: 'Evacuation warning for Latigo–Corral Canyon. No orders' },
  { m: 26, src: 'CAL FIRE', text: 'Forward spread stopped at about 120 acres, 20% contained' },
  { m: 44, src: 'LA County OEM', text: 'Evacuation warning lifted for Latigo–Corral Canyon' }
];
const SCEN = {
  small: {
    label: 'Small wildfire', calls: '~50 calls', share: 0.5, maxStage: 9, closures: false,
    rate: t => t < 0 ? 0 : (0.35 + 1.3 / (1 + Math.exp(-(t - 10) / 4))) * (t > 30 ? Math.exp(-(t - 30) / 6) : 1),
    zones: () => [Object.assign({}, MAPDATA.zones[0], { steps: [[18, 'warning'], [44, null]] })],
    events: SMALL_EVENTS,
    heroes: ['Daniel Okafor', 'Ruth Abernathy', 'Lucía Morales', 'Hannah Becker', 'Kim Ji-ho', 'Frank Delgado']
  },
  large: {
    label: 'Large-scale disaster', calls: '2,000+ calls', share: 0.12, maxStage: 999, closures: true,
    rate: t => t < 0 ? 0 : 3 + 70 / (1 + Math.exp(-(t - 14) / 4)),
    zones: () => MAPDATA.zones, events: EVENTS, heroes: null
  }
};
const sc = () => SCEN[S.scen];
let ZONES = [], HLIST = HEROES;
const zones = () => ZONES;

/* ---------- state ---------- */
let S;
function fresh(scen) {
  seed = 20261017;
  S = { t: LIVE ? Date.now() / 60000 : -25, mode: 'everyday', scen: scen || 'small', paused: false, cases: [], sel: null, filter: 'open', q: '', limit: 40,
        crisisAt: null, alertAt: null, calls: 0, fireCalls: 0, info: 0, heroIdx: 0, nextId: 1, view: 'main', scoredAt: -99,
        reps: REP_NAMES.map((n, i) => ({ n: 'Rep ' + String(i + 1).padStart(2, '0') + ' · ' + n, on: i < 3, onAt: null, busy: null, until: 0, leave: false })) };
}
const byId = id => S.cases.find(c => c.id === id);

/* ---------- map state lookups ---------- */
function fireStage(t = S.t) { if (LIVE) return null; let s = null; for (const st of MAPDATA.stages) if (st.m <= Math.min(t, sc().maxStage)) s = st; return s; }
const official = (t = S.t) => !LIVE && t >= 14;
function zoneKind(z, t = S.t) { let k = null; for (const s of z.steps) if (s[0] <= t) k = s[1]; return k; }
function zoneAt(p) { let best = null; for (const z of zones()) { const k = zoneKind(z); if (k && inPoly(p, z.g)) { if (k === 'order') return 'order'; best = 'warning'; } } return best; }
const closuresNow = () => !LIVE && sc().closures ? MAPDATA.closures.filter(c => c.m <= S.t) : [];

/* ---------- score (PRD v2) ---------- */
function hazard(c) {
  const p = c.loc, f = fireStage();
  const inFire = !!f && inPoly(p, f.g);
  const dF = f ? (inFire ? 0 : lineDist(p, f.g)) : 1e9;
  const z = zoneAt(p);
  const near = closuresNow().some(cl => lineDist(p, cl.g) < 0.5);
  let hz = 0; const why = [];
  if (inFire) { hz = 25; why.push(official() ? 'inside the fire perimeter' : 'inside the area callers report burning'); }
  if (z === 'order') { hz = 25; why.push('inside an evacuation order'); }
  else if (z === 'warning') { hz = Math.max(hz, 16); why.push('inside an evacuation warning'); }
  if (!inFire && dF < 1) { hz = Math.max(hz, 12); why.push('within 1 km of the fire'); }
  if (near) { hz = Math.max(hz, 6); why.push('next to a road closure'); }
  return { hz, inFire, dF, z, why };
}
function score(c) {
  const h = hazard(c), lc = CONF[c.conf][0];
  const need = NEED[c.need][0];
  const hz = Math.round(h.hz * lc * 10) / 10;
  let time = 0;
  if (h.inFire || h.dF < 1 || c.danger || c.bad || c.childAlone) time = 12; else if (c.medpower || c.need === 'medication' || h.z === 'order') time = 8; else if (h.z === 'warning') time = 4;
  let v = 0; if (c.kids > 0) v += 4; if (c.elderly) v += 4; if (c.access) v += 5; if (c.transport) v += 3; if (c.lang !== 'English') v += 2; if (c.visitor) v += 2; v = Math.min(15, v);
  const pp = c.people >= 7 ? 8 : c.people >= 4 ? 6 : c.people >= 2 ? 4 : 2;
  const end = c.status === 'resolved' ? c.resolvedAt : S.t;
  const wait = Math.min(12, Math.floor(Math.max(0, end - c.at) / 2));
  const total = Math.min(100, Math.round(need + hz + time + v + pp + wait));
  const red = c.danger || c.bad || c.childAlone;
  let tier = red ? 0 : total >= 70 ? 1 : total >= 50 ? 2 : total >= 25 ? 3 : 4;
  c.unsure = !red && tier > 2 && c.conf === 'unknown' && h.hz > 0;
  if (c.unsure) tier = 2;
  c.parts = { need, hz, hzRaw: h.hz, lc, time, v, pp, wait }; c.score = total; c.tier = tier; c.h = h;
}
const scoreAll = () => { for (const c of S.cases) if (c.status !== 'resolved') score(c); };

/* ---------- caller generation ---------- */
function phoneFor(o, visitorHome) {
  if (o.uk) return '+44 7700 900' + String(Math.floor(rng() * 1000)).padStart(3, '0');
  const ac = visitorHome && visitorHome[1] ? visitorHome[1] : pick(['310', '424', '818', '805']);
  return '(' + ac + ') 555-01' + String(Math.floor(rng() * 100)).padStart(2, '0');
}
function nameFor(o) { const f = pick(o.f), l = pick(o.l); return o.fam ? l + ' ' + f : f + ' ' + l; }
function placeAt(hot) {
  for (let i = 0; i < 12; i++) {
    let x = hot.c[0] + gauss() * hot.s / KX, y = hot.c[1] + gauss() * (hot.pch ? 0.08 : hot.s) / KY;
    if (hot.pch) { x = hot.c[0] + (rng() - 0.5) * 2 * hot.s * 4 / KX; y = pchLat(x) + gauss() * 0.06 / KY; return [x, y]; }
    if (inPoly([x, y], LAND)) return [x, y];
  }
  return hot.c.slice();
}
function hotWeights(t, kind) {
  if (kind === 'everyday') return [['pier', 3], ['zuma', 3], ['matador', 1.5], ['bluffs', 1.5], ['dume', 1], ['pep', 1]];
  const k = 1 / (1 + Math.exp(-(t - 16) / 5));
  const early = { corral: 3, latigo: 3, solstice: 2, mcsp: 1.5, pch: 2, kanan: 1, escondido: 1, zuma: 1, dume: 1, pep: 0.5 };
  const late = { zuma: 3, dume: 3, paradise: 2, pch: 2.5, escondido: 1.5, pep: 2, latigo: 1.5, corral: 1, kanan: 1.5, bluffs: 1, matador: 0.5, pier: 0.5, mcsp: 0.8, solstice: 0.5 };
  return Object.keys(HOT).map(h => [h, (early[h] || 0) * (1 - k) + (late[h] || 0) * k]).filter(p => p[1] > 0);
}
function code() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = 'RL-'; for (let i = 0; i < 6; i++) s += a[Math.floor(rng() * a.length)]; return s; }

function genCase(kind) {
  const hotKey = wpick(hotWeights(S.t, kind)), hot = HOT[hotKey];
  const visitor = rng() < hot.vis;
  const okey = visitor ? wpick([['us', .35], ['es', .12], ['uk', .1], ['au', .07], ['de', .07], ['fr', .06], ['zh', .1], ['kr', .06], ['jp', .07]])
                       : wpick([['us', .66], ['es', .16], ['zh', .08], ['kr', .06], ['jp', .04]]);
  const o = ORIG[okey];
  let lang = o.lang; if (lang !== 'English' && rng() < (visitor ? 0.3 : 0.5)) lang = 'English';
  const vh = visitor ? pick(o.homes) : null;
  const people = visitor ? wpick([[1, .15], [2, .35], [3, .2], [4, .18], [5, .08], [6, .04]]) : wpick([[1, .35], [2, .35], [3, .15], [4, .1], [5, .05]]);
  const kids = people >= 3 && rng() < 0.45 ? 1 + Math.floor(rng() * Math.min(3, people - 2)) : 0;
  const elderly = rng() < (visitor ? 0.08 : 0.24);
  let need;
  if (kind === 'everyday') need = rng() < 0.75 ? 'info' : 'other';
  else if (visitor) need = wpick([['evacuation_transport', .26], ['shelter', .22], ['other', .3], ['pets', .04], ['food_water', .1], ['mobility_assistance', .04], ['medication', .04]]);
  else need = wpick([['other', .3], ['mobility_assistance', elderly ? .3 : .08], ['medical_device_power', .07], ['medication', .05], ['pets', .16], ['shelter', .12], ['evacuation_transport', .1], ['food_water', .08]]);
  let conf = rng() < 0.72 ? hot.conf : wpick([['caller_confirmed', .3], ['landmark', .3], ['approximate', .3], ['unknown', .1]]);
  const c = {
    id: 'c' + (S.nextId++), code: code(), kind, hot: hotKey, name: nameFor(o), phone: phoneFor(o, vh), origin: okey, lang, visitor,
    home: visitor ? 'Visitor from ' + vh[0] : 'Resident', age: elderly ? 65 + Math.floor(rng() * 22) : null, elderly, people, kids,
    need, access: need === 'mobility_assistance' || (elderly && rng() < 0.3), medpower: need === 'medical_device_power',
    transport: need === 'evacuation_transport' || (elderly && rng() < 0.35) || (visitor && rng() < 0.15),
    pet: need === 'pets' || (!visitor && rng() < 0.18), place: hot.name, conf, loc: placeAt(hot), addr: hot.addr(), at: S.t, calls: 1,
    danger: false, dangerAt: null, casualty: 'None reported', bad: false, childAlone: false, status: 'saved', rep: null, timeline: [], convo: []
  };
  if (kind === 'fire') {
    score(c);
    const close = c.h.inFire || c.h.dF < 0.8;
    if (rng() < (close ? 0.3 : 0.03)) {
      c.danger = true; c.dangerAt = S.t;
      const cas = wpick([['Smoke, trouble breathing', .35], ['Minor burns', .1], ['Fell and hurt an ankle', .1], ['None reported', .45]]);
      c.casualty = cas; c.bad = cas !== 'None reported';
    }
  }
  c.convo = convoFor(c, hot);
  return c;
}
function convoFor(c, hot) {
  const tr = c.lang !== 'English' ? ' (translated from ' + c.lang + ')' : '';
  if (c.kind === 'everyday') {
    const q = pick([['Is PCH open all the way to Santa Monica?', 'Yes, PCH is open. Expect weekend traffic near Malibu Pier.'], ['What time does Zuma Beach parking close?', 'Zuma Beach parking is open until sunset.'], ['The power has been out on our street since noon. Who do I call?', 'I can report it to the utility for you and text you their outage page.'], ['A branch is blocking our driveway. Who handles that?', 'I’ve saved a request for public works and texted you the reference.'], ['Is there a shuttle from the pier to the Getty Villa?', 'There’s no shuttle today. Rideshare pickups are at the pier lot.']]);
    return [['c', q[0] + tr], ['a', q[1]]];
  }
  const open = {
    zuma: 'We’re at ' + c.addr + '. There’s smoke coming over the hills.', paradise: 'We’re at Paradise Cove. Ash is falling on the beach.',
    pch: 'We’re stuck in traffic on PCH. Nothing is moving and the smoke is getting closer.', dume: 'I live on Point Dume. Do we need to leave?',
    latigo: 'I’m at home on Latigo Canyon Rd. I can see flames on the ridge.', corral: 'I’m on Corral Canyon Rd. The smoke is very thick.',
    solstice: 'We’re hiking in Solstice Canyon and smoke is coming down.', mcsp: 'We’re hiking in Malibu Creek State Park and we see smoke.',
    pep: 'We’re at Pepperdine. What should we do?', kanan: 'I’m on Kanan Dume Rd. Is it safe to drive up to the 101?'
  }[c.hot] || ('I’m at ' + c.addr + '. There’s smoke and ash here.');
  const second = {
    evacuation_transport: 'We don’t have a car. We came by rideshare and no drivers are accepting.',
    shelter: c.visitor ? 'We’re visiting and have nowhere to stay tonight.' : 'If we leave, where can we go tonight?',
    other: 'Which way is open, up Kanan to the 101 or east toward Santa Monica?',
    mobility_assistance: 'My mother can’t walk far. She uses a wheelchair.',
    medical_device_power: 'My husband needs power for his breathing machine.',
    medication: 'My medication is at home and I can’t get back to it.',
    pets: 'I have two dogs and a cat. Will the shelter take them?',
    food_water: 'We’ve been in the car for two hours with no water.'
  }[c.need];
  const l = [['c', open + tr], ['c', second]];
  if (c.danger) l.push(['c', c.bad ? c.casualty + '. Please hurry.' : 'The fire is really close to us.'], ['a', 'Please call 911 now. I’ve flagged you for a coordinator, who will call you back on this number.']);
  else l.push(['a', 'Thank you. I’ve saved your request, reference ' + c.code + '. A coordinator will call you back on this number. If anyone is hurt or the fire reaches you, call 911.']);
  return l;
}
function makeHero(h) {
  const o = ORIG[h.origin];
  const c = {
    id: 'c' + (S.nextId++), code: code(), kind: 'fire', hot: 'hero', name: h.name, phone: h.phone, origin: h.origin, lang: h.lang || o.lang, visitor: !!h.visitor,
    home: h.home || 'Resident', age: h.age || null, elderly: !!(h.age && h.age >= 65), people: h.people, kids: h.kids || 0, need: h.need,
    access: !!h.access, medpower: !!h.medpower, transport: !!h.transport, pet: !!h.pet, conf: h.conf, loc: h.loc.slice(), addr: h.addr, at: h.at, calls: 1,
    danger: !!h.danger, dangerAt: h.danger ? h.at : null, casualty: h.casualty || 'None reported', bad: !!h.bad, childAlone: !!h.childAlone,
    place: placeOf(h.addr), status: 'saved', rep: null, timeline: [], convo: h.convo, escAt: h.escAt, escText: h.escText, hero: true
  };
  return c;
}
function placeOf(a) {
  for (const [k, v] of [['Point Dume', 'Point Dume'], ['Latigo', 'Latigo Canyon'], ['Corral', 'Corral Canyon'], ['Zuma', 'Zuma Beach'], ['Paradise', 'Paradise Cove'], ['Pepperdine', 'Pepperdine'], ['Solstice', 'Solstice Canyon'], ['Malibu Creek', 'Malibu Creek State Park'], ['PCH', 'PCH'], ['Kanan', 'Kanan Dume Rd']]) if (a.includes(k)) return v;
  return a.split(',')[0];
}
function addCase(c) {
  c.timeline.push([c.at, 'Call saved by the agent · ' + c.code]);
  if (c.danger) c.timeline.push([c.at, 'Said they are in danger now']);
  if (c.childAlone) c.timeline.push([c.at, 'Caller is a child at home without an adult']);
  score(c); c.isNew = S.t > LOAD_T; S.cases.push(c);
}

/* ---------- reps ---------- */
function autoReason(c) {
  if (c.tier === 0) return 'Referred to 911, fire crews told';
  if (c.need === 'evacuation_transport') return 'Ride out arranged';
  if (c.need === 'shelter') return 'Sent to an evacuation center';
  if (c.need === 'info') return 'Question answered';
  if (c.need === 'pets') return 'Animal rescue team told';
  return 'Reached, leaving now';
}
function resolveCase(c, reason, who, t) { c.status = 'resolved'; c.resolvedAt = t; c.reason = reason; c.timeline.push([t, 'Resolved by ' + who + ': ' + reason]); }
function nextFor(t) {
  let best = null;
  for (const c of S.cases) {
    if (c.status !== 'saved' || c.at > t) continue;
    if (S.mode === 'crisis') { if (c.tier > 2) continue; if (!best || c.tier < best.tier || (c.tier === best.tier && c.score > best.score)) best = c; }
    else if (!best || c.at < best.at) best = c;
  }
  return best;
}
function repsStep(t) {
  for (const r of S.reps) {
    if (!r.on && r.onAt != null && t >= r.onAt) { r.on = true; r.onAt = null; }
    if (!r.on) continue;
    if (r.busy) {
      if (t < r.until) continue;
      const c = byId(r.busy);
      if (c && c.status === 'review' && c.rep === r.n) resolveCase(c, autoReason(c), r.n, t);
      r.busy = null;
    }
    if (r.leave) { r.on = false; r.leave = false; continue; }
    const c = nextFor(t);
    if (c) { c.status = 'review'; c.rep = r.n; c.reviewAt = t; c.timeline.push([t, r.n + ' took the case']); r.busy = c.id; r.until = t + (4 + rng() * 6) * (c.tier === 0 ? 1.2 : 1); }
  }
}

/* ---------- simulation step ---------- */
const EVERYDAY_RATE = 0.8;
const fireRate = t => sc().rate(t);
function step(dt) {
  const t1 = S.t + dt; S.t = t1;
  while (S.heroIdx < HLIST.length && HLIST[S.heroIdx].at <= t1) { addCase(makeHero(HLIST[S.heroIdx])); S.heroIdx++; S.calls++; S.fireCalls++; }
  for (let n = poisson(EVERYDAY_RATE * dt); n > 0; n--) { S.calls++; if (rng() < 0.35) addCase(genCase('everyday')); else S.info++; }
  if (t1 > 0) for (let n = poisson(fireRate(t1) * dt); n > 0; n--) { S.calls++; S.fireCalls++; if (rng() < sc().share) addCase(genCase('fire')); else S.info++; }
  for (const c of S.cases) {
    if (c.status === 'resolved' || c.danger || c.kind !== 'fire') continue;
    if (c.escAt != null && t1 >= c.escAt) { escalate(c, t1, c.escText); continue; }
    if (!c.hero && c.h && (c.h.inFire || c.h.dF < 0.7) && rng() < 0.1 * dt) escalate(c, t1, 'Called again: says the fire is close');
  }
  if (S.mode === 'crisis') for (const c of S.cases) if (c.status === 'saved' && c.tier >= 3 && !c.aiDone && t1 - c.at > 1.5) { c.aiDone = true; c.timeline.push([t1, 'Agent texted evacuation routes and the nearest shelter']); }
  if (t1 - S.scoredAt >= 0.5) { scoreAll(); S.scoredAt = t1; }
  repsStep(t1);
  if (S.alertAt == null && S.cases.filter(c => c.kind === 'fire').length >= 4) S.alertAt = t1;
}
function escalate(c, t, text) { c.danger = true; c.dangerAt = t; c.calls++; c.timeline.push([t, text]); score(c); }

function boot(scen) {
  fresh(scen);
  ZONES = LIVE ? [] : sc().zones(); HLIST = LIVE ? [] : (sc().heroes ? sc().heroes.map(HERO_BY) : HEROES);
  if (LIVE) return;
  while (S.t < LOAD_T) step(0.05);
  S.t = LOAD_T; scoreAll();
  const top = sorted(S.cases.filter(c => c.status !== 'resolved'), true)[0];
  S.sel = top ? top.id : null;
}

/* ---------- live Retell requests ---------- */
const LANGUAGE_NAMES = { 'en': 'English', 'en-us': 'English', 'es': 'Spanish', 'es-419': 'Spanish', 'zh': 'Mandarin', 'zh-cn': 'Mandarin', 'ko': 'Korean', 'ja': 'Japanese', 'de': 'German', 'fr': 'French' };
function liveLanguage(value) {
  const key = String(value || 'en').toLowerCase();
  return LANGUAGE_NAMES[key] || LANGUAGE_NAMES[key.split('-')[0]] || value || 'English';
}
function liveNeed(row) {
  if (row.medical_power_required) return 'medical_device_power';
  if (row.accessibility_required) return 'mobility_assistance';
  if (row.needs_transportation || row.resource_type === 'transportation') return 'evacuation_transport';
  if (row.has_pet || row.has_service_animal) return 'pets';
  if (row.resource_type === 'shelter') return 'shelter';
  if (row.resource_type === 'food' || row.resource_type === 'water') return 'food_water';
  return 'other';
}
function livePoint(row) {
  if (Number.isFinite(row.longitude) && Number.isFinite(row.latitude)) return [row.longitude, row.latitude];
  const text = String(row.caller_location || '').toLowerCase();
  for (const key of ['zuma', 'dume', 'paradise', 'latigo', 'corral', 'escondido', 'pch', 'pepperdine', 'solstice', 'malibu creek', 'kanan', 'pier', 'matador']) {
    if (text.includes(key)) return (key === 'pepperdine' ? HOT.pep : key === 'malibu creek' ? HOT.mcsp : HOT[key]).c.slice();
  }
  let hash = 0; for (const ch of String(row.id || text)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return [-118.75 + ((hash % 1000) / 999 - 0.5) * 0.12, 34.04 + (((hash >>> 10) % 1000) / 999 - 0.5) * 0.05];
}
function liveCase(row, old) {
  const at = Number.isFinite(Date.parse(row.created_at)) ? Date.parse(row.created_at) / 60000 : S.t;
  const resolved = ['resolved', 'closed', 'completed'].includes(String(row.status || '').toLowerCase());
  const reviewing = ['in_progress', 'review', 'assigned'].includes(String(row.status || '').toLowerCase());
  const phoneTail = String(row.callback_number || '').replace(/\D/g, '').slice(-4);
  const need = liveNeed(row);
  const c = {
    id: String(row.id), code: row.reference_code || String(row.id).slice(0, 8), kind: 'live', hot: 'live',
    name: row.caller_name || (phoneTail ? `Caller ••••${phoneTail}` : 'Retell caller'), phone: row.callback_number || 'Not provided',
    origin: 'us', lang: liveLanguage(row.preferred_language), visitor: false, home: 'Retell caller', age: null, elderly: false,
    people: Math.max(1, Number(row.people_count) || 1), kids: Math.max(0, Number(row.children_count) || 0), need,
    access: !!row.accessibility_required, medpower: !!row.medical_power_required, transport: !!row.needs_transportation,
    pet: !!row.has_pet || !!row.has_service_animal, place: row.caller_location || 'Location not provided',
    conf: CONF[row.location_confidence] ? row.location_confidence : 'unknown', loc: livePoint(row), addr: row.caller_location || 'Location not provided',
    at, calls: 1, danger: false, dangerAt: null, casualty: 'None reported', bad: false, childAlone: false,
    status: resolved ? 'resolved' : reviewing ? 'review' : 'saved', rep: reviewing ? 'Rep 00 · Coordinator' : null,
    resolvedAt: resolved ? (Date.parse(row.updated_at || row.created_at) / 60000) : null,
    reason: resolved ? 'Completed in Supabase' : null, timeline: [[at, 'Request saved by Retell · ' + (row.reference_code || row.id)]],
    convo: [['c', row.conversation_summary || `Requested ${NEED[need][1].toLowerCase()} at ${row.caller_location || 'an unknown location'}.`], ['a', `Request saved for coordinator follow-up${row.reference_code ? ' · ' + row.reference_code : ''}.`]],
    live: true, isNew: !old
  };
  score(c);
  c.score = Math.max(0, Math.min(100, Number(row.priority_score) || c.score));
  c.tier = row.priority === 'critical' ? 0 : row.priority === 'high' ? 1 : row.priority === 'normal' ? 2 : 3;
  return c;
}
let liveLoading = false;
async function syncLiveCases() {
  if (!LIVE || liveLoading) return;
  liveLoading = true;
  try {
    S.t = Date.now() / 60000;
    const response = await fetch('/api/assistance-requests/list?limit=200', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok || !body.success || !Array.isArray(body.requests)) throw new Error(body.error || 'Unable to load requests');
    const previous = new Map(S.cases.map(c => [c.id, c]));
    S.cases = body.requests.map(row => liveCase(row, previous.get(String(row.id))));
    S.calls = S.cases.length; S.fireCalls = 0; S.alertAt = null;
    if (!byId(S.sel)) S.sel = S.cases[0]?.id || null;
    renderAll();
  } catch (error) {
    console.error('Live request sync failed', error);
    if (!S.cases.length) toast('Could not load live Retell requests. Retrying…');
  } finally { liveLoading = false; }
}

/* ---------- list ---------- */
function sorted(list, bySeverity) {
  return list.slice().sort(bySeverity ? (a, b) => a.tier - b.tier || b.score - a.score || a.at - b.at : (a, b) => a.at - b.at);
}
const FILTERS = [
  ['open', 'All open', c => c.status !== 'resolved'],
  ['person', 'Needs a person', c => c.status !== 'resolved' && c.tier <= 2],
  ['red', 'Red flags', c => c.status !== 'resolved' && c.tier === 0],
  ['kids', 'Children', c => c.status !== 'resolved' && c.kids > 0],
  ['elderly', '65+', c => c.status !== 'resolved' && c.elderly],
  ['resolved', 'Resolved', c => c.status === 'resolved']
];
const short = l => ({ Spanish: 'ES', Mandarin: 'ZH', Korean: 'KO', Japanese: 'JA', German: 'DE', French: 'FR' }[l] || l);
const tierStyle = k => `--tc:var(--t${k})`;
function statusLabel(c) {
  if (c.status === 'resolved') return '<span class="st resolved"><i></i>Resolved</span>';
  if (c.status === 'review') return `<span class="st review"><i></i>In review · ${esc(c.rep === 'You' ? 'you' : c.rep.split(' · ')[1])}</span>`;
  return `<span class="st"><i></i>${c.aiDone ? 'Saved · AI answered' : 'Saved'}</span>`;
}
function rowHTML(c) {
  const tags = [];
  if (c.tier === 0) tags.push('<span class="tag rf">Red flag</span>');
  if (c.kids) tags.push(`<span class="tag ki">${c.kids} ${c.kids > 1 ? 'children' : 'child'}</span>`);
  tags.push(`<span class="tag">${c.people} ${c.people > 1 ? 'people' : 'person'}</span>`);
  if (c.lang !== 'English') tags.push(`<span class="tag">${short(c.lang)}</span>`);
  if (c.visitor) tags.push('<span class="tag">Visitor</span>');
  let wait;
  if (c.status === 'resolved') wait = `${fmt(c.resolvedAt)}<span>resolved</span>`;
  else if (c.status === 'review') wait = `${dur(S.t - c.at)}<span>${c.rep === 'You' ? 'you' : esc(c.rep.split(' · ')[1])}</span>`;
  else wait = `${dur(S.t - c.at)}<span>${c.aiDone ? 'AI answered' : 'waiting'}</span>`;
  return `<li><button type="button" class="rowc${c.isNew ? ' new' : ''}" data-id="${c.id}" aria-current="${S.sel === c.id}">
<span class="score"><span class="sc t${c.tier}" style="${tierStyle(c.tier)}">${c.score}</span><span class="tl" style="color:var(--t${c.tier})">${TIERS[c.tier]}</span></span>
<span class="who"><b>${esc(c.name)}${c.elderly ? ' <span class="tag el">65+</span>' : ''}</b><span class="mono">${esc(c.phone)}</span></span>
<span class="addr"><span class="l1">${esc(c.addr)}</span><span>${NEED[c.need][1]}</span></span>
<span class="tags">${tags.join('')}</span>
<span class="wait">${wait}</span>
<span class="chev" aria-hidden="true">›</span></button></li>`;
}
let listHover = false, listPending = false;
function renderList(force) {
  if (listHover && !force) { listPending = true; const n = $('#sortNote'); if (n && !n.querySelector('.paused')) n.insertAdjacentHTML('beforeend', ' · <span class="paused">Updates paused while you point at the list</span>'); return; }
  listPending = false;
  const crisis = S.mode === 'crisis';
  $('#sortNote').innerHTML = crisis ? 'Sorted by <b>severity score</b>, highest first' : LIVE ? 'Live Retell requests · refreshes every 10 seconds · sorted by <b>arrival</b>' : 'Sorted by <b>arrival</b>, oldest first · switch to crisis mode to sort by severity score';
  const open = S.cases.filter(c => c.status !== 'resolved');
  const red = open.filter(c => c.tier === 0);
  const redWait = red.filter(c => c.status === 'saved').map(c => S.t - c.at).sort((a, b) => a - b);
  const med = redWait.length ? Math.round(redWait[Math.floor(redWait.length / 2)]) : 0;
  const on = S.reps.filter(r => r.on).length;
  $('#stats').innerHTML = `<span><b class="num">${open.length}</b>open</span><span><b class="num">${open.filter(c => c.tier <= 2).length}</b>need a person</span><span class="hot"><b class="num">${red.length}</b>red flags</span><span><b class="num">${redWait.length ? med + ' min' : '–'}</b>median wait, red flags</span><span><b class="num">${on}</b>of 15 reps on shift</span><span><b class="num">${S.calls.toLocaleString()}</b>calls today</span>`;
  $('#filters').innerHTML = FILTERS.map(([k, label, fn]) => `<button type="button" class="fbtn" data-f="${k}" aria-pressed="${S.filter === k}">${label} <span class="n">${S.cases.filter(fn).length}</span></button>`).join('') +
    `<input class="search" id="q" type="search" placeholder="Search name, phone, place" aria-label="Search callers" value="${esc(S.q)}">`;
  const fn = FILTERS.find(f => f[0] === S.filter)[2];
  const q = S.q.trim().toLowerCase();
  let list = S.cases.filter(fn);
  if (q) list = list.filter(c => (c.name + ' ' + c.phone + ' ' + c.addr + ' ' + c.code + ' ' + c.lang + ' ' + NEED[c.need][1]).toLowerCase().includes(q));
  list = S.filter === 'resolved' ? list.sort((a, b) => b.resolvedAt - a.resolvedAt) : sorted(list, crisis);
  const focusId = document.activeElement && document.activeElement.classList.contains('rowc') ? document.activeElement.dataset.id : null;
  $('#rows').innerHTML = list.length ? list.slice(0, S.limit).map(rowHTML).join('') : '<li class="emptyl">No callers match this view.</li>';
  $('#more').hidden = list.length <= S.limit;
  S.order = list.slice(0, S.limit).map(c => c.id);
  for (const c of S.cases) c.isNew = false;
  if (focusId) { const el = document.querySelector(`.rowc[data-id="${focusId}"]`); if (el) el.focus({ preventScroll: true }); }
  if (qFocus) { const el = $('#q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}
let qFocus = false;

/* ---------- profile ---------- */
function resourceFor(c) {
  if (c.need === 'evacuation_transport') return RESOURCES[2];
  if (c.pet) return RESOURCES[0];
  if (c.lang === 'Mandarin') return RESOURCES[1];
  return RESOURCES[0];
}
function renderProfile() {
  const el = $('#profile'), c = byId(S.sel);
  if (!c) { el.innerHTML = '<div class="pempty">Select a caller on the map or in the list to see their profile.</div>'; return; }
  const p = c.parts;
  const tags = [`<span class="tag" style="color:var(--t${c.tier});border-color:color-mix(in srgb,var(--t${c.tier}) 45%,var(--line));font-weight:600">${c.score} · ${TIERS[c.tier]}</span>`];
  if (c.elderly) tags.push(`<span class="tag el">${c.age ? 'Age ' + c.age : '65+'}</span>`);
  if (c.kids) tags.push(`<span class="tag ki">${c.kids} ${c.kids > 1 ? 'children' : 'child'}</span>`);
  if (c.lang !== 'English') tags.push(`<span class="tag">${c.lang}</span>`);
  const dt = c.dangerAt != null
    ? `<div class="danger-time"><div class="k">Time since first call saying in danger</div><div class="v num" data-live="danger">${dur(S.t - c.dangerAt)}</div><div class="s">First said so at ${fmt(c.dangerAt)} · ${c.calls} ${c.calls > 1 ? 'calls' : 'call'} so far</div></div>`
    : `<div class="danger-time none"><div class="k">Time since first call saying in danger</div><div class="v">Hasn’t said they are in danger</div><div class="s">${c.calls} ${c.calls > 1 ? 'calls' : 'call'} so far · first at ${fmt(c.at)}</div></div>`;
  const also = [c.access && 'needs help moving', c.medpower && 'medical device needs power', c.transport && 'no car', c.pet && 'has animals', c.visitor && c.home.toLowerCase()].filter(Boolean);
  const bars = [['Need', p.need, 28], ['Hazard', p.hz, 25, p.hzRaw ? `${p.hzRaw} × ${p.lc}` : ''], ['Time to harm', p.time, 12], ['Vulnerability', p.v, 15], ['People', p.pp, 8], ['Waiting', p.wait, 12]];
  const why = [...c.h.why, CONF[c.conf][1].toLowerCase() + ' location (×' + p.lc + ')', c.kids ? 'children in the group' : '', c.elderly ? 'age 65 or older' : '', c.unsure ? 'AI isn’t sure where they are' : ''].filter(Boolean);
  const r = resourceFor(c);
  const open = c.status !== 'resolved';
  el.innerHTML = `
<div class="phead">
  <div class="avatar" aria-hidden="true"><svg width="38" height="44" viewBox="0 0 38 44" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="19" cy="13" r="8"/><path d="M3 42c1.5-9.5 8-14.5 16-14.5S33.5 32.5 35 42"/></svg></div>
  <div class="pid">
    <h3>${esc(c.name)}</h3>
    <div class="ph"><span class="mono">${esc(c.phone)}</span><button type="button" id="copyPhone">Copy</button></div>
    <div class="ad">${esc(c.addr)}</div>
    <div class="tags">${tags.join('')}</div>
  </div>
</div>
${dt}
<dl class="facts">
  <div><dt>Casualty</dt><dd class="${c.bad ? 'cas-bad' : ''}">${esc(c.childAlone ? 'Child at home without an adult' : c.casualty)}</dd></div>
  <div><dt>Need</dt><dd>${NEED[c.need][1]}</dd></div>
  <div><dt>People</dt><dd>${c.people}${c.kids ? ' · ' + c.kids + (c.kids > 1 ? ' children' : ' child') : ''}</dd></div>
  <div><dt>Language</dt><dd>${c.lang}</dd></div>
  <div><dt>Status</dt><dd>${statusLabel(c)}</dd></div>
  <div><dt>Reference</dt><dd class="mono">${c.code}</dd></div>
  <div><dt>Location</dt><dd>${CONF[c.conf][1]}${c.h.z ? ' · in ' + c.h.z : ''}</dd></div>
  <div><dt>Waiting</dt><dd class="num">${open ? dur(S.t - c.at) : 'Resolved ' + fmt(c.resolvedAt)}</dd></div>
  ${also.length ? `<div class="full"><dt>Also</dt><dd>${esc(also.join(' · '))}</dd></div>` : ''}
</dl>
<div class="psec"><h4><span>Severity score</span><span style="color:var(--t${c.tier})">${c.score} · ${TIERS[c.tier]}</span></h4>
  <div class="bars">${bars.map(b => `<div class="bar"><span>${b[0]}</span><span class="tr"><i style="width:${Math.round(100 * b[1] / b[2])}%"></i></span><span class="pv">${Math.round(b[1] * 10) / 10}/${b[2]}</span></div>`).join('')}</div>
  <div class="why">${c.tier === 0 ? '<b style="color:var(--t0)">Red flag:</b> goes to a person now, whatever the score. ' : ''}Why: ${esc(why.join('; ') || 'no hazard nearby')}.${c.calls > 1 ? ` Called ${c.calls} times (shown, not scored).` : ''}</div>
</div>
<div class="psec"><h4>Conversation</h4><div class="convo">${c.convo.map(l => `<p class="${l[0]}"><span class="sp">${l[0] === 'c' ? 'Caller' : 'Agent'}</span>${esc(l[1])}</p>`).join('')}</div></div>
${c.need !== 'info' ? `<div class="psec"><h4>Suggested resource</h4><div class="res"><b>${esc(r.name)}</b><span class="m">${esc(r.address)}</span><span class="m">${r.capacity_remaining} places left · ${r.accepts_pets ? 'takes pets' : 'no pets'} · ${r.languages.join(', ')}</span></div></div>` : ''}
<div class="psec"><h4>Timeline</h4><ol class="tline">${c.timeline.map(e => `<li><time>${fmt(e[0])}</time><span>${esc(e[1])}</span></li>`).join('')}</ol></div>
${open ? `<div class="pact">
  ${c.status === 'saved' ? '<button type="button" class="btn sm primary" data-act="take">Take this case</button>' : ''}
  <button type="button" class="btn sm" data-act="field">${c.field ? 'Field check sent' : 'Send field check'}</button>
  <div class="resolve"><select id="reason" aria-label="Reason for resolving"><option value="">Resolve with a reason…</option><option>Reached, leaving now</option><option>Ride out arranged</option><option>Sent to an evacuation center</option><option>Referred to 911</option><option>Duplicate of another case</option></select><button type="button" class="btn sm" data-act="resolve">Resolve</button></div>
</div>` : `<div class="pact"><span class="st resolved"><i></i>Resolved at ${fmt(c.resolvedAt)} · ${esc(c.reason)}</span></div>`}`;
}

/* ---------- header, alert ---------- */
function latestOfficial() { let e = null; for (const x of sc().events) if (x.m <= S.t && !x.unv) e = x; return e; }
function fireOpen() { return S.cases.filter(c => c.kind === 'fire' && c.status !== 'resolved'); }
const ICON_ALERT = '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.8 19 17.5H1L10 1.8Zm-1 6v5h2v-5H9Zm0 6.4v2h2v-2H9Z"/></svg>';
const ICON_POSSIBLE = '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm-1 4.5v6h2v-6H9Zm0 7.5v2h2v-2H9Z"/></svg>';
function renderHeader() {
  $('#clock').textContent = fmt(S.t);
  const crisis = S.mode === 'crisis';
  $('#modeChip').classList.toggle('crisis', crisis);
  $('#modeTxt').textContent = crisis ? 'Crisis mode' : 'Everyday mode';
  $('#modeChip').setAttribute('aria-label', crisis ? 'Crisis mode is on. Select to switch back.' : 'Everyday mode. Select to switch to crisis mode.');
  $('#playBtn').innerHTML = S.paused ? '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>' : '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2.5" y="1.5" width="3" height="11" rx="1" fill="currentColor"/><rect x="8.5" y="1.5" width="3" height="11" rx="1" fill="currentColor"/></svg>';
  $('#playBtn').setAttribute('aria-label', S.paused ? 'Resume the drill clock' : 'Pause the drill clock');
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scen === S.scen)));
  const al = $('#alert');
  al.hidden = S.alertAt == null;
  if (S.alertAt == null) return;
  const fo = S.cases.filter(c => c.kind === 'fire');
  const danger = fireOpen().filter(c => c.tier === 0).length;
  al.classList.toggle('possible', !crisis);
  const ic = crisis ? ICON_ALERT : ICON_POSSIBLE; if ($('#alertIc').innerHTML !== ic) $('#alertIc').innerHTML = ic;
  if (!crisis) {
    $('#alertTitle').textContent = 'Possible emergency: fire in Malibu';
    $('#alertSub').textContent = `${S.fireCalls} unusual calls about smoke or flames near Corral Canyon since 4:02 PM · ${danger} say they are in danger · ${official() ? 'CAL FIRE has confirmed a fire' : 'not yet confirmed by an official source'}`;
    $('#openEmergency').innerHTML = 'Review and decide <span aria-hidden="true">→</span>';
  } else {
    const e = latestOfficial();
    $('#alertTitle').textContent = official() ? 'Crisis mode · Solstice Fire, Malibu' : 'Crisis mode · Fire in Malibu';
    $('#alertSub').textContent = e ? `Latest ${fmt(e.m)} · ${e.src}: ${e.text}` : `${danger} people in danger · waiting for official confirmation`;
    $('#openEmergency').innerHTML = 'Emergency page <span aria-hidden="true">→</span>';
  }
}

/* ---------- emergency page ---------- */
function topCounts(arr, keyFn, n) { const m = new Map(); for (const a of arr) { const k = keyFn(a); if (k) m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n); }
function renderEmergency() {
  const fire = S.cases.filter(c => c.kind === 'fire');
  const open = fire.filter(c => c.status !== 'resolved');
  const danger = open.filter(c => c.tier === 0);
  const waitingDanger = danger.filter(c => c.status === 'saved').length;
  const el = danger.filter(c => c.elderly).length, ki = danger.filter(c => c.kids > 0).length;
  const vis = fire.length ? Math.round(100 * fire.filter(c => c.visitor).length / fire.length) : 0;
  const places = topCounts(fire.filter(c => c.visitor), c => c.place, 3).map(x => x[0]);
  const needs = topCounts(fire, c => NEED[c.need][1].toLowerCase(), 3);
  const st = fireStage();
  const ratio = Math.max(1, Math.round((fireRate(S.t) + EVERYDAY_RATE) / EVERYDAY_RATE));
  const orders = zones().filter(z => zoneKind(z) === 'order').map(z => z.name), warns = zones().filter(z => zoneKind(z) === 'warning').map(z => z.name);
  const on = S.reps.filter(r => r.on).length;
  const crisis = S.mode === 'crisis';
  $('#eEyebrow').textContent = crisis ? `Emergency page · crisis mode since ${fmt(S.crisisAt)}` : `Possible emergency · flagged by the agent at ${fmt(S.alertAt)}`;
  $('#eEyebrow').classList.toggle('possible', !crisis);
  $('#eHeadline').textContent = official() ? 'There is a fire in Malibu' : 'There is probably a fire in Malibu';
  $('#eMeta').textContent = `${sc().label} drill · near Corral and Latigo Canyon · ${S.fireCalls} fire calls since 4:02 PM`;
  $('#sumTime').textContent = 'updated ' + fmt(S.t);
  const ps = [];
  ps.push(`Since 4:02 PM, <b>${S.fireCalls} people</b> have called about smoke or flames near Corral Canyon and Latigo Canyon. <b>${danger.length}</b> say they are in danger now${danger.length ? ` (${el} aged 65 or older, ${ki} with children)` : ''}.`);
  ps.push(`<b>${vis}%</b> of callers are visitors${places.length ? ', mostly at ' + places.join(', ') : ''}. Many don’t know the way out. The most common needs are ${needs.map(n => `${n[0]} (${n[1]})`).join(', ')}.`);
  ps.push(official() ? `CAL FIRE confirmed the fire at 4:16 PM; it is now about <b>${st.acres.toLocaleString()} acres</b>. ${orders.length ? 'LA County OEM has ordered evacuation for ' + orders.join(' and ') + (warns.length ? ', with warnings for ' + warns.join(' and ') : '') + '.' : 'No evacuation order yet.'}` : 'No official source has confirmed a fire yet. This alert comes from caller reports only.');
  ps.push(crisis ? `Calls are arriving about <b>${ratio}× faster</b> than a normal Saturday afternoon. ${on} of 15 reps are on shift and taking the highest scores first.` : `Calls are arriving about <b>${ratio}× faster</b> than a normal Saturday afternoon. Only ${on} reps are on shift, answering in order of arrival, so <b>${waitingDanger === 1 ? '1 person in danger is' : waitingDanger + ' people in danger are'}</b> waiting behind routine calls.`);
  $('#sumBody').innerHTML = ps.map(p => `<p>${p}</p>`).join('');
  $('#sumKpis').innerHTML = `<div><b class="num">${S.fireCalls}</b><span>fire calls</span></div><div class="hot"><b class="num">${danger.length}</b><span>in danger now</span></div><div><b class="num">${el}</b><span>in danger, 65+</span></div><div><b class="num">${ki}</b><span>in danger, with children</span></div><div><b class="num">${vis}%</b><span>visitors</span></div>`;
  $('#olist').innerHTML = sc().events.filter(e => e.m <= S.t).reverse().map(e => `<li><time>${fmt(e.m)}</time><span><span class="${e.unv ? 'unv' : 'src'}">${e.src}${e.unv ? ' · unverified' : ''}</span> · ${esc(e.text)}</span></li>`).join('') || '<li><span>Nothing from official sources yet.</span></li>';
  const ppl = sorted(open.filter(c => c.tier <= 1), true);
  $('#plist').innerHTML = ppl.slice(0, 8).map((c, i) => `<button type="button" class="prow" data-id="${c.id}"><span class="pn">Person ${i + 1}</span><span class="sc t${c.tier}" style="${tierStyle(c.tier)}">${c.score}</span><span class="pc"><b>${esc(c.name)}${c.elderly ? ' <span class="tag el">65+</span>' : ''}</b><span>${NEED[c.need][1]} · ${esc(c.addr)}</span></span><span class="go">${c.dangerAt != null ? 'In danger ' + dur(S.t - c.dangerAt) : 'Waiting ' + dur(S.t - c.at)} ›</span></button>`).join('') +
    (ppl.length > 8 ? `<p class="note" style="margin:12px 20px 6px">${ppl.length - 8} more in the caller list.</p>` : '') + (ppl.length ? '' : '<p class="note" style="margin:12px 20px">No one is in danger right now.</p>');
  $('#switchCard').className = 'card switch' + (crisis ? ' on' : '');
  $('#switchCard').innerHTML = crisis
    ? `<h3>Crisis mode is on<p>Since ${fmt(S.crisisAt)}, switched by you. The caller list is sorted by severity score.</p></h3><button type="button" class="btn primary" data-go="main">Back to dashboard</button>`
    : `<h3>Switch to crisis mode?<p>Sorts callers by severity score and pages all 15 reps.</p></h3><button type="button" class="btn danger" data-go="confirm">Yes, switch</button>`;
}

/* ---------- views, dialog, toast ---------- */
function show(view) {
  S.view = view;
  $('#mainView').hidden = view !== 'main';
  $('#emergencyView').hidden = view !== 'emergency';
  if (view === 'emergency') renderEmergency();
  window.scrollTo(0, 0); const ev = $('#emergencyView'); if (ev) ev.scrollTop = 0;
  if (view === 'main' && map) setTimeout(() => map.resize(), 0);
  if (view === 'main') renderList(true);
}
let dlgOk = null, lastFocus = null;
function openDlg(kind) {
  lastFocus = document.activeElement;
  if (kind === 'crisis') {
    const off = S.reps.filter(r => !r.on).length;
    $('#dlgTitle').textContent = 'Switch the line to crisis mode?';
    $('#dlgList').innerHTML = ['The agent switches to the wildfire script in English, Spanish and Mandarin.', 'The caller list is sorted by severity score, so people in danger come first.', `All 15 reps are paged. ${off} are off shift right now.`, 'High-risk callers get check-in calls at 0, 2, 5 and 10 minutes.', 'Nothing goes out to the public. Warnings still need your approval.'].map(x => `<li>${x}</li>`).join('');
    $('#dlgFine').textContent = 'This is logged under your name. You can switch back at any time.';
    $('#dlgOk').textContent = 'Switch to crisis mode';
    dlgOk = () => {
      S.mode = 'crisis'; S.crisisAt = S.t;
      let k = 0; for (const r of S.reps) if (!r.on) { r.onAt = S.t + 0.6 + 0.75 * k++; r.leave = false; }
      scoreAll(); show('main'); renderAll(); toast('Crisis mode on. Callers are now sorted by severity score.');
    };
  } else {
    $('#dlgTitle').textContent = 'Switch back to everyday mode?';
    $('#dlgList').innerHTML = ['The agent returns to the everyday script.', 'The caller list goes back to arrival order.', 'Reps 04 to 15 go off shift after their current case.'].map(x => `<li>${x}</li>`).join('');
    $('#dlgFine').textContent = 'Open cases stay open. This is logged under your name.';
    $('#dlgOk').textContent = 'Switch to everyday mode';
    dlgOk = () => { S.mode = 'everyday'; S.crisisAt = null; S.reps.forEach((r, i) => { if (i >= 3) { r.onAt = null; if (r.on) r.leave = true; } }); renderAll(); toast('Everyday mode on.'); };
  }
  $('#scrim').hidden = false; $('#dlgOk').focus();
}
function closeDlg() { $('#scrim').hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
let toastT = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); }

function scrollRowIntoView(id) { const r = document.querySelector(`.rowc[data-id="${id}"]`); if (r) r.scrollIntoView({ block: 'nearest' }); return r; }
function moveSel(d) {
  const ord = S.order || []; if (!ord.length) return;
  let i = ord.indexOf(S.sel); i = i < 0 ? 0 : Math.max(0, Math.min(ord.length - 1, i + d));
  select(ord[i], { fly: true }); const r = scrollRowIntoView(ord[i]); if (r) r.focus({ preventScroll: true });
}
function select(id, opts = {}) {
  S.sel = id;
  document.querySelectorAll('.rowc').forEach(b => b.setAttribute('aria-current', String(b.dataset.id === id)));
  renderProfile(); updateSel();
  const c = byId(id);
  if (opts.fly && c && mapReady) map.easeTo({ center: c.loc, zoom: Math.max(map.getZoom(), 15.4), duration: 700 });
  if (opts.reveal && window.innerWidth < 860) $('#profile').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- map ---------- */
let map = null, mapReady = false; const imgs = new Set();
const EMPTY = { type: 'FeatureCollection', features: [] };
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function colors() { const o = {}; for (const k of ['map-water','map-land','map-hood','map-road','map-major','map-casing','fire','order','warn','t0','t1','t2','t3','t4','surface','ink']) o[k.replace('map-', '')] = css('--' + k); return o; }
function paints(c) {
  return {
    bg: { 'background-color': c.water }, land: { 'fill-color': c.land }, hoods: { 'line-color': c.hood },
    'zone-fill': { 'fill-color': ['match', ['get', 'kind'], 'order', c.order, c.warn] }, 'zone-line': { 'line-color': ['match', ['get', 'kind'], 'order', c.order, c.warn] },
    'road-casing': { 'line-color': c.casing }, 'road-minor': { 'line-color': c.road }, 'road-major': { 'line-color': c.major },
    'fire-fill': { 'fill-color': c.fire }, 'fire-line': { 'line-color': c.fire }, 'fire-line-unv': { 'line-color': c.fire },
    'closure-casing': { 'line-color': c.surface }, closures: { 'line-color': c.order },
    points: { 'circle-color': ['match', ['get', 'tier'], 0, c.t0, 1, c.t1, 2, c.t2, 3, c.t3, c.t4], 'circle-stroke-color': c.surface },
    sel: { 'circle-stroke-color': c.ink }, hover: { 'circle-stroke-color': c.ink }
  };
}
function buildStyle() {
  const c = colors(), P = paints(c);
  const L = (id, type, source, extra = {}, paint = {}) => Object.assign({ id, type, source, paint: Object.assign({}, P[id] || {}, paint) }, extra);
  return {
    version: 8,
    sources: {
      land: { type: 'geojson', data: MAPDATA.land }, hoods: { type: 'geojson', data: MAPDATA.hoods }, roads: { type: 'geojson', data: MAPDATA.roads },
      zones: { type: 'geojson', data: EMPTY }, fire: { type: 'geojson', data: EMPTY }, closures: { type: 'geojson', data: EMPTY },
      cases: { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 44, clusterMaxZoom: 15, clusterProperties: { people: ['+', ['get', 'people']], red: ['max', ['get', 'red']] } }
    },
    layers: [
      { id: 'bg', type: 'background', paint: P.bg },
      L('land', 'fill', 'land'),
      L('hoods', 'line', 'hoods', {}, { 'line-width': 0.8 }),
      L('zone-fill', 'fill', 'zones', {}, { 'fill-opacity': ['match', ['get', 'kind'], 'order', 0.17, 0.13] }),
      L('zone-line', 'line', 'zones', {}, { 'line-width': 1.4, 'line-opacity': 0.85 }),
      L('road-casing', 'line', 'roads', { filter: ['!=', ['get', 'c'], 'canyon'], layout: { 'line-join': 'round', 'line-cap': 'round' } }, { 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.2, 14, 7.5] }),
      L('road-minor', 'line', 'roads', { filter: ['==', ['get', 'c'], 'canyon'], layout: { 'line-join': 'round', 'line-cap': 'round' } }, { 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 3] }),
      L('road-major', 'line', 'roads', { filter: ['!=', ['get', 'c'], 'canyon'], layout: { 'line-join': 'round', 'line-cap': 'round' } }, { 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 14, 4.8] }),
      L('fire-fill', 'fill', 'fire', {}, { 'fill-opacity': ['case', ['get', 'official'], 0.34, 0.18] }),
      L('fire-line', 'line', 'fire', { filter: ['==', ['get', 'official'], true] }, { 'line-width': 1.8 }),
      L('fire-line-unv', 'line', 'fire', { filter: ['==', ['get', 'official'], false] }, { 'line-width': 1.6, 'line-dasharray': [2, 1.5] }),
      L('closure-casing', 'line', 'closures', {}, { 'line-width': 6.5 }),
      L('closures', 'line', 'closures', {}, { 'line-width': 3.4, 'line-dasharray': [1.3, 0.9] }),
      { id: 'clusters', type: 'symbol', source: 'cases', filter: ['has', 'point_count'], layout: { 'icon-image': ['concat', 'cl-', ['to-string', ['get', 'people']], '-', ['to-string', ['get', 'red']]], 'icon-allow-overlap': true, 'icon-ignore-placement': true } },
      L('points', 'circle', 'cases', { filter: ['!', ['has', 'point_count']] }, { 'circle-radius': ['match', ['get', 'tier'], 0, 8, 1, 7, 6], 'circle-stroke-width': 1.8 }),
      L('hover', 'circle', 'cases', { filter: ['==', ['get', 'id'], ''] }, { 'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.7 }),
      L('sel', 'circle', 'cases', { filter: ['==', ['get', 'id'], ''] }, { 'circle-radius': 14, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 2.4 })
    ]
  };
}
function clusterImage(id) {
  const m = /^cl-(\d+)-(\d)$/.exec(id); if (!m || !map) return;
  const n = +m[1], red = +m[2] === 1, c = colors();
  const r = n < 10 ? 14 : n < 30 ? 17 : n < 100 ? 21 : 25, size = (r + 5) * 2, PR = 2;
  const cv = document.createElement('canvas'); cv.width = cv.height = size * PR;
  const x = cv.getContext('2d'); x.scale(PR, PR);
  x.beginPath(); x.arc(size / 2, size / 2, r, 0, Math.PI * 2); x.fillStyle = c.surface; x.fill();
  x.lineWidth = red ? 4.5 : 2.6; x.strokeStyle = c.t0; x.stroke();
  x.fillStyle = c.ink; x.font = `600 ${n >= 100 ? 11.5 : 12.5}px "IBM Plex Sans", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(String(n), size / 2, size / 2 + 0.5);
  if (!map.hasImage(id)) map.addImage(id, x.getImageData(0, 0, cv.width, cv.height), { pixelRatio: PR });
  imgs.add(id);
}
function mapFail(msg) { const d = document.createElement('div'); d.className = 'mapfail'; d.textContent = msg + ' The caller list below still works.'; $('#map').appendChild(d); }
function initMap() {
  if (!window.maplibregl) { mapFail('The map couldn’t load.'); return; }
  try {
    map = new maplibregl.Map({ container: 'map', style: buildStyle(), bounds: [[-118.86, 34.0], [-118.645, 34.112]], fitBoundsOptions: { padding: 16 }, attributionControl: false, minZoom: 9.5, maxZoom: 16.5, maxBounds: [[-119.25, 33.8], [-118.25, 34.4]], dragRotate: false, pitchWithRotate: false, cooperativeGestures: false });
  } catch (e) { map = null; mapFail('The map needs WebGL, which is off in this browser.'); return; }
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Boundaries: LA Times Mapping L.A. · Land: Natural Earth · Feeds simulated' }), 'bottom-right');
  map.on('styleimagemissing', e => clusterImage(e.id));
  map.on('error', e => { if (e && e.error) console.warn('map', e.error.message); });
  map.on('load', () => {
    mapReady = true;
    for (const [name, lon, lat] of MAPDATA.places) { const d = document.createElement('div'); d.className = 'place-label'; d.textContent = name; new maplibregl.Marker({ element: d, anchor: 'center' }).setLngLat([lon, lat]).addTo(map); }
    const at = document.querySelector('.maplibregl-ctrl-attrib'); if (at) at.classList.remove('maplibregl-compact-show');
    updateMap(true);
  });
  map.on('click', 'clusters', async e => {
    const f = e.features[0];
    try { const z = await map.getSource('cases').getClusterExpansionZoom(f.properties.cluster_id); map.easeTo({ center: f.geometry.coordinates, zoom: Math.min(z > 15 ? 16.2 : z + 0.3, 16.5), duration: 650 }); } catch (err) { map.easeTo({ center: f.geometry.coordinates, zoom: map.getZoom() + 1.5 }); }
  });
  map.on('click', 'points', e => { const id = e.features[0].properties.id; select(id, { reveal: true }); scrollRowIntoView(id); });
  for (const l of ['clusters', 'points']) { map.on('mouseenter', l, () => map.getCanvas().style.cursor = 'pointer'); map.on('mouseleave', l, () => map.getCanvas().style.cursor = ''); }
}
let lastKeys = {};
function updateMap(force) {
  renderMapHead();
  if (!mapReady) return;
  const st = fireStage(), off = official();
  const fk = (st ? st.m : -1) + '|' + off;
  if (force || fk !== lastKeys.fire) { map.getSource('fire').setData(st ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { official: off }, geometry: st.g }] } : EMPTY); lastKeys.fire = fk; }
  const zk = zones().map(z => zoneKind(z)).join(',');
  if (force || zk !== lastKeys.zones) { map.getSource('zones').setData({ type: 'FeatureCollection', features: zones().filter(z => zoneKind(z)).map(z => ({ type: 'Feature', properties: { kind: zoneKind(z), name: z.name }, geometry: z.g })) }); lastKeys.zones = zk; }
  const cl = closuresNow(); const ck = cl.length;
  if (force || ck !== lastKeys.cl) { map.getSource('closures').setData({ type: 'FeatureCollection', features: cl.map(x => ({ type: 'Feature', properties: { name: x.name }, geometry: x.g })) }); lastKeys.cl = ck; }
  map.getSource('cases').setData({ type: 'FeatureCollection', features: S.cases.filter(c => c.status !== 'resolved').map(c => ({ type: 'Feature', properties: { id: c.id, tier: c.tier, people: c.people, red: c.tier === 0 ? 1 : 0 }, geometry: { type: 'Point', coordinates: c.loc } })) });
  updateSel();
}
function updateSel() { if (mapReady) map.setFilter('sel', ['==', ['get', 'id'], S.sel || '']); }
function renderMapHead() {
  const st = fireStage(); const tags = [];
  if (st) tags.push(official() ? `<div class="maptag fire"><b>Solstice Fire</b> · CAL FIRE perimeter · ${st.acres.toLocaleString()} acres · updated ${fmt(st.m < 14 ? 14 : st.m)}</div>` : `<div class="maptag fire"><b>Fire area reported by callers</b> · not yet confirmed</div>`);
  const o = zones().filter(z => zoneKind(z) === 'order').length, w = zones().filter(z => zoneKind(z) === 'warning').length;
  if (o || w) tags.push(`<div class="maptag">LA County OEM · ${o} ${o === 1 ? 'zone' : 'zones'} under order · ${w} under warning</div>`);
  const cl = closuresNow().length; if (cl) tags.push(`<div class="maptag">${cl} road ${cl === 1 ? 'closure' : 'closures'} · CHP, Caltrans</div>`);
  const html = tags.join(''); if ($('#maphead').innerHTML !== html) $('#maphead').innerHTML = html;
}
function applyMapTheme() {
  if (!mapReady) return;
  const P = paints(colors());
  for (const id in P) for (const k in P[id]) { try { map.setPaintProperty(id, k, P[id][k]); } catch (e) {} }
  for (const id of imgs) if (map.hasImage(id)) map.removeImage(id);
  imgs.clear(); updateMap(true);
}

/* ---------- render loop ---------- */
function renderAll() { renderHeader(); renderList(); renderProfile(); if (S.view === 'emergency') renderEmergency(); updateMap(false); }
function renderLive() {
  $('#clock').textContent = fmt(S.t);
  const c = byId(S.sel), d = document.querySelector('[data-live="danger"]');
  if (c && d && c.dangerAt != null) d.textContent = dur(S.t - c.dangerAt);
}

/* ---------- events ---------- */
$('#rows').addEventListener('click', e => { const b = e.target.closest('.rowc'); if (b) select(b.dataset.id, { fly: true, reveal: true }); });
$('#rows').addEventListener('mouseover', e => { const b = e.target.closest('.rowc'); if (mapReady) map.setFilter('hover', ['==', ['get', 'id'], b ? b.dataset.id : '']); });
$('#lscroll').addEventListener('mouseenter', () => { listHover = true; });
$('#lscroll').addEventListener('mouseleave', () => { listHover = false; if (mapReady) map.setFilter('hover', ['==', ['get', 'id'], '']); if (listPending) renderList(true); });
document.addEventListener('keydown', e => {
  if (!$('#scrim').hidden || S.view !== 'main') return;
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
  if (e.key === '/' && !typing) { e.preventDefault(); $('#q').focus(); return; }
  if (typing) return;
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); moveSel(1); }
  if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); moveSel(-1); }
});
$('#moreBtn').addEventListener('click', () => { S.limit += 40; renderList(true); });
$('#filters').addEventListener('click', e => { const b = e.target.closest('.fbtn'); if (!b) return; S.filter = b.dataset.f; S.limit = 40; renderList(true); });
$('#filters').addEventListener('input', e => { if (e.target.id === 'q') { S.q = e.target.value; S.limit = 40; qFocus = true; renderList(true); qFocus = false; } });
$('#profile').addEventListener('click', e => {
  const c = byId(S.sel); if (!c) return;
  if (e.target.id === 'copyPhone') { const done = () => toast('Phone number copied.'); try { navigator.clipboard.writeText(c.phone).then(done, () => toast('Copy isn’t available here. Select the number instead.')); } catch (err) { toast('Copy isn’t available here. Select the number instead.'); } return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'take') { c.status = 'review'; c.rep = 'You'; c.reviewAt = S.t; c.timeline.push([S.t, 'You took the case']); toast('You took ' + c.name + '’s case.'); }
  if (a.dataset.act === 'field' && !c.field) { c.field = true; c.timeline.push([S.t, 'Field check requested from LA County Fire']); toast('Field check requested.'); }
  if (a.dataset.act === 'resolve') { const r = $('#reason').value; if (!r) { toast('Choose a reason before resolving.'); $('#reason').focus(); return; } resolveCase(c, r, 'you', S.t); toast('Case resolved.'); }
  renderAll();
});
$('#openEmergency').addEventListener('click', () => show('emergency'));
$('#backBtn').addEventListener('click', () => show('main'));
$('#plist').addEventListener('click', e => { const b = e.target.closest('.prow'); if (!b) return; show('main'); renderList(true); select(b.dataset.id, { fly: true }); setTimeout(() => { const r = document.querySelector(`.rowc[data-id="${b.dataset.id}"]`); (window.innerWidth < 860 ? $('#profile') : $('#map')).scrollIntoView({ block: 'start' }); if (r) r.focus({ preventScroll: true }); }, 50); });
$('#switchCard').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b) return; if (b.dataset.go === 'confirm') openDlg('crisis'); else show('main'); });
$('#modeChip').addEventListener('click', () => openDlg(S.mode === 'crisis' ? 'everyday' : 'crisis'));
$('#dlgCancel').addEventListener('click', closeDlg);
$('#dlgOk').addEventListener('click', () => { const f = dlgOk; $('#scrim').hidden = true; if (f) f(); });
$('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim') closeDlg(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#scrim').hidden) closeDlg(); });
$('#playBtn').addEventListener('click', () => { S.paused = !S.paused; renderHeader(); });
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { if (b.dataset.scen === S.scen) return; restart(b.dataset.scen); toast(`Drill restarted: ${sc().label}, ${sc().calls}.`); }));
function restart(scen) { const v = S.view; boot(scen || S.scen); lastKeys = {}; show(v === 'emergency' ? 'emergency' : 'main'); renderAll(); if (mapReady) map.fitBounds([[-118.86, 34.0], [-118.645, 34.112]], { padding: 16, duration: 0 }); }
$('#restartBtn').addEventListener('click', () => { restart(); toast('Drill restarted at 4:11 PM.'); });
$('#alert').addEventListener('click', e => { if (e.target.closest('#openEmergency')) return; show('emergency'); });
for (const [id, layers] of [['lyFire', ['fire-fill', 'fire-line', 'fire-line-unv']], ['lyZones', ['zone-fill', 'zone-line']], ['lyRoads', ['closure-casing', 'closures']]]) {
  $('#' + id).addEventListener('change', e => { if (!mapReady) return; for (const l of layers) map.setLayoutProperty(l, 'visibility', e.target.checked ? 'visible' : 'none'); });
}
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyMapTheme); } catch (e) {}
new MutationObserver(applyMapTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ---------- start ---------- */
boot();
if (LIVE) {
  const chip = document.querySelector('.chip.drill');
  chip.textContent = 'Live · Retell + Supabase'; chip.title = 'Live assistance requests saved by Retell';
  $('#clock').setAttribute('aria-label', 'Current time');
  $('#playBtn').hidden = true; document.querySelector('.seg').hidden = true; $('#restartBtn').hidden = true;
}
renderAll();
syncLiveCases();
let started = false;
const startMap = () => { if (started) return; started = true; initMap(); };
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(startMap);
setTimeout(startMap, 1500);
let tick = 0;
setInterval(() => {
  if (LIVE) S.t = Date.now() / 60000;
  else if (!S.paused) step(0.25 / SEC_PER_MIN);
  tick++;
  if (LIVE && tick % 40 === 0) syncLiveCases();
  if (tick % 4 === 0) renderLive();
  if (tick % 8 === 0) renderAll();
}, 250);
window.__nd = { get S() { return S; }, get map() { return map; } };
})();
