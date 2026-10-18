(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { records: [], filter: 'all', query: '', selected: null, loading: false };
const languageName = value => ({ en:'English', 'en-US':'English', es:'Spanish', 'es-419':'Spanish', zh:'Mandarin', ko:'Korean', ja:'Japanese', de:'German', fr:'French' }[value] || value || 'English');
const formatTime = value => value ? new Date(value).toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '—';
const statusText = value => ({ queued:'Queued', in_progress:'In progress', resolved:'Resolved', closed:'Closed', completed:'Completed' }[value] || value || 'Unknown');
const assistanceNeed = row => row.medical_power_required ? 'Medical device power' : row.accessibility_required ? 'Accessibility assistance' : row.needs_transportation || row.resource_type === 'transportation' ? 'Transportation' : row.has_pet || row.has_service_animal ? 'Pet assistance' : ({ shelter:'Shelter', food:'Food', water:'Water', other:'Other assistance' }[row.resource_type] || 'Assistance');

function normalizeAssistance(row) {
  const tail = String(row.callback_number || '').replace(/\D/g, '').slice(-4);
  return { ...row, recordType:'assistance', title:row.caller_name || (tail ? `Caller ••••${tail}` : 'Retell caller'), phone:row.callback_number || 'Not provided', location:row.caller_location || 'Location not provided', need:assistanceNeed(row), typeLabel:'Assistance', sortTime:Date.parse(row.created_at) || 0 };
}
function normalizeReunification(row) {
  const action = row.case_type === 'register_safe' ? 'Registered safe' : 'Searching for person';
  return { ...row, recordType:'reunification', title:row.person_name || 'Unnamed person', phone:row.contact_number || 'Not provided', location:row.person_location || 'Location not provided', need:action, typeLabel:'Reunification', sortTime:Date.parse(row.created_at) || 0 };
}
function badgeClass(row) { return row.recordType === 'reunification' ? 'reunion' : row.priority === 'critical' ? 'critical' : row.priority === 'high' ? 'high' : ''; }
function filteredRecords() {
  const q = state.query.trim().toLowerCase();
  return state.records.filter(r => (state.filter === 'all' || r.recordType === state.filter) && (!q || [r.title,r.phone,r.location,r.need,r.reference_code].join(' ').toLowerCase().includes(q)));
}
function render() {
  const assistance = state.records.filter(r => r.recordType === 'assistance');
  const reunion = state.records.filter(r => r.recordType === 'reunification');
  const queued = state.records.filter(r => r.status === 'queued');
  $('#mTotal').textContent = state.records.length; $('#mAssistance').textContent = assistance.length; $('#mReunion').textContent = reunion.length; $('#mQueued').textContent = queued.length;
  $('#nAll').textContent = state.records.length; $('#nAssistance').textContent = assistance.length; $('#nReunion').textContent = reunion.length;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.filter === state.filter));
  const rows = filteredRecords();
  $('#rows').innerHTML = rows.length ? rows.map(r => `<li><button class="row${r.id === state.selected ? ' selected' : ''}" data-id="${esc(r.id)}"><span class="badge ${badgeClass(r)}">${esc(r.typeLabel)}</span><span><span class="primary">${esc(r.title)}</span><span class="secondary mono">${esc(r.phone)}</span></span><span class="location"><span class="primary">${esc(r.location)}</span><span class="secondary">${esc(r.need)}</span></span><span class="status"><span class="badge ${r.status === 'queued' ? 'queued' : ''}">${esc(statusText(r.status))}</span></span><span class="time">${esc(formatTime(r.created_at))}</span></button></li>`).join('') : '<li class="empty">No records match this view.</li>';
  renderDetail();
}
function fact(label, value, full = false) { return `<div class="fact${full ? ' full' : ''}"><label>${esc(label)}</label><div>${esc(value || '—')}</div></div>`; }
function renderDetail() {
  const r = state.records.find(x => x.id === state.selected);
  if (!r) { $('#detail').innerHTML = '<div class="empty">Select a record to see its details.</div>'; return; }
  if (r.recordType === 'assistance') {
    $('#detail').innerHTML = `<span class="badge ${badgeClass(r)}">Assistance request</span><h2>${esc(r.title)}</h2><div class="sub mono">${esc(r.reference_code || r.id)}</div><div class="facts">${fact('Callback number',r.phone)}${fact('Status',statusText(r.status))}${fact('Need',r.need)}${fact('Priority',r.priority ? `${r.priority} · score ${r.priority_score ?? 0}` : 'Not scored')}${fact('People',`${r.people_count || 1}${r.children_count ? ` · ${r.children_count} children` : ''}`)}${fact('Language',languageName(r.preferred_language))}${fact('Location',r.location,true)}${fact('Received',formatTime(r.created_at),true)}</div>${r.conversation_summary ? `<div class="note">${esc(r.conversation_summary)}</div>` : ''}`;
  } else {
    $('#detail').innerHTML = `<span class="badge reunion">Family reunification</span><h2>${esc(r.title)}</h2><div class="sub mono">${esc(r.reference_code || r.id)}</div><div class="facts">${fact('Case type',r.need)}${fact('Status',statusText(r.status))}${fact('Contact number',r.contact_number)}${fact('Person phone',r.person_phone)}${fact('Language',languageName(r.preferred_language))}${fact('Location',r.location)}${fact('Received',formatTime(r.created_at),true)}</div><div class="note">This record was saved by the Retell family reunification flow.</div>`;
  }
}
async function load() {
  if (state.loading) return; state.loading = true; $('#refresh').disabled = true; $('#error').classList.remove('show');
  try {
    const [aRes, rRes] = await Promise.all([fetch('/api/assistance-requests/list?limit=200',{cache:'no-store'}), fetch('/api/reunification-cases/list?limit=200',{cache:'no-store'})]);
    const [a, r] = await Promise.all([aRes.json(), rRes.json()]);
    if (!aRes.ok || !a.success) throw new Error(`Assistance: ${a.error || aRes.status}`);
    if (!rRes.ok || !r.success) throw new Error(`Reunification: ${r.error || rRes.status}`);
    state.records = [...a.requests.map(normalizeAssistance), ...r.cases.map(normalizeReunification)].sort((x,y) => y.sortTime - x.sortTime);
    if (!state.records.some(x => x.id === state.selected)) state.selected = state.records[0]?.id || null;
    $('#updated').textContent = `Updated ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})}`;
    render();
  } catch (error) { $('#error').textContent = `Could not load live data: ${error.message}. Retrying automatically.`; $('#error').classList.add('show'); }
  finally { state.loading = false; $('#refresh').disabled = false; }
}
$('#tabs').addEventListener('click', e => { const b=e.target.closest('[data-filter]'); if(!b)return; state.filter=b.dataset.filter; render(); });
$('#rows').addEventListener('click', e => { const b=e.target.closest('[data-id]'); if(!b)return; state.selected=b.dataset.id; render(); if(innerWidth<850)$('#detail').scrollIntoView({behavior:'smooth'}); });
$('#search').addEventListener('input', e => { state.query=e.target.value; render(); });
$('#refresh').addEventListener('click', load);
load(); setInterval(load,10000);
})();
