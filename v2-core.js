// ===== Puck & Ride v2 – Kern =====
const VERSION = '2.0';
const sb = supabase.createClient(
  'https://gthqsodiidamaofodggd.supabase.co',
  'sb_publishable_Z1fUiU-B-HpnHQ2SR2sxKw_9-vwIOE6'
);
const $ = id => document.getElementById(id);
const START = 'Telldenkmal, Altdorf UR';
const S = { userId:null, me:{}, profiles:[], stadiums:[], settings:{}, games:[], parking:[], contacts:[], feedback:[] };

// ---------- Hilfsfunktionen ----------
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const prof = id => S.profiles.find(p => p.id === id) || {};
const nameOf = id => esc(prof(id).display_name || 'Unbekannt');
const stadiumOf = id => S.stadiums.find(s => s.id === id) || {};
const fmt = d => new Date(d).toLocaleString('de-CH', { weekday:'short', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
const fmtTime = t => t ? String(t).slice(0, 5) : '';
const gameKm = g => g.km_override ?? (stadiumOf(g.stadium_id).km_einfach || 0) * 2;
const isHome = g => !!stadiumOf(g.stadium_id).favorite;
const maps = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const contactOf = id => S.contacts.find(c => c.user_id === id) || {};

function nice(error) {
  if (!error) return '';
  if (!navigator.onLine) return 'Keine Verbindung – versuch es gleich nochmal.';
  const m = String(error.message || error);
  if (m.includes('Invalid login')) return 'E-Mail oder Passwort stimmt nicht.';
  if (m.includes('already registered')) return 'Diese E-Mail ist schon registriert. Bitte anmelden.';
  if (m.includes('Password should')) return 'Das Passwort braucht mindestens 6 Zeichen.';
  if (m.includes('row-level security') || m.includes('permission')) return 'Das darfst du leider nicht.';
  return 'Das hat nicht geklappt – versuch es gleich nochmal.';
}
function toast(text) {
  const t = document.createElement('div');
  t.className = 'banner'; t.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;border-radius:12px;z-index:60;background:#1f9d57';
  t.textContent = text; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// Schutz vor Doppelklicks: Knopf sperrt sich, bis die Aktion fertig ist
let busy = false;
async function once(fn) {
  if (busy) return; busy = true;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await fn(); } finally { busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); }
}

// ---------- Offline und Updates ----------
function setOffline() { $('offline').hidden = navigator.onLine; }
window.addEventListener('online', () => { setOffline(); if (S.userId) loadAll(); });
window.addEventListener('offline', setOffline);
setOffline();

async function checkUpdate() {
  try {
    const r = await fetch(location.pathname + '?v=' + Date.now(), { cache:'no-store' });
    const html = await r.text();
    const m = html.match(/Version ([\d.]+)/);
    if (m && m[1] !== VERSION) $('update').hidden = false;
  } catch (e) {}
}
$('update').onclick = () => location.reload();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkUpdate(); if (S.userId) loadAll(); } });

// ---------- Login ----------
async function show(session) {
  const on = !!session;
  $('auth').hidden = on; $('logout').hidden = !on; $('btn-feedback').hidden = !on;
  if (!on) { $('app').hidden = true; $('pending').hidden = true; $('today').innerHTML = ''; S.userId = null; return; }
  S.userId = session.user.id;
  await loadAll();
}
$('login').onclick = () => once(async () => {
  const { error } = await sb.auth.signInWithPassword({ email:$('email').value.trim(), password:$('pw').value });
  $('msg').textContent = nice(error);
});
$('register').onclick = () => once(async () => {
  const { error } = await sb.auth.signUp({ email:$('email').value.trim(), password:$('pw').value });
  $('msg').textContent = error ? nice(error) : '';
  if (!error) { localStorage.removeItem('pr_tour'); toast('Registriert! Willkommen bei Puck & Ride.'); }
});
$('logout').onclick = () => sb.auth.signOut();

// ---------- Reiter ----------
const TABS = ['spiele','live','statistik','stadien','profil','admin'];
function openTab(t) {
  TABS.forEach(v => $('view-' + v).hidden = v !== t);
  document.querySelectorAll('nav button').forEach(x => x.className = x.dataset.tab === t ? '' : 'secondary');
  if (t === 'live' && window.startLive) startLive(); else if (window.stopLive) stopLive();
}
document.querySelectorAll('nav button').forEach(b => b.onclick = () => openTab(b.dataset.tab));

// ---------- Daten laden (mit Offline-Speicher) ----------
async function loadAll() {
  try {
    const { data: mine } = await sb.from('profiles').select('approved').eq('id', S.userId).single();
    if (!mine || !mine.approved) { $('app').hidden = true; $('pending').hidden = false; return; }
    $('pending').hidden = true; $('app').hidden = false;

    const [p, s, st, pk, g, c] = await Promise.all([
      sb.from('profiles').select('*'),
      sb.from('stadiums').select('*').order('favorite', { ascending:false }).order('team'),
      sb.from('settings').select('*').single(),
      sb.from('parking').select('*').order('id'),
      sb.from('games').select('*, signups(*), abo_offers(*), guests(*)').order('starts_at'),
      sb.from('private_contacts').select('*')
    ]);
    if (g.error) throw g.error;
    Object.assign(S, {
      profiles:p.data || [], stadiums:s.data || [], parking:pk.data || [], games:g.data || [], contacts:c.data || [],
      settings:st.data || { preis_steh:20, preis_sitz:30, max_pro_auto:5, geld_aktiv:false }
    });
    S.me = prof(S.userId);
    if (S.me.is_admin) {
      const f = await sb.from('feedback').select('*').order('created_at', { ascending:false });
      S.feedback = f.data || [];
    }
    localStorage.setItem('pr_cache', JSON.stringify({ ...S, feedback:[] }));
  } catch (e) {
    const cache = localStorage.getItem('pr_cache');
    if (!cache) { $('pending').hidden = true; return; }
    Object.assign(S, JSON.parse(cache), { userId:S.userId });
    $('app').hidden = false; setOffline();
  }
  renderAll();
}
function renderAll() {
  $('tab-admin').hidden = !S.me.is_admin;
  if (window.renderSpiele) renderSpiele();
  if (window.renderStatistik) renderStatistik();
  if (window.renderStadien) renderStadien();
  renderProfil(); renderAdmin(); renderToday(); startCountdown();
  if (window.maybeTour) maybeTour();
}

// ---------- Countdown ----------
let timer = null;
function startCountdown() {
  clearInterval(timer);
  const next = S.games.find(g => new Date(g.starts_at) > new Date());
  if (!next) { $('countdown').innerHTML = ''; $('hero-text').textContent = 'Noch kein Spiel geplant.'; return; }
  $('hero-text').innerHTML = `Nächstes Spiel: <b>${esc(stadiumOf(next.stadium_id).team)}</b> · ${fmt(next.starts_at)}`;
  const tick = () => {
    const d = Math.max(0, new Date(next.starts_at) - new Date()) / 1000;
    const t = [Math.floor(d / 86400), Math.floor(d % 86400 / 3600), Math.floor(d % 3600 / 60), Math.floor(d % 60)];
    $('countdown').innerHTML = ['Tage','Std','Min','Sek'].map((l, i) => `<div><b>${String(t[i]).padStart(2,'0')}</b><small>${l}</small></div>`).join('');
  };
  tick(); timer = setInterval(tick, 1000);
}

// ---------- Spieltags-Kasten ----------
function renderToday() {
  const now = new Date();
  const g = S.games.find(x => {
    const d = new Date(x.starts_at);
    return d.toDateString() === now.toDateString() && d > new Date(now - 3 * 3600e3) && x.signups.some(r => r.user_id === S.userId);
  });
  if (!g) { $('today').innerHTML = ''; return; }
  const s = stadiumOf(g.stadium_id), mine = g.signups.find(r => r.user_id === S.userId);
  let line;
  if (mine.role === 'fahrer') {
    const n = g.signups.filter(r => r.fahrer_id === S.userId && r.user_id !== S.userId).length + (g.guests || []).filter(x => x.fahrer_id === S.userId).length;
    line = `🚗 Du fährst${g.abfahrt ? ', Abfahrt ' + fmtTime(g.abfahrt) : ''} · ${n} Mitfahrer`;
  } else if (mine.fahrer_id) {
    line = `🧍 Du fährst bei <b>${nameOf(mine.fahrer_id)}</b> mit${mine.abholzeit ? ', Abholung ' + fmtTime(mine.abholzeit) + ' bei dir' : ''}`;
  } else line = '🧍 Du bist dabei – der Fahrer teilt dich noch ein.';
  $('today').innerHTML = `<div class="card today"><div class="vs">🏒 Heute: ${esc(s.team)}</div><small>${esc(s.arena)} · ${fmtTime(new Date(g.starts_at).toTimeString())}</small><p>${line}</p></div>`;
}

// ---------- Profil ----------
function renderProfil() {
  const me = S.me, c = contactOf(S.userId);
  $('view-profil').innerHTML = `<div class="card">
    <h3>👤 Mein Profil</h3>
    <input id="p-name" placeholder="Name" value="${esc(me.display_name)}">
    <input id="p-phone" placeholder="Handynummer (für Twint)" value="${esc(me.phone)}" inputmode="tel">
    <input id="p-addr" placeholder="Abholadresse (freiwillig)" value="${esc(c.pickup_address)}">
    <small>🔒 Die Adresse sehen nur Leute, die fürs gleiche Spiel angemeldet sind.</small>
    <input id="p-car" placeholder="Auto, z. B. VW Golf" value="${esc(me.car)}">
    <label>Sitzplätze inkl. Fahrer</label>
    <input id="p-seats" type="number" min="1" max="9" value="${me.seats || 5}" inputmode="numeric">
    <label class="check"><input id="p-company" type="checkbox" ${me.company_car ? 'checked' : ''}> 🏢 Firmenauto</label>
    <label class="check"><input id="p-abo" type="checkbox" ${me.has_abo ? 'checked' : ''}> 🎟️ Ich habe ein Ambrì-Abo</label>
    <select id="p-abotype">
      <option value="">Abo-Typ wählen</option>
      <option value="steh" ${me.abo_type === 'steh' ? 'selected' : ''}>Stehplatz</option>
      <option value="sitz" ${me.abo_type === 'sitz' ? 'selected' : ''}>Sitzplatz</option>
    </select>
    <button id="p-save">Speichern</button>
  </div>`;
  $('p-save').onclick = () => once(async () => {
    const a = $('p-abo').checked;
    const { error } = await sb.from('profiles').update({
      display_name:$('p-name').value.trim(), phone:$('p-phone').value.trim(), car:$('p-car').value.trim(),
      seats:parseInt($('p-seats').value) || 5, company_car:$('p-company').checked,
      has_abo:a, abo_type:a ? ($('p-abotype').value || null) : null
    }).eq('id', S.userId);
    if (error) { alert(nice(error)); return; }
    const addr = $('p-addr').value.trim();
    const r = await sb.from('private_contacts').upsert({ user_id:S.userId, pickup_address:addr || null });
    if (r.error) { alert(nice(r.error)); return; }
    toast('Gespeichert ✔'); loadAll();
  });
}

// ---------- Admin ----------
function renderAdmin() {
  if (!S.me.is_admin) { $('view-admin').innerHTML = ''; return; }
  const st = S.settings;
  const users = S.profiles.slice().sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1));
  $('view-admin').innerHTML = `<div class="card">
    <h3>⚙️ Einstellungen</h3>
    <label>WhatsApp-Gruppenlink</label>
    <input id="a-wa" placeholder="https://chat.whatsapp.com/..." value="${esc(st.whatsapp_link)}">
    <label>Abo-Beitrag Stehplatz (CHF)</label>
    <input id="a-steh" type="number" step="1" value="${st.preis_steh ?? 20}">
    <label>Abo-Beitrag Sitzplatz (CHF)</label>
    <input id="a-sitz" type="number" step="1" value="${st.preis_sitz ?? 30}">
    <label>Standard-Plätze pro Auto</label>
    <input id="a-max" type="number" min="1" max="9" value="${st.max_pro_auto ?? 5}">
    <details><summary>Erweitert</summary>
      <label class="check"><input id="a-geld" type="checkbox" ${st.geld_aktiv ? 'checked' : ''}> Geldausgleich pro km anzeigen</label>
      <label>CHF pro km</label>
      <input id="a-rp" type="number" step="0.05" value="${st.rappen_pro_km ?? 0.2}">
    </details>
    <button id="a-save">Speichern</button>
    <button id="a-csv" class="secondary">📥 Backup als CSV</button>
  </div>
  <div class="card">
    <h3>👥 Mitglieder</h3>
    ${users.map(p => `<div class="park">${p.approved ? '✅' : '⏳'} <b>${esc(p.display_name || 'Unbekannt')}</b>${p.is_admin ? ' ⭐' : ''}
      ${p.id === S.userId ? '<small>(du)</small>' : p.approved
        ? `<button class="small secondary" onclick="setApproved('${p.id}', false)">Sperren</button>`
        : `<button class="small good" onclick="setApproved('${p.id}', true)">Freigeben</button>`}</div>`).join('')}
  </div>
  <div class="card">
    <h3>💬 Feedback</h3>
    ${S.feedback.length ? S.feedback.map(f => `<div class="park"><b>${nameOf(f.user_id)}</b> <small>${fmt(f.created_at)}</small><br>${esc(f.text)}</div>`).join('') : '<small>Noch kein Feedback.</small>'}
  </div>`;
  $('a-save').onclick = () => once(async () => {
    const { error } = await sb.from('settings').update({
      whatsapp_link:$('a-wa').value.trim() || null,
      preis_steh:parseFloat($('a-steh').value), preis_sitz:parseFloat($('a-sitz').value),
      max_pro_auto:parseInt($('a-max').value), geld_aktiv:$('a-geld').checked,
      rappen_pro_km:parseFloat($('a-rp').value)
    }).eq('id', 1);
    if (error) alert(nice(error)); else { toast('Gespeichert ✔'); loadAll(); }
  });
  $('a-csv').onclick = () => window.exportCsv && exportCsv();
}
async function setApproved(uid, ok) {
  await once(async () => {
    const { error } = await sb.rpc('approve_user', { uid, ok });
    if (error) alert(nice(error)); else loadAll();
  });
}

// ---------- Feedback ----------
$('btn-feedback').onclick = () => {
  $('overlay').innerHTML = `<div class="sheet"><div class="big">💬</div><h3>Idee oder Problem?</h3>
    <textarea id="fb-text" rows="4" placeholder="Ein Satz reicht."></textarea>
    <button id="fb-send">Senden</button><button class="secondary" onclick="closeOverlay()">Abbrechen</button></div>`;
  $('overlay').hidden = false;
  $('fb-send').onclick = () => once(async () => {
    const text = $('fb-text').value.trim();
    if (!text) return;
    const { error } = await sb.from('feedback').insert({ user_id:S.userId, text });
    if (error) { alert(nice(error)); return; }
    closeOverlay(); toast('Danke! Feedback ist angekommen.');
  });
};
function closeOverlay() { $('overlay').hidden = true; $('overlay').innerHTML = ''; }

// ---------- Start ----------
sb.auth.getSession().then(({ data }) => show(data.session));
sb.auth.onAuthStateChange((_e, session) => { if (!session || session.user.id !== S.userId) show(session); });
checkUpdate();
