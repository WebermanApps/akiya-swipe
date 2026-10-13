'use strict';
/* Akiya Keep or Toss – mobile PWA. Separate list per device: decisions live in this browser's localStorage only. */
const V = 'e5567e7698';
const LS_DEC = 'akiya_decisions_v1', LS_SES = 'akiya_session_v1', LS_TIP = 'akiya_tip_seen_v1', LS_ORDER = 'akiya_front_v1';
const $ = s => document.querySelector(s);
const fmt = n => n == null ? '–' : Math.round(n).toLocaleString('en-US');
const esc = s => (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch (e) { return d } };
let D, byId = {}, ACTIVE = [], dec = load(LS_DEC, {}), front = load(LS_ORDER, []), undoStack = [], FRESH = new Set();
const saveDec = () => { localStorage.setItem(LS_DEC, JSON.stringify(dec)); localStorage.setItem(LS_ORDER, JSON.stringify(front)); counts() };

function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 1300) }
function counts() {
  const r = ACTIVE.filter(l => dec[l.id]).length, k = D.listings.filter(l => dec[l.id]?.d === 'keep').length;
  $('#revN').textContent = r; $('#revT').textContent = ACTIVE.length; $('#keptN').textContent = k; k ? $('#keptN').removeAttribute('data-z') : $('#keptN').setAttribute('data-z', '');
}
function queue() {
  const und = ACTIVE.filter(l => !dec[l.id]); const f = front.filter(id => byId[id] && !dec[id] && byId[id].status === 'active');
  return [...f.map(id => byId[id]), ...und.filter(l => !f.includes(l.id))];
}
const specs = l => [l.year && 'Built ' + l.year, l.layout, l.bldg && 'Bldg ' + fmt(l.bldg) + ' m²', l.land && 'Land ' + fmt(l.land) + ' m²'].filter(Boolean);
const nearHTML = (l, all) => (all ? l.near : l.near.slice(0, 1)).map(r => `<div class="res"><span class="pill ${r.pass_}">${r.pass_}</span>${esc(r.name)} · ~${r.min} min est. (${r.km} km)</div>`).join('');

// ---------------------------------------------------------------- swipe deck
const deck = $('#deck');
function cardHTML(l, top) {
  const n = l.photos.length;
  const imgs = n ? l.photos.map((p, i) => `<img ${i === 0 || (top && i === 1) ? 'src' : 'data-src'}="${p}" alt="" draggable="false" decoding="async">`).join('') : `<div class="small" style="color:#ccc;padding:40px 20px;text-align:center">No photos found – see listing</div>`;
  return `<div class="ph"><div class="car">${top ? imgs : (n ? `<img src="${l.photos[0]}" alt="">` : '')}</div>
  ${n > 1 ? `<div class="dots">${l.photos.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div><button class="pa l" aria-label="Previous photo">‹</button><button class="pa r" aria-label="Next photo">›</button>` : ''}
  ${n ? `<span class="pc">1 / ${n}</span><button class="pz" aria-label="Full screen">⤢</button>` : ''}
  ${FRESH.has(l.id) ? '<span class="badge">NEW</span>' : ''}${l.rank ? `<span class="rank">Shortlist #${l.rank}</span>` : ''}
  <div class="stamp k">KEEP</div><div class="stamp t">TOSS</div></div>
  <div class="info"><div class="grip">⇠ toss · drag card here · keep ⇢</div>
  <div class="price">¥${fmt(l.jpy)} <small>≈ US$${fmt(l.usd)}</small></div>
  <div class="ttl">${esc(l.title)}</div>
  <div class="loc">📍 ${esc(l.city_en)}, ${esc(l.pref)}${l.address ? ' · ' + esc(l.address) : ''}${l.prec === 'city' ? ' <i>(town-level location)</i>' : ''}</div>
  ${l.drives_text ? l.drives_text.map(d => `<div class="res">⛷ ${esc(d[0])} — ${esc(d[1])}</div>`).join('') : nearHTML(l, false)}
  <div class="specs">${specs(l).map(s => `<span>${s}</span>`).join('')}</div>
  <div class="chips">${l.flags.map(f => `<span class="chip">${esc(f)}</span>`).join('')}</div>
  ${l.spec_text ? `<div class="desc"><b>Notes:</b> ${esc(l.spec_text)}</div>` : ''}${l.red_text ? `<div class="desc"><b>Red flags:</b> ${esc(l.red_text)}</div>` : ''}
  ${l.desc ? `<div class="desc">${esc(l.desc)}</div>` : ''}${l.access ? `<div class="desc">🚉 ${esc(l.access)}</div>` : ''}
  <a class="lnk" href="${esc(l.url)}" target="_blank" rel="noopener">Open listing ↗</a>${l.also.map((u, i) => ` · <a href="${esc(u)}" target="_blank" rel="noopener">alt ${i + 1}</a>`).join('')}
  <div class="small">Source: ${esc(l.source)} · first seen ${l.first_seen} · photos: ${esc(l.credit || '–')} · drive time = estimate</div></div>`;
}
let cur = null;
function render() {
  deck.innerHTML = ''; const q = queue();
  $('#empty').hidden = !!q.length; $('#actions').hidden = !q.length || !$('#v-swipe').classList.contains('on');
  if (!q.length) $('#emptyMsg').innerHTML = `You've reviewed all ${ACTIVE.length} houses. Tap <b>Submit</b> to send your picks to Japan Cottage.<br><br>Export (menu) still works as a backup.`;
  q.slice(0, 2).reverse().forEach((l, i, a) => {
    const top = i === a.length - 1, c = document.createElement('div');
    c.className = 'card' + (top ? '' : ' back'); c.dataset.id = l.id; c.innerHTML = cardHTML(l, top); deck.appendChild(c);
    if (top) wire(c, l);
  });
  counts();
}
function wire(c, l) {
  const car = c.querySelector('.car'), imgs = [...car.querySelectorAll('img')], dots = c.querySelectorAll('.dots i'), pc = c.querySelector('.pc'), n = l.photos.length;
  let idx = 0;
  const ensure = i => { const im = imgs[i]; if (im && im.dataset.src) { im.src = im.dataset.src; im.removeAttribute('data-src') } };
  const setIdx = i => { idx = i; dots.forEach((d, k) => d.classList.toggle('on', k === i)); if (pc) pc.textContent = `${i + 1} / ${n}`; ensure(i + 1); ensure(i - 1); ensure(i) };
  const go = i => { i = (i + n) % n; ensure(i); car.scrollTo({ left: i * car.clientWidth, behavior: Math.abs(i - idx) > 1 ? 'auto' : 'smooth' }); setIdx(i) };
  car.addEventListener('scroll', () => { const i = Math.round(car.scrollLeft / Math.max(1, car.clientWidth)); if (i !== idx && i >= 0 && i < n) setIdx(i) }, { passive: true });
  // tap on left/right half of the photo = previous/next photo (a horizontal swipe on the photo scrolls the carousel natively)
  car.addEventListener('click', e => { if (n < 2) return; const r = car.getBoundingClientRect(); go(idx + (e.clientX - r.left < r.width / 2 ? -1 : 1)) });
  c.querySelectorAll('.pa').forEach(b => b.onclick = e => { e.stopPropagation(); go(idx + (b.classList.contains('r') ? 1 : -1)) });
  const pz = c.querySelector('.pz'); if (pz) pz.onclick = e => { e.stopPropagation(); viewer(l.photos, idx) };
  cur = { go: d => n > 1 && go(idx + d), get idx() { return idx } };
  // keep/toss drag: only on the info area (vertical drag there still scrolls the text)
  const info = c.querySelector('.info'), sk = c.querySelector('.stamp.k'), st = c.querySelector('.stamp.t');
  let sx = 0, sy = 0, dx = 0, state = 0, pid = null; // 0 idle, 1 pending, 2 dragging
  info.addEventListener('pointerdown', e => { if (e.target.closest('a,button') || (e.pointerType === 'mouse' && e.button !== 0)) return; sx = e.clientX; sy = e.clientY; dx = 0; state = 1; pid = e.pointerId });
  info.addEventListener('pointermove', e => {
    if (!state || e.pointerId !== pid) return; dx = e.clientX - sx; const dy = e.clientY - sy;
    if (state === 1) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) { state = 2; try { info.setPointerCapture(pid) } catch (_) { } c.style.transition = 'none' }
      else if (Math.abs(dy) > 12) { state = 0; return } else return;
    }
    e.preventDefault();
    c.style.transform = `translate(${dx}px,${dy * 0.15}px) rotate(${dx / 16}deg)`; sk.style.opacity = Math.min(1, Math.max(0, dx / 90)); st.style.opacity = Math.min(1, Math.max(0, -dx / 90));
  });
  const end = e => {
    if (e.pointerId !== pid) return; const was = state; state = 0; if (was !== 2) return;
    if (Math.abs(dx) > 90 && e.type === 'pointerup') return decide(dx > 0 ? 'keep' : 'toss', c);
    c.style.transition = 'transform .25s'; c.style.transform = ''; sk.style.opacity = st.style.opacity = 0;
  };
  info.addEventListener('pointerup', end); info.addEventListener('pointercancel', end);
}
function decide(d, c) {
  const q = queue(); if (!q.length) return; const l = q[0]; c = c || deck.lastElementChild;
  dec[l.id] = { d, t: new Date().toISOString() }; front = front.filter(x => x !== l.id); undoStack.push(l.id); saveDec(); mapDirty = true;
  toast(d === 'keep' ? '♥ Kept' : '✕ Tossed');
  if (c) {
    c.style.transition = 'transform .28s ease-in'; c.style.transform = `translate(${d === 'keep' ? 130 : -130}vw,40px) rotate(${d === 'keep' ? 28 : -28}deg)`;
    c.querySelector('.stamp.' + (d === 'keep' ? 'k' : 't')).style.opacity = 1;
  }
  setTimeout(render, c ? 200 : 0);
}
function undo() {
  const id = undoStack.pop(); if (!id) return toast('Nothing to undo'); delete dec[id]; front = [id, ...front.filter(x => x !== id)]; saveDec(); mapDirty = true; render(); toast('↶ Undone');
}
$('#bKeep').onclick = () => decide('keep'); $('#bToss').onclick = () => decide('toss'); $('#bUndo').onclick = undo;
document.addEventListener('keydown', e => {
  if (!$('#viewer').hidden) { if (e.key === 'Escape') $('#viewer').hidden = true; return }
  if (!$('#v-swipe').classList.contains('on') || e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowUp' || (e.shiftKey && e.key === 'ArrowLeft')) { e.preventDefault(); cur?.go(-1) }
  else if (e.key === 'ArrowDown' || (e.shiftKey && e.key === 'ArrowRight')) { e.preventDefault(); cur?.go(1) }
  else if (e.key === 'ArrowRight') decide('keep'); else if (e.key === 'ArrowLeft') decide('toss');
  else if (e.key === 'Backspace' || e.key === 'z') { e.preventDefault(); undo() }
});

// ---------------------------------------------------------------- full-screen photo viewer
function viewer(photos, start) {
  const v = $('#viewer'), car = $('#vcar'); v.hidden = false;
  car.innerHTML = photos.map((p, i) => `<img ${Math.abs(i - start) <= 1 ? 'src' : 'data-src'}="${p}" alt="" draggable="false">`).join('');
  const imgs = [...car.querySelectorAll('img')], upd = () => {
    const i = Math.round(car.scrollLeft / Math.max(1, car.clientWidth)); $('#vcount').textContent = `${i + 1} / ${photos.length} · swipe for more`;
    [i - 1, i, i + 1].forEach(k => { const im = imgs[k]; if (im && im.dataset.src) { im.src = im.dataset.src; im.removeAttribute('data-src') } });
  };
  car.onscroll = upd; requestAnimationFrame(() => { car.scrollLeft = start * car.clientWidth; upd() });
}
$('#vclose').onclick = () => $('#viewer').hidden = true;

// ---------------------------------------------------------------- tabs
let mapDirty = true, map = null, layer = null;
document.querySelectorAll('.tab').forEach(b => b.onclick = () => showTab(b.dataset.v));
function showTab(v) {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.v === v));
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  $('#actions').hidden = v !== 'swipe' || !queue().length;
  if (v === 'map') initMap().then(() => { map.invalidateSize(); if (mapDirty) drawKept() });
  if (v === 'list') drawList();
}

// ---------------------------------------------------------------- map (bundled Leaflet + Japan GeoJSON, no tile servers)
const COL = { Ikon: '#f2a900', Epic: '#1a5cc8' };
let mapReady = null;
function initMap() {
  if (mapReady) return mapReady;
  map = L.map('map', { zoomSnap: 0.5, tap: false }).setView([38.6, 139.5], 5.5);
  map.attributionControl.setPrefix(false); map.attributionControl.addAttribution('Base: dataofjapan/land (simplified, offline)');
  mapReady = fetch('japan.json?v=' + V).then(r => r.json()).then(G => {
    L.geoJSON(G, { style: { color: '#8a8a7a', weight: .8, fillColor: '#f3efe2', fillOpacity: 1 }, interactive: false }).addTo(map);
    const KEY = { Hokkaido: 1, Iwate: 1, Nagano: 1, Niigata: 1, Yamagata: 1, Fukushima: 1, Akita: 1, Tokyo: 1, Aomori: 1 };
    G.features.forEach(f => { const k = (f.properties.n || '').split(' ')[0]; if (KEY[k]) L.marker(f.properties.c, { interactive: false, icon: L.divIcon({ className: 'plab', html: k + ' ' + f.properties.nj, iconSize: [110, 14], iconAnchor: [55, 7] }) }).addTo(map) });
    D.resorts.forEach(r => L.marker([r.lat, r.lon], { icon: L.divIcon({ className: '', html: `<div class="ski" style="background:${COL[r.pass_]}">⛷</div>`, iconSize: [22, 22] }) }).addTo(map).bindTooltip(`${r.name} (${r.pass_})`));
    const lg = L.control({ position: 'topright' }); lg.onAdd = () => { const d = L.DomUtil.create('div', 'legend'); d.innerHTML = `<span class="dot" style="background:${COL.Ikon}"></span>Ikon<br><span class="dot" style="background:${COL.Epic}"></span>Epic<br>🏠 Kept`; return d }; lg.addTo(map);
    layer = L.layerGroup().addTo(map); map.on('click', () => $('#sheet').hidden = true);
  });
  return mapReady;
}
function kept() { return D.listings.filter(l => dec[l.id]?.d === 'keep') }
function drawKept() {
  mapDirty = false; layer.clearLayers(); const k = kept(); const R = {}; D.resorts.forEach(r => R[r.name] = r);
  k.forEach(l => {
    L.marker([l.lat, l.lon], { icon: L.divIcon({ className: '', html: '<div class="house">🏠</div>', iconSize: [28, 28], iconAnchor: [14, 14] }) }).on('click', e => { L.DomEvent.stopPropagation(e); sheet(l) }).addTo(layer);
    const r = R[l.near[0].name]; if (r) L.polyline([[l.lat, l.lon], [r.lat, r.lon]], { color: COL[r.pass_], dashArray: '6 6', weight: 2, interactive: false }).addTo(layer);
  });
  if (k.length) map.fitBounds(L.latLngBounds(k.map(l => [l.lat, l.lon])).pad(0.5), { maxZoom: 9 });
  else toast('No kept houses yet – swipe right on ones you like');
}
function sheet(l) {
  const s = $('#sheet'); s.hidden = false;
  s.innerHTML = `<button class="x" aria-label="Close">✕</button>${l.rank ? `<span class="pill Ikon">Shortlist #${l.rank}</span>` : ''}${l.status !== 'active' ? `<span class="gone">${l.status === 'land_only' ? 'LAND ONLY (hidden)' : 'NO LONGER LISTED'}</span>` : ''}
  <div class="price">¥${fmt(l.jpy)} <small>≈ US$${fmt(l.usd)}</small></div><div class="ttl">${esc(l.title)}</div>
  <div class="loc">📍 ${esc(l.city_en)}, ${esc(l.pref)} ${l.prec === 'city' ? '(town-level, approx)' : '(approx)'}</div>${nearHTML(l, true)}
  <div class="specs">${specs(l).map(x => `<span>${x}</span>`).join('')}</div><div class="chips">${l.flags.map(f => `<span class="chip">${esc(f)}</span>`).join('')}</div>
  <div class="gal">${l.photos.map((p, i) => `<img loading="lazy" src="${p}" data-i="${i}" alt="">`).join('')}</div>
  <a class="lnk" href="${esc(l.url)}" target="_blank" rel="noopener">Open listing ↗</a> &nbsp; <button class="unk">Un-keep</button>`;
  s.querySelector('.x').onclick = () => s.hidden = true;
  s.querySelectorAll('.gal img').forEach(im => im.onclick = () => viewer(l.photos, +im.dataset.i));
  s.querySelector('.unk').onclick = () => { delete dec[l.id]; saveDec(); s.hidden = true; drawKept(); render(); toast('Moved back to the deck') };
}

// ---------------------------------------------------------------- kept list
function drawList() {
  const k = kept().sort((a, b) => a.near[0].min - b.near[0].min), t = D.listings.filter(l => dec[l.id]?.d === 'toss');
  $('#list').innerHTML = (k.length ? '' : '<p class="small" style="padding:20px;text-align:center">Nothing kept yet – swipe right (or ♥) on houses you like.</p>') +
    k.map(l => `<div class="li" data-id="${l.id}"><img loading="lazy" src="${l.thumb || l.photos[0] || ''}" alt=""><div class="b">
      <div><b>¥${fmt(l.jpy)}</b> <span class="small">≈ $${fmt(l.usd)}</span> ${l.status !== 'active' ? `<span class="gone">${l.status === 'land_only' ? 'LAND ONLY (hidden)' : 'NO LONGER LISTED'}</span>` : ''}</div>
      <div class="t">${esc(l.title)}</div><div class="small">⛷ ${esc(l.near[0].name)} ~${l.near[0].min} min · ${esc(l.city_en)}</div>
      <div class="row"><a href="${esc(l.url)}" target="_blank" rel="noopener">Listing ↗</a><a href="#" class="onmap">Map</a><a href="#" class="pics">Photos (${l.photos.length})</a><button class="unk">Un-keep</button></div></div></div>`).join('') +
    `<details class="tossed"><summary>Tossed (${t.length})</summary>${t.map(l => `<div class="tl" data-id="${l.id}"><span>¥${fmt(l.jpy)} · ${esc(l.title)}</span><a href="#" class="restore">restore</a></div>`).join('') || '<p class="small">none</p>'}</details>`;
  $('#list').querySelectorAll('.li').forEach(e => {
    const l = byId[e.dataset.id];
    e.querySelector('.unk').onclick = () => { delete dec[l.id]; saveDec(); mapDirty = true; render(); drawList(); toast('Moved back to the deck') };
    e.querySelector('.onmap').onclick = ev => { ev.preventDefault(); showTab('map'); mapReady.then(() => { map.setView([l.lat, l.lon], 10); sheet(l) }) };
    e.querySelector('.pics').onclick = ev => { ev.preventDefault(); if (l.photos.length) viewer(l.photos, 0) };
  });
  $('#list').querySelectorAll('.restore').forEach(a => a.onclick = ev => { ev.preventDefault(); const id = a.closest('.tl').dataset.id; delete dec[id]; saveDec(); render(); drawList(); toast('Restored to the deck') });
}

// ---------------------------------------------------------------- menu: export / import / reset / tip
const menu = $('#menu');
$('#menuBtn').onclick = () => { menu.hidden = false }; $('#mClose').onclick = () => menu.hidden = true; menu.onclick = e => { if (e.target === menu) menu.hidden = true };
const exportBlob = () => new Blob([JSON.stringify({ app: 'akiya-keep-or-toss', version: 1, exported: new Date().toISOString(), decisions: dec }, null, 1)], { type: 'application/json' });
const exportName = () => 'akiya-decisions-' + new Date().toISOString().slice(0, 10) + '.json';
$('#mExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(exportBlob()); a.download = exportName(); document.body.appendChild(a); a.click(); a.remove(); toast('Exported') };
try { if (navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })) $('#mShare').hidden = false } catch (e) { }
$('#mShare').onclick = () => navigator.share({ files: [new File([exportBlob()], exportName(), { type: 'application/json' })], title: 'Akiya decisions' }).catch(() => { });
$('#mImport').onclick = () => $('#impFile').click();
$('#impFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => {
    const j = JSON.parse(t), inc = j.decisions || j; let n = 0;
    for (const [id, v] of Object.entries(inc)) { if (!v || !v.d) continue; if (!dec[id] || (v.t || '') > (dec[id].t || '')) { dec[id] = v; n++ } }
    saveDec(); mapDirty = true; render(); menu.hidden = true; toast(`Imported ${n} decisions`);
  }).catch(err => alert('Could not read that file: ' + err)); e.target.value = '';
};
$('#mReset').onclick = () => { if (confirm('Clear all your keep/toss decisions on this device?')) { dec = {}; front = []; undoStack = []; saveDec(); mapDirty = true; render(); menu.hidden = true } };
const standalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
function showTip(force) {
  if (!force && (localStorage.getItem(LS_TIP) || standalone())) return;
  const t = $('#tip'); t.hidden = false;
  t.innerHTML = `<details id="tipD"${force ? ' open' : ''}><summary>Tips: Install And Use</summary><div class="small"><b>Add to Home Screen:</b> tap Share, then <b>Add to Home Screen</b>.<br>
  Swipe the <b>text area</b> left/right (or use the buttons) to toss/keep; swipe or tap the <b>photo</b> to see more photos. Your list stays on this phone. Safari and the Home-Screen app keep separate lists, so install first (or use the menu: Export/Import).</div><button id="tipOk">Got it</button></details>`;
  $('#tipOk').onclick = () => { t.hidden = true; localStorage.setItem(LS_TIP, '1') };
}
$('#mTip').onclick = () => { menu.hidden = true; showTip(true) };

// ---------------------------------------------------------------- boot
fetch('data.json?v=' + V).then(r => r.json()).then(data => {
  D = data; D.listings.forEach(l => byId[l.id] = l);
  ACTIVE = D.listings.filter(l => l.status === 'active').sort((a, b) => a.near[0].min - b.near[0].min || a.jpy - b.jpy);
  let ses = load(LS_SES, null);
  if (!ses) ses = { gen: D.generated, known: D.listings.map(l => l.id), fresh: [] };
  else if (ses.gen !== D.generated) { const k = new Set(ses.known); ses.fresh = ACTIVE.filter(l => !k.has(l.id)).map(l => l.id); ses.known = [...new Set([...ses.known, ...D.listings.map(l => l.id)])]; ses.gen = D.generated }
  localStorage.setItem(LS_SES, JSON.stringify(ses)); FRESH = new Set(ses.fresh);
  $('#about').textContent = `Data ${D.generated.slice(0, 10)} · ${ACTIVE.length} active listings · FX 1 USD = ${D.fx.toFixed(2)} JPY · drive times = ${D.drive_model}. App ${V}.`;
  render(); showTip(false);
}).catch(e => { $('#deck').innerHTML = `<p style="padding:20px">Could not load data (${esc(e)}). Open this app over http(s).</p>` });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });

// ---------------------------------------------------------------- Submit to Japan Cottage (shared receiver)
const submitOpts = () => ({ agent: 'japan-cottage', app: 'akiya-swipe', deck: 'akiya-' + new Date().toISOString().slice(0, 10),
  getResults: () => { const r = { app: 'akiya-keep-or-toss', version: 1, exported: new Date().toISOString(), decisions: dec }; try { localStorage.setItem('akiya_submit_backup_v1', JSON.stringify(r)) } catch (_) { } return r },
  getNotes: () => '' });
if (window.MWSubmit) { MWSubmit.button($('#submitBox'), submitOpts()); MWSubmit.button($('#submitBoxMenu'), submitOpts()); }
