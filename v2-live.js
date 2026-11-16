// ===== Puck & Ride v2 – Live-Resultate (SIHF) =====
const AMBRI_ID = 101152;
let liveTimer = null, lastScores = {};

function sihfLoad() {
  return new Promise((resolve, reject) => {
    const cb = 'sihf' + Date.now();
    const s = document.createElement('script');
    const t = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 10000);
    function cleanup() { clearTimeout(t); delete window[cb]; s.remove(); }
    window[cb] = d => { cleanup(); resolve(d); };
    s.onerror = () => { cleanup(); reject(new Error('net')); };
    s.src = 'https://data.sihf.ch/statistic/api/cms/table?alias=results&searchQuery=1//1&language=de&callback=' + cb;
    document.body.appendChild(s);
  });
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(d => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + d + 0.2);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.2);
    });
  } catch (e) {}
}

async function refreshLive() {
  const box = $('view-live');
  try {
    const d = await sihfLoad();
    const rows = (d.data || []).map(r => ({
      date: r[1], time: r[2], home: r[3], away: r[4],
      hs: r[5]?.homeTeam ?? '–', as: r[5]?.awayTeam ?? '–',
      per: r[6], dec: r[7], st: r[8] || {}
    }));
    rows.sort((a, b) => ((b.home.id === AMBRI_ID || b.away.id === AMBRI_ID) ? 1 : 0) - ((a.home.id === AMBRI_ID || a.away.id === AMBRI_ID) ? 1 : 0));

    rows.forEach(r => {
      const key = r.home.id + '-' + r.away.id + '-' + r.date;
      const ambriScore = r.home.id === AMBRI_ID ? Number(r.hs) : r.away.id === AMBRI_ID ? Number(r.as) : null;
      if (ambriScore !== null && lastScores[key] !== undefined && ambriScore > lastScores[key]) {
        beep(); toast('🚨 TOOOR AMBRÌ! 🔵⚪');
      }
      if (ambriScore !== null && !isNaN(ambriScore)) lastScores[key] = ambriScore;
    });

    box.innerHTML = `<div class="card"><h3>🔴 Live & Resultate</h3><small>Aktualisiert ${new Date().toLocaleTimeString('de-CH', { hour:'2-digit', minute:'2-digit' })} · ca. 1 Min. Verzögerung</small></div>` +
      rows.map(r => {
        const live = r.st.percent > 0 && r.st.percent < 100 && !r.st.canceled;
        const amb = r.home.id === AMBRI_ID || r.away.id === AMBRI_ID;
        return `<div class="card ${amb ? 'fav' : ''}">
          <small>${esc(r.date)} · ${esc(r.time)} · ${live ? '<span class="live-dot"></span> LIVE' : esc(r.st.name || '')}</small>
          <div class="row" style="align-items:center;margin-top:8px">
            <div style="flex:2"><b>${esc(r.home.name)}</b></div>
            <div class="score" style="flex:1">${esc(r.hs)} : ${esc(r.as)}</div>
            <div style="flex:2;text-align:right"><b>${esc(r.away.name)}</b></div>
          </div>
          ${r.per?.homeTeam ? `<small>Drittel: ${r.per.homeTeam.map((h, i) => h + ':' + r.per.awayTeam[i]).join(' · ')}${r.dec ? ' · ' + esc(r.dec) : ''}</small>` : ''}
        </div>`;
      }).join('') +
      `<a href="https://www.sihf.ch/de/game-center/liga/spielplan/1-1" target="_blank"><button class="secondary">📅 Ganzer Spielplan bei der SIHF</button></a>`;
  } catch (e) {
    box.innerHTML = `<div class="card"><h3>🔴 Live</h3><p>Live-Daten sind gerade nicht erreichbar.</p>
      <a href="https://www.sihf.ch/de/game-center/liga/spielplan/1-1" target="_blank"><button>📅 Resultate bei der SIHF öffnen</button></a></div>`;
  }
}

function startLive() {
  stopLive(); refreshLive();
  liveTimer = setInterval(() => { if (!document.hidden) refreshLive(); }, 60000);
}
function stopLive() { clearInterval(liveTimer); liveTimer = null; }
