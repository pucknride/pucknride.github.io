// ===== Puck & Ride v2 – Installationsanleitung, Tour, Vorlesen =====

const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(navigator.userAgent);
const isApp = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

function speak(text) {
  if (!('speechSynthesis' in window)) { toast('Vorlesen geht auf diesem Gerät nicht.'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-CH';
  const v = speechSynthesis.getVoices().find(x => x.lang.startsWith('de'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

// ---------- Anleitung: App auf den Startbildschirm ----------
function installSteps() {
  if (isIOS) return {
    title: 'iPhone / iPad', say: 'Öffne die Seite in Safari. Tippe unten auf das Teilen-Symbol. Wähle Zum Home-Bildschirm. Tippe auf Hinzufügen.',
    steps: [['🧭', 'In <b>Safari</b> öffnen'], ['<span class="finger">⬆️</span>', 'Teilen-Symbol <b>⬆️</b> antippen'], ['➕', '<b>Zum Home-Bildschirm</b>'], ['✅', '<b>Hinzufügen</b>']]
  };
  if (isAndroid) return {
    title: 'Android', say: 'Öffne die Seite in Chrome. Tippe oben rechts auf die drei Punkte. Wähle App installieren. Tippe auf Installieren.',
    steps: [['🌐', 'In <b>Chrome</b> öffnen'], ['<span class="finger">⋮</span>', 'Oben rechts <b>⋮</b> antippen'], ['📲', '<b>App installieren</b>'], ['✅', '<b>Installieren</b>']]
  };
  return {
    title: 'Computer', say: 'Klicke in Chrome rechts in der Adresszeile auf das Installieren-Symbol. In Safari auf dem Mac: Ablage, Zum Dock hinzufügen.',
    steps: [['🌐', 'Chrome: Symbol <b>⊕</b> in der Adresszeile'], ['🍏', 'Mac Safari: <b>Ablage → Zum Dock hinzufügen</b>'], ['✅', 'Bestätigen']]
  };
}

function showInstall() {
  const i = installSteps();
  $('overlay').innerHTML = `<div class="sheet">
    <div class="big">📲</div><h3>App installieren · ${i.title}</h3>
    <div class="steps">${i.steps.map(s => `<div class="step"><b>${s[0]}</b><span>${s[1]}</span></div>`).join('')}</div>
    <button class="secondary" id="inst-say">🔊 Vorlesen</button>
    <button onclick="localStorage.setItem('pr_inst','1');closeOverlay()">Alles klar</button></div>`;
  $('overlay').hidden = false;
  $('inst-say').onclick = () => speak(i.say);
}

// ---------- Tour: drei Karten ----------
const TOUR = [
  { icon:'🏒', title:'Spiel antippen', text:'Unter <b>Spiele</b> siehst du alle nächsten Matches.', say:'Unter Spiele siehst du alle nächsten Matches.' },
  { icon:'<span class="finger">👆</span>', title:'Fahren oder mitfahren', text:'<b>🚗 Ich fahre</b> oder <b>🧍 Ich fahre mit</b> – ein Tipp reicht.', say:'Tippe auf Ich fahre oder Ich fahre mit. Ein Tipp reicht.' },
  { icon:'✅', title:'Fertig!', text:'Der Fahrer teilt dich ein. Am Spieltag siehst du oben, wann du abgeholt wirst.', say:'Fertig. Der Fahrer teilt dich ein. Am Spieltag siehst du oben, wann du abgeholt wirst.' }
];
let tourStep = 0;

function showTour(i = 0) {
  tourStep = i;
  const t = TOUR[i], last = i === TOUR.length - 1;
  $('overlay').innerHTML = `<div class="sheet">
    <div class="big">${t.icon}</div><h3>${t.title}</h3><p>${t.text}</p>
    <div class="dots">${TOUR.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
    <button class="secondary" id="tour-say">🔊 Vorlesen</button>
    <button id="tour-next">${last ? 'Los geht\'s! 🏒' : 'Weiter ➜'}</button>
    ${!last ? '<button class="secondary" id="tour-skip">Überspringen</button>' : ''}</div>`;
  $('overlay').hidden = false;
  $('tour-say').onclick = () => speak(t.say);
  $('tour-next').onclick = () => last ? endTour() : showTour(i + 1);
  if (!last) $('tour-skip').onclick = endTour;
  let x0 = null;
  const sheet = $('overlay').firstElementChild;
  sheet.ontouchstart = e => x0 = e.touches[0].clientX;
  sheet.ontouchend = e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (dx < -50 && !last) showTour(i + 1);
    if (dx > 50 && i > 0) showTour(i - 1);
  };
}
function endTour() {
  localStorage.setItem('pr_tour', '1'); closeOverlay();
  if (!isApp && !localStorage.getItem('pr_inst')) showInstall();
}
function maybeTour() {
  if (!$('overlay').hidden) return;
  if (!localStorage.getItem('pr_tour')) showTour(0);
}

// ---------- Hilfe-Knopf ----------
$('btn-help').onclick = () => {
  $('overlay').innerHTML = `<div class="sheet"><div class="big">❓</div><h3>Hilfe</h3>
    <button onclick="showTour(0)">🏒 Kurze Tour</button>
    <button onclick="showInstall()">📲 App installieren</button>
    ${S.userId ? '<button onclick="closeOverlay();$(\'btn-feedback\').click()">💬 Problem melden</button>' : ''}
    <button class="secondary" onclick="closeOverlay()">Schliessen</button></div>`;
  $('overlay').hidden = false;
};

// Beim allerersten Besuch im Browser: Installationshilfe zeigen
if (!isApp && !localStorage.getItem('pr_inst')) setTimeout(() => { if ($('overlay').hidden && !S.userId) showInstall(); }, 1500);
