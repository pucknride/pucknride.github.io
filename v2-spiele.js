// ===== Puck & Ride v2 – Spiele, Anmeldung, Gäste, Fahrer-Einteilung =====

function seatInfo(g) {
  const drivers = g.signups.filter(r => r.role === 'fahrer');
  const cap = drivers.reduce((n, d) => n + (prof(d.user_id).seats || S.settings.max_pro_auto || 5), 0);
  const people = g.signups.length + (g.guests || []).length;
  return { drivers, cap, people, free: cap - people };
}

function kmSoFar() {
  const km = {};
  S.games.filter(g => new Date(g.starts_at) < new Date()).forEach(g =>
    g.signups.filter(r => r.role === 'fahrer').forEach(r => km[r.user_id] = (km[r.user_id] || 0) + gameKm(g)));
  return km;
}

function renderSpiele() {
  const now = new Date(), km = kmSoFar();
  const list = S.games.filter(g => new Date(g.starts_at) > new Date(now - 6 * 3600e3));
  let h = `<div class="card"><h3>➕ Neues Spiel</h3>
    <select id="g-stadium">${S.stadiums.map(s => `<option value="${s.id}">${esc(s.team)} (${esc(s.city)})</option>`).join('')}</select>
    <input id="g-date" type="datetime-local">
    <button id="g-add">Spiel erfassen</button></div>`;
  if (!list.length) h += '<div class="card">Noch keine Spiele erfasst. Wer startet? 🏒</div>';

  h += list.map(g => {
    const s = stadiumOf(g.stadium_id), si = seatInfo(g);
    const mine = g.signups.find(r => r.user_id === S.userId);
    const riders = g.signups.filter(r => r.role === 'mitfahrer');
    const guests = g.guests || [];
    const badge = !si.drivers.length ? '<span class="seats full">🚗 Noch kein Fahrer</span>'
      : si.free > 0 ? `<span class="seats free">🪑 noch ${si.free} ${si.free === 1 ? 'Platz' : 'Plätze'} frei</span>`
      : si.free === 0 ? '<span class="seats">🪑 voll</span>'
      : `<span class="seats full">⚠️ ${-si.free} zu viel – es braucht noch ein Auto</span>`;

    let hint = '';
    if (si.people && si.free < 0) {
      const v = riders.slice().sort((a, b) => (km[a.user_id] || 0) - (km[b.user_id] || 0))[0];
      if (v) hint = `<small>💡 Vorschlag: ${nameOf(v.user_id)} (bisher ${km[v.user_id] || 0} km als Fahrer)</small>`;
    }

    const cars = si.drivers.map(d => {
      const pax = g.signups.filter(r => r.fahrer_id === d.user_id && r.user_id !== d.user_id)
        .sort((a, b) => (a.abhol_reihenfolge || 99) - (b.abhol_reihenfolge || 99));
      const gpax = guests.filter(x => x.fahrer_id === d.user_id);
      return `<div class="park">🚗 <b>${nameOf(d.user_id)}</b>${prof(d.user_id).car ? ' · ' + esc(prof(d.user_id).car) : ''}
        ${pax.map(r => `<br>&nbsp;&nbsp;${r.abhol_reihenfolge ? r.abhol_reihenfolge + '. ' : ''}${nameOf(r.user_id)}${r.abholzeit ? ' · ' + fmtTime(r.abholzeit) : ''}`).join('')}
        ${gpax.map(x => `<br>&nbsp;&nbsp;👋 ${esc(x.name)} (Gast)`).join('')}</div>`;
    }).join('');
    const open = riders.filter(r => !r.fahrer_id);
    const openGuests = guests.filter(x => !x.fahrer_id);

    let actions;
    if (!mine) actions = `<div class="row">
        <button class="good" onclick="signup(${g.id},'fahrer')">🚗 Ich fahre</button>
        <button onclick="signup(${g.id},'mitfahrer')">🧍 Ich fahre mit</button></div>`;
    else actions = `<div class="row">
        ${mine.role === 'fahrer' ? `<button onclick="planCar(${g.id})">🗺️ Einteilen & Route</button>` : ''}
        <button class="secondary" onclick="addGuest(${g.id})">👋 Gast mitnehmen</button>
        <button class="danger" onclick="signoff(${g.id})">❌ Ich kann doch nicht</button></div>`;

    return `<div class="card ${s.favorite ? 'fav' : ''}">
      <div class="vs">${s.favorite ? '🔵⚪ ' : '🚗 '}${esc(s.team)}</div>
      <small>${esc(s.arena)} · ${fmt(g.starts_at)} · ${gameKm(g)} km hin und zurück</small>
      ${g.abfahrt ? `<br><small>⏰ Abfahrt ${fmtTime(g.abfahrt)}</small>` : ''}
      <p>${badge}</p>${hint}
      ${cars}
      ${open.length || openGuests.length ? `<div class="park">🧍 Noch nicht eingeteilt: ${[...open.map(r => nameOf(r.user_id)), ...openGuests.map(x => esc(x.name) + ' (Gast)')].join(', ')}</div>` : ''}
      ${guests.filter(x => x.eingeladen_von === S.userId).map(x => `<small>👋 Dein Gast ${esc(x.name)} <a href="#" onclick="delGuest('${x.id}');return false">entfernen</a></small><br>`).join('')}
      ${actions}
      <button class="small secondary" onclick="shareGame(${g.id})">📲 In WhatsApp teilen</button>
      ${S.me.is_admin ? `<button class="small secondary" onclick="fixKm(${g.id}, '${g.km_override ?? ''}')">km korrigieren</button>
        <button class="small danger" onclick="delGame(${g.id})">Spiel löschen</button>` : ''}
      ${aboBlock(g)}
    </div>`;
  }).join('');
  $('view-spiele').innerHTML = h;

  $('g-add').onclick = () => once(async () => {
    if (!$('g-date').value) { alert('Bitte Datum und Zeit wählen.'); return; }
    const { error } = await sb.from('games').insert({ stadium_id:parseInt($('g-stadium').value), starts_at:new Date($('g-date').value).toISOString(), created_by:S.userId });
    if (error) alert(nice(error)); else { toast('Spiel erfasst ✔'); loadAll(); }
  });
}

// ---------- Anmelden / Abmelden ----------
function signup(gameId, role) {
  return once(async () => {
    const row = { game_id:gameId, user_id:S.userId, role, fahrer_id: role === 'fahrer' ? S.userId : null };
    const { error } = await sb.from('signups').upsert(row);
    if (error) alert(nice(error)); else { toast(role === 'fahrer' ? 'Du fährst 🚗' : 'Du bist dabei 🧍'); loadAll(); }
  });
}
function signoff(gameId) {
  if (!confirm('Sicher? Dein Platz wird wieder frei.')) return;
  return once(async () => {
    await sb.from('signups').update({ fahrer_id:null, abholzeit:null, abhol_reihenfolge:null }).eq('game_id', gameId).eq('fahrer_id', S.userId).neq('user_id', S.userId);
    await sb.from('guests').update({ fahrer_id:null }).eq('game_id', gameId).eq('fahrer_id', S.userId);
    const { error } = await sb.from('signups').delete().eq('game_id', gameId).eq('user_id', S.userId);
    if (error) alert(nice(error)); else { toast('Abgemeldet – Platz ist frei.'); loadAll(); }
  });
}

// ---------- Gäste ----------
function addGuest(gameId) {
  const name = prompt('Name des Gasts:');
  if (!name || !name.trim()) return;
  return once(async () => {
    const { error } = await sb.from('guests').insert({ game_id:gameId, eingeladen_von:S.userId, name:name.trim() });
    if (error) alert(nice(error)); else { toast('Gast eingetragen 👋'); loadAll(); }
  });
}
function delGuest(id) {
  return once(async () => { await sb.from('guests').delete().eq('id', id); loadAll(); });
}

// ---------- Fahrer: einteilen, Zeiten, Route ----------
function planCar(gameId) {
  const g = S.games.find(x => x.id === gameId);
  const free = g.signups.filter(r => r.role === 'mitfahrer' && (!r.fahrer_id || r.fahrer_id === S.userId));
  const guests = (g.guests || []).filter(x => !x.fahrer_id || x.fahrer_id === S.userId);
  $('overlay').innerHTML = `<div class="sheet" style="text-align:left;max-height:90vh;overflow:auto">
    <h3>🗺️ Mein Auto</h3>
    <label>⏰ Abfahrt</label><input id="pl-abfahrt" type="time" value="${fmtTime(g.abfahrt)}">
    <h4>Wer fährt bei mir mit?</h4>
    ${free.map(r => `<div class="park"><label class="check"><input type="checkbox" data-u="${r.user_id}" ${r.fahrer_id === S.userId ? 'checked' : ''}> ${nameOf(r.user_id)}</label>
      <div class="row"><input data-o="${r.user_id}" type="number" min="1" placeholder="Reihenfolge" value="${r.abhol_reihenfolge || ''}" style="flex:1">
      <input data-t="${r.user_id}" type="time" value="${fmtTime(r.abholzeit)}" style="flex:1"></div>
      <small>📍 ${esc(contactOf(r.user_id).pickup_address || 'keine Adresse hinterlegt')}</small></div>`).join('') || '<small>Keine offenen Mitfahrer.</small>'}
    ${guests.map(x => `<div class="park"><label class="check"><input type="checkbox" data-g="${x.id}" ${x.fahrer_id === S.userId ? 'checked' : ''}> 👋 ${esc(x.name)} (Gast)</label></div>`).join('')}
    <button id="pl-save" class="good">Speichern</button>
    <button id="pl-route">🧭 Route in Google Maps</button>
    <button class="secondary" onclick="closeOverlay()">Schliessen</button></div>`;
  $('overlay').hidden = false;

  $('pl-save').onclick = () => once(async () => {
    const ab = $('pl-abfahrt').value || null;
    let e = (await sb.from('games').update({ abfahrt:ab }).eq('id', gameId)).error;
    for (const r of free) {
      const on = document.querySelector(`[data-u="${r.user_id}"]`).checked;
      const res = await sb.from('signups').update({
        fahrer_id: on ? S.userId : null,
        abhol_reihenfolge: on ? (parseInt(document.querySelector(`[data-o="${r.user_id}"]`).value) || null) : null,
        abholzeit: on ? (document.querySelector(`[data-t="${r.user_id}"]`).value || null) : null
      }).eq('game_id', gameId).eq('user_id', r.user_id);
      e = e || res.error;
    }
    for (const x of guests) {
      const on = document.querySelector(`[data-g="${x.id}"]`).checked;
      const res = await sb.from('guests').update({ fahrer_id: on ? S.userId : null }).eq('id', x.id);
      e = e || res.error;
    }
    if (e) alert(nice(e)); else { toast('Gespeichert ✔'); closeOverlay(); loadAll(); }
  });

  $('pl-route').onclick = () => {
    const s = stadiumOf(g.stadium_id);
    const stops = free.filter(r => document.querySelector(`[data-u="${r.user_id}"]`).checked)
      .sort((a, b) => (parseInt(document.querySelector(`[data-o="${a.user_id}"]`).value) || 99) - (parseInt(document.querySelector(`[data-o="${b.user_id}"]`).value) || 99))
      .map(r => contactOf(r.user_id).pickup_address).filter(Boolean);
    const from = contactOf(S.userId).pickup_address || START;
    const to = s.address || (s.arena + ', ' + s.city);
    let url = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(from) + '&destination=' + encodeURIComponent(to);
    if (stops.length) url += '&waypoints=' + encodeURIComponent(stops.join('|'));
    window.open(url, '_blank');
  };
}

// ---------- WhatsApp teilen ----------
function shareGame(gameId) {
  const g = S.games.find(x => x.id === gameId), s = stadiumOf(g.stadium_id), si = seatInfo(g);
  const text = `🏒 ${s.team} · ${fmt(g.starts_at)}\n🚗 Fahrer: ${si.drivers.map(d => prof(d.user_id).display_name).join(', ') || 'noch keiner'}\n🪑 ${si.drivers.length ? (si.free > 0 ? 'noch ' + si.free + ' frei' : 'voll') : 'es braucht noch einen Fahrer'}\n👉 Eintragen: ${location.origin}`;
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// ---------- Admin: km und Löschen ----------
function fixKm(gameId, current) {
  const v = prompt('Kilometer hin und zurück (leer = Standard):', current);
  if (v === null) return;
  return once(async () => {
    const { error } = await sb.from('games').update({ km_override: v.trim() === '' ? null : parseFloat(v) }).eq('id', gameId);
    if (error) alert(nice(error)); loadAll();
  });
}
function delGame(gameId) {
  if (!confirm('Spiel wirklich löschen?')) return;
  return once(async () => { await sb.from('games').delete().eq('id', gameId); loadAll(); });
}

// ---------- Abo-Ausleihe (unverändert übernommen) ----------
function aboBlock(g) {
  if (!stadiumOf(g.stadium_id).favorite) return '';
  const offers = g.abo_offers || [];
  let h = '<div class="info"><b>🎟️ Abos</b><br>';
  if (!offers.length) h += '<small>Noch kein Abo frei.</small><br>';
  offers.forEach(o => {
    const owner = prof(o.owner_id), typ = owner.abo_type === 'sitz' ? 'Sitzplatz' : 'Stehplatz';
    const price = Number(o.price || 0).toFixed(2);
    if (!o.borrower_id) {
      h += `${nameOf(o.owner_id)} (${typ}) · CHF ${price} `;
      if (o.owner_id !== S.userId) h += `<button class="small" onclick="reserveAbo(${o.id})">Reservieren</button>`;
      if (o.owner_id === S.userId || S.me.is_admin) h += `<button class="small secondary" onclick="delAbo(${o.id})">Zurückziehen</button>`;
    } else {
      h += `${nameOf(o.owner_id)} (${typ}) → ${nameOf(o.borrower_id)} · CHF ${price} · ${o.paid ? '✅ bezahlt' : '⏳ offen'} `;
      if (!o.paid && o.borrower_id === S.userId)
        h += `<br><small>Twint an ${esc(owner.phone || 'Nummer fehlt')}</small> <button class="small secondary" onclick="copyText('${esc(owner.phone || '')}')">Nummer kopieren</button>`;
      if (!o.paid && (o.borrower_id === S.userId || o.owner_id === S.userId || S.me.is_admin))
        h += `<button class="small good" onclick="markPaid(${o.id})">Bezahlt</button>`;
    }
    h += '<br>';
  });
  if (S.me.has_abo && !offers.find(o => o.owner_id === S.userId))
    h += `<button class="small secondary" onclick="offerAbo(${g.id})">Mein Abo ist frei</button>`;
  return h + '</div>';
}
function offerAbo(gameId) {
  const price = S.me.abo_type === 'sitz' ? S.settings.preis_sitz : S.settings.preis_steh;
  return once(async () => { const { error } = await sb.from('abo_offers').insert({ game_id:gameId, owner_id:S.userId, price }); if (error) alert(nice(error)); loadAll(); });
}
function reserveAbo(id) {
  return once(async () => { const { error } = await sb.from('abo_offers').update({ borrower_id:S.userId }).eq('id', id).is('borrower_id', null); if (error) alert(nice(error)); loadAll(); });
}
function markPaid(id) { return once(async () => { await sb.from('abo_offers').update({ paid:true }).eq('id', id); loadAll(); }); }
function delAbo(id) {
  return once(async () => { const { error } = await sb.from('abo_offers').delete().eq('id', id); if (error) alert('Nur der Admin kann ein Angebot löschen.'); loadAll(); });
}
function copyText(t) { navigator.clipboard.writeText(t).then(() => toast('Kopiert: ' + t)); }
