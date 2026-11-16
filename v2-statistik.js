// ===== Puck & Ride v2 – Statistik und Stadien =====

function computeStats() {
  const st = {}, guestSt = {};
  const blank = () => ({ fH:0, fA:0, mH:0, mA:0, kmH:0, kmA:0 });
  S.profiles.filter(p => p.approved).forEach(p => st[p.id] = blank());
  S.games.filter(g => new Date(g.starts_at) < new Date()).forEach(g => {
    const home = isHome(g), km = gameKm(g);
    g.signups.forEach(r => {
      const x = st[r.user_id] = st[r.user_id] || blank();
      if (r.role === 'fahrer') { home ? x.fH++ : x.fA++; home ? x.kmH += km : x.kmA += km; }
      else { home ? x.mH++ : x.mA++; }
    });
    (g.guests || []).forEach(gu => {
      const k = gu.name.trim();
      const x = guestSt[k] = guestSt[k] || blank();
      home ? x.mH++ : x.mA++;
    });
  });
  return { st, guestSt };
}

function renderStatistik() {
  const { st, guestSt } = computeStats();
  const rows = Object.entries(st).map(([id, x]) => ({ id, ...x, km: x.kmH + x.kmA, f: x.fH + x.fA, m: x.mH + x.mA }))
    .sort((a, b) => b.km - a.km);
  const medal = ['🥇','🥈','🥉'];
  const avg = rows.length ? rows.reduce((s, r) => s + r.km, 0) / rows.length : 0;
  const money = S.me.is_admin && S.settings.geld_aktiv;
  const rp = Number(S.settings.rappen_pro_km || 0.2);

  let h = `<div class="card"><h3>📊 Fahrer-Statistik</h3>
    <table><tr><th>Name</th><th class="n">🔵 Heim</th><th class="n">🚗 Auswärts</th><th class="n">km</th>${money ? '<th class="n">CHF</th>' : ''}</tr>
    ${rows.map((r, i) => `<tr><td>${r.km ? (medal[i] || '') : ''} ${nameOf(r.id)}${prof(r.id).company_car ? ' 🏢' : ''}</td>
      <td class="n">${r.fH}</td><td class="n">${r.fA}</td><td class="n"><b>${r.km}</b></td>
      ${money ? `<td class="n">${((r.km - avg) * rp).toFixed(2)}</td>` : ''}</tr>`).join('')}
    </table><small>Fahrten als Fahrer · Schnitt ${Math.round(avg)} km</small></div>

    <div class="card"><h3>🧍 Mitfahrten</h3>
    <table><tr><th>Name</th><th class="n">🔵 Heim</th><th class="n">🚗 Auswärts</th><th class="n">Total</th><th class="n">selber gefahren</th></tr>
    ${rows.slice().sort((a, b) => b.m - a.m).map(r => `<tr><td>${nameOf(r.id)}</td><td class="n">${r.mH}</td><td class="n">${r.mA}</td><td class="n"><b>${r.m}</b></td><td class="n">${r.f}</td></tr>`).join('')}
    </table></div>`;

  const gl = Object.entries(guestSt);
  if (gl.length) h += `<div class="card"><h3>👋 Gäste</h3>
    <table><tr><th>Name</th><th class="n">🔵 Heim</th><th class="n">🚗 Auswärts</th></tr>
    ${gl.map(([n, x]) => `<tr><td>${esc(n)} <small>(Gast)</small></td><td class="n">${x.mH}</td><td class="n">${x.mA}</td></tr>`).join('')}
    </table></div>`;

  h += `<button class="secondary" onclick="shareStats()">📲 Stand in WhatsApp teilen</button>`;
  $('view-statistik').innerHTML = h;
}

function shareStats() {
  const { st } = computeStats();
  const rows = Object.entries(st).map(([id, x]) => ({ id, km: x.kmH + x.kmA, f: x.fH + x.fA })).sort((a, b) => b.km - a.km);
  const text = '🏒 Puck & Ride – Stand\n' + rows.map((r, i) => `${i + 1}. ${prof(r.id).display_name || 'Unbekannt'}: ${r.f} Fahrten, ${r.km} km`).join('\n');
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// ---------- Backup als CSV (nur Admin) ----------
function exportCsv() {
  const { st } = computeStats();
  const lines = [['Name','Fahrten Heim','Fahrten Auswärts','km Heim','km Auswärts','km Total','Mitfahrten Heim','Mitfahrten Auswärts']];
  Object.entries(st).forEach(([id, x]) => lines.push([prof(id).display_name || '', x.fH, x.fA, x.kmH, x.kmA, x.kmH + x.kmA, x.mH, x.mA]));
  lines.push([]); lines.push(['Spiel','Datum','Fahrer','Mitfahrer','Gäste']);
  S.games.forEach(g => lines.push([
    stadiumOf(g.stadium_id).team, new Date(g.starts_at).toLocaleString('de-CH'),
    g.signups.filter(r => r.role === 'fahrer').map(r => prof(r.user_id).display_name).join(' / '),
    g.signups.filter(r => r.role === 'mitfahrer').map(r => prof(r.user_id).display_name).join(' / '),
    (g.guests || []).map(x => x.name).join(' / ')
  ]));
  const csv = '\ufeff' + lines.map(l => l.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
  a.download = 'puck-and-ride-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}

// ---------- Stadien (übernommen) ----------
function renderStadien() {
  $('view-stadien').innerHTML = S.stadiums.map(s => {
    const target = s.address || (s.arena + ', ' + s.city);
    const pk = S.parking.filter(p => p.stadium_id === s.id);
    return `<div class="card ${s.favorite ? 'fav' : ''}">
      <div class="vs">${s.favorite ? '⭐ ' : ''}${esc(s.team)}</div>
      ${esc(s.arena)}, ${esc(s.city)}<br>
      <small>${s.km_einfach ? s.km_einfach + ' km einfach · ' + s.km_einfach * 2 + ' km hin und zurück' : 'Distanz folgt'}</small><br>
      <small><a href="${esc(s.sihf_url || 'https://www.sihf.ch/de/game-center/liga/spielplan/1-1')}" target="_blank">SIHF Spielplan</a> ·
      <a href="${esc(s.ep_url || 'https://www.eliteprospects.com/search/team?q=' + encodeURIComponent(s.team))}" target="_blank">Elite Prospects</a></small>
      <details><summary>🅿️ Anfahrt &amp; Parkplätze</summary>
        <p><small>Adresse: ${esc(s.address || 'noch nicht erfasst')}</small>
        ${S.me.is_admin ? `<button class="small secondary" onclick="editAddress(${s.id})">Adresse bearbeiten</button>` : ''}</p>
        <a href="${maps(target)}" target="_blank">🧭 Auf der Karte</a> ·
        <a href="${maps('Parkplatz in der Nähe von ' + target)}" target="_blank">🔎 Parkplätze suchen</a>
        ${pk.map(p => `<div class="park">🅿️ <b>${esc(p.name)}</b>${p.note ? ' – ' + esc(p.note) : ''}
          <a href="${maps(p.name + ', ' + s.city)}" target="_blank">Karte</a>
          ${(p.created_by === S.userId || S.me.is_admin) ? `<button class="small secondary" onclick="delPark(${p.id})">✕</button>` : ''}</div>`).join('')}
        <input id="pk-name-${s.id}" placeholder="Parkplatz-Tipp, z. B. Parkhaus Bahnhof">
        <input id="pk-note-${s.id}" placeholder="Hinweis, z. B. 5 Min. zu Fuss, CHF 10">
        <button class="small" onclick="addPark(${s.id})">Tipp hinzufügen</button>
      </details></div>`;
  }).join('');
}
function editAddress(id) {
  const s = stadiumOf(id), v = prompt('Adresse von ' + s.arena + ':', s.address || '');
  if (v === null) return;
  return once(async () => { const { error } = await sb.from('stadiums').update({ address:v.trim() || null }).eq('id', id); if (error) alert(nice(error)); loadAll(); });
}
function addPark(stadiumId) {
  const name = $('pk-name-' + stadiumId).value.trim();
  if (!name) { alert('Bitte einen Namen eingeben.'); return; }
  return once(async () => {
    const { error } = await sb.from('parking').insert({ stadium_id:stadiumId, name, note:$('pk-note-' + stadiumId).value.trim() || null });
    if (error) alert(nice(error)); loadAll();
  });
}
function delPark(id) {
  if (!confirm('Tipp löschen?')) return;
  return once(async () => { await sb.from('parking').delete().eq('id', id); loadAll(); });
}
