/* Petit à petit — moteur de l'appli (leçons, exercices, dialogues, progression). */
(() => {
'use strict';

const C = window.COURSE || { units: [] };

/* Pont natif : Android fournit window.Bridge ; sur iPhone / navigateur on l'imite avec les API web. */
function webBridge() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, wake = null;
  const call = (fn, ...a) => { try { window[fn] && window[fn](...a); } catch { } };
  return {
    canListen: () => !!SR,
    listen() {
      if (!SR) return call('onSpeech', { ok: false, error: 'unavailable', texts: [] });
      try { rec && rec.abort(); } catch { }
      rec = new SR();
      rec.lang = 'fr-FR'; rec.interimResults = true; rec.maxAlternatives = 5; rec.continuous = false;
      let finalTexts = null, failed = null;
      rec.onstart = () => call('onSpeechState', 'ready');
      rec.onspeechstart = () => call('onSpeechState', 'speaking');
      rec.onresult = e => {
        const r = e.results[e.results.length - 1];
        if (r.isFinal) finalTexts = [...r].map(a => a.transcript.trim());
        else call('onSpeechPartial', r[0].transcript);
      };
      rec.onerror = e => { failed = { 'not-allowed': 'permission', 'service-not-allowed': 'unavailable', 'no-speech': 'timeout', network: 'network', 'audio-capture': 'permission' }[e.error] || 'nomatch'; };
      rec.onend = () => {
        if (finalTexts && finalTexts.length) call('onSpeech', { ok: true, texts: finalTexts });
        else call('onSpeech', { ok: false, error: failed || 'nomatch', texts: [] });
        rec = null;
      };
      try { rec.start(); } catch { call('onSpeech', { ok: false, error: 'unavailable', texts: [] }); }
    },
    stopListening() { try { rec && rec.stop(); } catch { } },
    openYoutube: id => window.open('https://www.youtube.com/watch?v=' + id, '_blank'),
    openUrl: u => window.open(u, '_blank'),
    haptic(k) { try { navigator.vibrate && navigator.vibrate(k === 'error' ? [30, 40, 30] : 12); } catch { } },
    async keepAwake(on) {
      try {
        if (on && !wake && navigator.wakeLock) wake = await navigator.wakeLock.request('screen');
        if (!on && wake) { await wake.release(); wake = null; }
      } catch { wake = null; }
    },
  };
}
const NATIVE = !!window.Bridge;
const Bridge = window.Bridge || webBridge();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ic = (n, cls = '') => `<svg class="ic ${cls}"><use href="#i-${n}"/></svg>`;
const art = (slug, cls = '') => !slug ? ''
  : slug.startsWith('ic:') ? `<span class="em emi ${cls}">${ic(slug.slice(3))}</span>`
    : slug.startsWith('pp:') ? `<span class="em emp ${cls}">${window.person ? person(slug.slice(3)) : ''}</span>`
      : slug.startsWith('piaf:') ? `<span class="em emp ${cls}">${piaf(slug.slice(5))}</span>`
        : `<img class="em ${cls}" src="art/${slug}.svg" alt="" decoding="async" draggable="false">`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => shuffle(a).slice(0, n);
const NAME = 'Ale';

const UNIT_COLORS = [
  ['#12A48B', '#0B7A67'], ['#2E5BFF', '#1D3FC4'], ['#FF8A1C', '#D06A00'], ['#7B5CFF', '#5A3ED6'],
  ['#E8508A', '#B8336A'], ['#1BA3E0', '#1279AB'], ['#21A35B', '#167A43'], ['#E5484D', '#B5323A'],
];

/* ============ état sauvegardé ============ */
const KEY = 'petitapetit.v1';
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const DEF = { xp: 0, streak: 0, best: 0, last: null, days: {}, goal: 30, nodes: {}, mistakes: [], seen: {},
  hearts: 5, heartAt: 0, coins: 0, freeze: 0, boostUntil: 0, quests: null, chests: {}, badges: {},
  stats: { lessons: 0, perfect: 0, dialogs: 0, stories: 0, practice: 0, bestCombo: 0, bought: 0 }, onboarded: false,
  set: { speak: true, sound: true, autoplay: true, unlockAll: false, haptic: true, hearts: true, theme: 'auto' }, speakOff: 0 };
let S;
/* La progression ne doit JAMAIS se perdre entre deux versions : on complète l'ancien état avec les nouveaux
   champs (jamais l'inverse), on garde la même clé de stockage, et une copie de secours est écrite au démarrage. */
function normalize(o) {
  const st = Object.assign(structuredClone(DEF), o && typeof o === 'object' ? o : {});
  st.set = Object.assign({}, DEF.set, st.set);
  st.stats = Object.assign({}, DEF.stats, st.stats);
  for (const k of ['chests', 'badges', 'nodes', 'days', 'seen']) if (!st[k] || typeof st[k] !== 'object') st[k] = {};
  if (!Array.isArray(st.mistakes)) st.mistakes = [];
  for (const k in st.nodes) { const n = st.nodes[k]; if (n && n.times && n.lvl == null) n.lvl = 1; }
  st.v = 2;
  return st;
}
function loadState() {
  for (const k of [KEY, KEY + '.bak']) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) { const o = JSON.parse(raw); if (o && typeof o === 'object') return { s: normalize(o), raw, from: k }; }
    } catch { }
  }
  return { s: normalize({}), raw: null, from: null };
}
const loaded = loadState();
S = loaded.s;
try { if (loaded.raw && loaded.from === KEY && (loaded.s.xp > 0 || Object.keys(loaded.s.nodes).length)) localStorage.setItem(KEY + '.bak', loaded.raw); } catch { }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } };
function streakAlive() { return S.last && dayDiff(S.last, today()) <= 1; }
/* Un jour d'utilisation = un jour de série : dès le premier exercice répondu. Renvoie true si la série vient d'avancer. */
function touchDay() {
  const t = today();
  if (S.last === t) return false;
  settleStreak(); // jour(s) manqué(s) : protège-série ou remise à zéro
  S.streak = S.last && dayDiff(S.last, t) === 1 ? S.streak + 1 : 1;
  S.last = t;
  S.best = Math.max(S.best, S.streak);
  if (!(t in S.days)) S.days[t] = 0;
  save();
  return true;
}
function addXP(n) {
  const t = today();
  if (boostOn()) n *= 2;
  touchDay();
  bump('xp', n);
  S.xp += n;
  S.days[t] = (S.days[t] || 0) + n;
  save();
  return n;
}

/* ============ jeu : vies, croissants, protège-série, défis du jour, coffres, badges ============ */
const MAXH = 5, REGEN = 30 * 60e3;
const PRICE = { hearts: 30, freeze: 50, boost: 40 };
const dateShift = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function heartsNow() {
  if (!S.set.hearts) return MAXH;
  const now = Date.now();
  while (S.hearts < MAXH && S.heartAt && now - S.heartAt >= REGEN) { S.hearts++; S.heartAt += REGEN; }
  if (S.hearts >= MAXH) { S.hearts = MAXH; S.heartAt = 0; }
  return S.hearts;
}
function loseHeart() {
  if (!S.set.hearts) return;
  if (heartsNow() > 0) { if (S.hearts === MAXH) S.heartAt = Date.now(); S.hearts--; }
  save();
}
function gainHeart(n = 1) { heartsNow(); S.hearts = Math.min(MAXH, S.hearts + n); if (S.hearts >= MAXH) S.heartAt = 0; save(); }
function nextHeartIn() { if (heartsNow() >= MAXH || !S.heartAt) return ''; const m = Math.max(1, Math.ceil((S.heartAt + REGEN - Date.now()) / 60e3)); return m + ' min'; }
function addCoins(n) { S.coins = (S.coins || 0) + n; save(); }
const boostOn = () => Date.now() < (S.boostUntil || 0);

/* Shelby garde la série : un protège-série couvre un jour manqué */
function settleStreak() {
  if (!S.last) return null;
  const d = dayDiff(S.last, today());
  if (d < 2) return null;
  const missed = d - 1;
  let msg = null;
  if (S.streak > 0 && (S.freeze || 0) >= missed) { S.freeze -= missed; S.last = dateShift(-1); msg = `¡Guau! Shelby cuidó tu racha de ${S.streak} día${S.streak > 1 ? 's' : ''}.`; }
  else if (S.streak > 0) { S.lostStreak = S.streak; S.streak = 0; } // on s'en souvient pour proposer de la récupérer
  save();
  return msg;
}

/* Défis du jour : 3 par jour, tirés selon la date */
const QUEST = {
  xp: { goal: 40, text: 'Ganá 40 XP', ic: 'zap' },
  lessons: { goal: 2, text: 'Completá 2 lecciones', ic: 'graduation-cap' },
  perfect: { goal: 1, text: 'Hacé una lección perfecta', ic: 'star' },
  combo: { goal: 8, text: 'Acertá 8 seguidas', ic: 'flame' },
  listen: { goal: 5, text: 'Acertá 5 ejercicios de escucha', ic: 'headphones' },
  practice: { goal: 1, text: 'Hacé una práctica', ic: 'dumbbell' },
  right: { goal: 20, text: 'Acertá 20 ejercicios', ic: 'check' },
};
const QUEST_REWARD = 15, QUEST_BONUS = 30;
function quests() {
  const t = today();
  if (!S.quests || S.quests.day !== t) {
    const seed = (t.split('-').join('') | 0);
    const rest = Object.keys(QUEST).filter(k => k !== 'xp');
    const a = rest[seed % rest.length], b = rest.filter(k => k !== a)[(seed * 7) % (rest.length - 1)];
    S.quests = { day: t, bonus: false, list: ['xp', a, b].map(k => ({ k, prog: 0, claimed: false })) };
    save();
  }
  return S.quests;
}
function bump(k, n = 1, max = false) {
  const q = quests().list.find(x => x.k === k);
  if (!q) return;
  const before = q.prog >= QUEST[k].goal;
  q.prog = Math.min(QUEST[k].goal, max ? Math.max(q.prog, n) : q.prog + n);
  if (!before && q.prog >= QUEST[k].goal) bump.fresh = (bump.fresh || 0) + 1;
}
const questsReady = () => quests().list.filter(q => q.prog >= QUEST[q.k].goal && !q.claimed).length;

/* Badges */
const BADGES = [
  ['first', 'footprints', 'Primer paso', 'Terminá tu primera lección', s => s.stats.lessons >= 1],
  ['l10', 'graduation-cap', 'Estudiosa', 'Terminá 10 lecciones', s => s.stats.lessons >= 10],
  ['l30', 'medal', 'Imparable', 'Terminá 30 lecciones', s => s.stats.lessons >= 30],
  ['perfect5', 'star', 'Perfeccionista', '5 lecciones perfectas', s => s.stats.perfect >= 5],
  ['streak3', 'flame', 'En racha', '3 días seguidos', s => s.best >= 3],
  ['streak7', 'calendar-check', 'Una semana entera', '7 días seguidos', s => s.best >= 7],
  ['streak30', 'crown', 'Un mes de francés', '30 días seguidos', s => s.best >= 30],
  ['combo15', 'zap', 'En llamas', '15 respuestas seguidas', s => s.stats.bestCombo >= 15],
  ['dialog6', 'messages-square', 'Conversadora', 'Terminá 6 diálogos', s => s.stats.dialogs >= 6],
  ['xp1000', 'trophy', 'Mil puntos', 'Llegá a 1000 XP', s => s.xp >= 1000],
  ['shop', 'shopping-bag', 'Clienta de Jacques', 'Comprá algo en la tienda', s => s.stats.bought >= 1],
  ['unit', 'flag', 'Unidad completa', 'Terminá una unidad entera', () => UNITS.some(u => u.nodes.every(n => isDone(n.id)))],
];
function checkBadges() {
  const fresh = [];
  BADGES.forEach(([id, icn, name, , test]) => { if (!S.badges[id] && test(S)) { S.badges[id] = today(); fresh.push({ id, icn, name }); } });
  if (fresh.length) save();
  return fresh;
}

/* fenêtre générique */
function pop(html, wire) {
  const box = $('#pop-box'); box.innerHTML = html; $('#pop').hidden = false; hydratePiaf(box);
  $$('[data-close]', box).forEach(b => b.addEventListener('click', closePop));
  if (wire) wire(box);
}
function closePop() { $('#pop').hidden = true; $('#pop-box').innerHTML = ''; }

function outOfHearts() {
  stopAudio();
  const can = (S.coins || 0) >= PRICE.hearts;
  pop(`<span class="piaf droop" data-piaf="sad"></span><h2>Te quedaste sin vidas</h2>
    <p>Recuperás una vida cada 30 minutos${nextHeartIn() ? ` (la próxima en ${nextHeartIn()})` : ''}. También podés ganar una practicando.</p>
    <button class="btn primary wide" id="oh-buy" ${can ? '' : 'disabled'}>${ic('heart')} Recargar todo · ${PRICE.hearts} ${ic('croissant')}</button>
    <button class="btn wide" id="oh-prac">${ic('dumbbell')} Practicar y ganar una vida</button>
    <button class="btn ghost wide" data-close id="oh-out">Volver</button>`, box => {
    $('#oh-buy', box).onclick = () => { addCoins(-PRICE.hearts); S.stats.bought++; gainHeart(MAXH); closePop(); toast('¡Vidas recargadas!'); if (screen === 'quiz' && Q) { updateHearts(); Q.i++; nextEx(); } else goHome(); };
    $('#oh-prac', box).onclick = () => { closePop(); Q = null; goHome(); setTab('practice'); };
    $('#oh-out', box).onclick = () => { Q = null; goHome(); };
  });
}
function updateHearts() {
  const h = $('#q-hearts'); if (!h) return;
  const on = Q && Q.meta.hearts && S.set.hearts;
  h.hidden = !on;
  if (on) h.querySelector('b').textContent = heartsNow();
}

function openChest(id, amount) {
  if (S.chests[id]) return toast('Este cofre ya lo abriste.');
  S.chests[id] = today(); addCoins(amount);
  sfx.win(); haptic('ok');
  pop(`<div class="chest-art open">${ic('gift')}</div><h2>¡Cofre abierto!</h2><p class="big-coins">+${amount} ${ic('croissant')}</p>
    <p>Croissants para gastar en la tienda de Jacques.</p><button class="btn primary wide" data-close>¡Genial!</button>`);
  updateTop(); RENDER[tab]();
}

/* ============ onglet DESAFÍOS ============ */
function renderQuests() {
  const el = $('#tab-quests'), Qs = quests();
  const allClaimed = Qs.list.every(q => q.claimed);
  el.innerHTML = `<div class="npc"><span class="npc-art">${animal('Shelby')}</span><div class="bubble"><small>Shelby</small>¡Guau! Estos son tus desafíos de hoy. Cada uno te da ${QUEST_REWARD} croissants.</div></div>
    ${Qs.list.map((q, i) => { const d = QUEST[q.k], full = q.prog >= d.goal; return `<div class="card quest ${q.claimed ? 'claimed' : ''}"><span class="q-ico">${ic(q.claimed ? 'check' : d.ic)}</span><div class="q-main"><b>${d.text}</b>
      <div class="q-bar"><i style="width:${100 * q.prog / d.goal}%"></i><span>${q.prog} / ${d.goal}</span></div></div>
      ${full && !q.claimed ? `<button class="btn green q-claim" data-claim="${i}">+${QUEST_REWARD}</button>` : `<span class="q-rew">${q.claimed ? '' : `${QUEST_REWARD} ${ic('croissant')}`}</span>`}</div>`; }).join('')}
    <div class="card quest bonus ${Qs.bonus ? 'claimed' : ''}"><span class="q-ico">${ic('gift')}</span><div class="q-main"><b>Cofre del día</b><span>Completá los 3 desafíos</span></div>
      ${allClaimed && !Qs.bonus ? `<button class="btn green q-claim" id="q-bonus">Abrir</button>` : `<span class="q-rew">${Qs.bonus ? ic('check') : `${QUEST_BONUS} ${ic('croissant')}`}</span>`}</div>
    <h1 class="page" style="margin-top:22px;font-size:22px">Logros</h1>
    <div class="badges">${BADGES.map(([id, icn, name, desc]) => `<div class="badge ${S.badges[id] ? 'on' : ''}"><span>${ic(S.badges[id] ? icn : 'lock')}</span><b>${name}</b><small>${desc}</small></div>`).join('')}</div>`;
  $$('[data-claim]', el).forEach(b => b.onclick = () => { const q = Qs.list[b.dataset.claim]; q.claimed = true; addCoins(QUEST_REWARD); sfx.ok(); haptic('ok'); toast(`+${QUEST_REWARD} croissants`); updateTop(); renderQuests(); });
  const bo = $('#q-bonus', el);
  if (bo) bo.onclick = () => { Qs.bonus = true; save(); openChest('day-' + Qs.day, QUEST_BONUS); };
}

/* ============ onglet TIENDA (chez Jacques) ============ */
function renderShop() {
  const el = $('#tab-shop');
  const h = heartsNow(), coins = S.coins || 0;
  const left = boostOn() ? Math.ceil((S.boostUntil - Date.now()) / 60e3) : 0;
  const item = (k, icn, col, t, s, price, off, tag) => `<div class="card shop-item"><span class="p-ico" style="background:${col}">${ic(icn)}</span><div class="q-main"><b>${t}</b><span>${s}</span></div>
    <button class="btn ${off ? '' : 'primary'} buy" data-buy="${k}" ${off || coins < price ? 'disabled' : ''}>${tag || `${price} ${ic('croissant')}`}</button></div>`;
  el.innerHTML = `<div class="npc"><span class="npc-art">${animal('Jacques')}</span><div class="bubble"><small>Jacques</small>Miaou ! Bienvenue dans ma boutique. Tenés <b class="coin-txt">${coins} ${ic('croissant')}</b></div></div>
    ${item('hearts', 'heart', '#E5484D', 'Recargar vidas', S.set.hearts ? `Tenés ${h} de ${MAXH}${nextHeartIn() ? ` · +1 en ${nextHeartIn()}` : ''}` : 'Las vidas están desactivadas', PRICE.hearts, h >= MAXH || !S.set.hearts, h >= MAXH && S.set.hearts ? 'Llenas' : '')}
    ${item('freeze', 'shield', '#1BA3E0', 'Protector de racha', `Shelby cuida tu racha si faltás un día · tenés ${S.freeze || 0} de 2`, PRICE.freeze, (S.freeze || 0) >= 2, (S.freeze || 0) >= 2 ? 'Máximo' : '')}
    ${item('boost', 'rocket', '#7B5CFF', 'Doble XP', left ? `Activo: quedan ${left} min` : 'El doble de XP durante 15 minutos', PRICE.boost, !!left, left ? 'Activo' : '')}
    <div class="card"><h3>¿Cómo gano croissants?</h3><p>Terminando lecciones y diálogos, abriendo los cofres del camino y cumpliendo los desafíos de Shelby.</p></div>`;
  $$('[data-buy]', el).forEach(b => b.onclick = () => {
    const k = b.dataset.buy;
    if ((S.coins || 0) < PRICE[k]) return;
    addCoins(-PRICE[k]); S.stats.bought++;
    if (k === 'hearts') gainHeart(MAXH);
    if (k === 'freeze') S.freeze = Math.min(2, (S.freeze || 0) + 1);
    if (k === 'boost') S.boostUntil = Date.now() + 15 * 60e3;
    save(); sfx.ok(); haptic('ok');
    toast({ hearts: '¡Vidas recargadas!', freeze: '¡Guau! Shelby ya cuida tu racha.', boost: '¡Doble XP por 15 minutos!' }[k]);
    const fresh = checkBadges(); if (fresh.length) setTimeout(() => badgePop(fresh), 600);
    updateTop(); renderShop();
  });
}
function badgePop(fresh) {
  sfx.win();
  pop(`<div class="chest-art badge-art">${ic(fresh[0].icn)}</div><h2>¡Nuevo logro!</h2><p class="big-coins">${fresh.map(f => esc(f.name)).join(' · ')}</p><button class="btn primary wide" data-close>¡Bravo!</button>`);
}

/* ============ sons et audio ============ */
let actx = null;
function tone(seq) {
  if (!S.set.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    let t = actx.currentTime;
    for (const [f, d, type = 'sine', v = .18] of seq) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .015); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + .02);
      t += d * .72;
    }
  } catch { }
}
const sfx = {
  ok: () => tone([[784, .12, 'triangle'], [1175, .22, 'triangle']]),
  bad: () => tone([[196, .18, 'square', .07], [165, .26, 'square', .07]]),
  tap: () => tone([[660, .05, 'sine', .07]]),
  win: () => tone([[523, .14, 'triangle'], [659, .14, 'triangle'], [784, .14, 'triangle'], [1047, .4, 'triangle']]),
};
const haptic = k => { if (S.set.haptic && Bridge) try { Bridge.haptic(k); } catch { } };

const player = new Audio();
player.preload = 'auto';
let playToken = 0;
function play(key, slow = false) {
  return new Promise(res => {
    if (!key) return res();
    const tok = ++playToken;
    player.pause();
    player.src = 'audio/' + key + '.mp3';
    player.playbackRate = slow ? .68 : 1;
    try { player.preservesPitch = true; } catch { }
    const end = () => { player.onended = player.onerror = null; res(tok === playToken); };
    player.onended = end; player.onerror = end;
    player.play().catch(end);
  });
}
const stopAudio = () => { playToken++; player.pause(); };

/* iOS : le son ne peut démarrer qu'après un premier toucher. On « débloque » l'audio au premier geste. */
let unlocked = false;
function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const b = actx.createBuffer(1, 1, 22050), s = actx.createBufferSource(); s.buffer = b; s.connect(actx.destination); s.start(0);
  } catch { }
  if (!player.src) {
    const wasMuted = player.muted, au = document.querySelector('[data-au]')?.dataset.au;
    if (!au) return;
    player.muted = true;
    player.src = 'audio/' + au + '.mp3';
    const src = player.src;
    const restore = () => { if (player.src === src) player.pause(); player.muted = wasMuted; };
    player.play().then(restore, restore);
  }
}
['touchend', 'click'].forEach(ev => document.addEventListener(ev, unlockAudio, { capture: true, passive: true }));

/* ============ texte : comparaison et fiches ============ */
const PUNCT = /[.,!?¿¡;:«»"“”()…]/g;
const norm = s => String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/ /g, ' ').replace(PUNCT, ' ').replace(/\s+/g, ' ').trim();
const deacc = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokens = s => String(s).replace(/[’‘]/g, "'").split(/\s+/).map(t => t.replace(/^[¿¡«"“(]+|[.,!?;:»"”)…]+$/g, '')).filter(Boolean);
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[n];
}
const simil = (a, b) => { a = deacc(norm(a)); b = deacc(norm(b)); const L = Math.max(a.length, b.length) || 1; return 1 - lev(a, b) / L; };

/* ============ index du cours ============ */
const UNITS = C.units;
const LESSON = {}, NODE = {}, ORDER = [];
UNITS.forEach((u, ui) => {
  u.color = UNIT_COLORS[ui % UNIT_COLORS.length];
  u.nodes = [];
  u.lessons.forEach((l, li) => {
    l.unit = u; l.n = li + 1; LESSON[l.id] = l;
    u.nodes.push({ id: l.id, type: 'lesson', unit: u, lesson: l, title: l.title, icon: 'book-open' });
    (u.dialogues || []).filter(d => (d.afterLesson || u.lessons.length) === li + 1).forEach(d => {
      d.unit = u;
      u.nodes.push({ id: d.id, type: 'dialog', unit: u, dialog: d, title: d.title, icon: 'messages-square' });
    });
    // lectures : étapes facultatives (elles ne bloquent jamais la suite, même ajoutées dans une mise à jour)
    (C.stories || []).filter(st => st.unit === u.id && (st.afterLesson || u.lessons.length) === li + 1).forEach(st => {
      u.nodes.push({ id: st.id, type: 'story', unit: u, story: st, title: st.title, icon: 'book-open-text', optional: true });
    });
  });
  if (u.lessons.length > 1) u.nodes.push({ id: 'rev-' + u.id, type: 'review', unit: u, title: 'Repaso de la unidad', icon: 'trophy' });
  u.nodes.forEach(n => { NODE[n.id] = n; ORDER.push(n); });
});
const isDone = id => !!(S.nodes[id] && S.nodes[id].times);
function isOpen(id) {
  if (S.set.unlockAll || isDone(id)) return true;
  let i = ORDER.findIndex(n => n.id === id) - 1;
  while (i >= 0 && ORDER[i].optional) i--;
  return i < 0 || isDone(ORDER[i].id);
}
const currentNode = () => ORDER.find(n => !isDone(n.id) && !n.optional) || null;
const doneLessons = () => Object.values(LESSON).filter(l => isDone(l.id));
const pool = ls => ({
  vocab: ls.flatMap(l => l.vocab.map(v => ({ ...v, lesson: l.id }))),
  sent: ls.flatMap(l => l.sentences.map(s => ({ ...s, lesson: l.id }))),
  gram: ls.flatMap(l => (l.grammar || []).map(g => ({ ...g, lesson: l.id }))),
});

/* ============ Piaf (mascotte) ============ */
function piaf(mood = 'happy', prop = '') {
  const open = r => `<g class="pf-eyes"><circle cx="41" cy="50" r="${r}" fill="#1E2A3A"/><circle cx="59" cy="50" r="${r}" fill="#1E2A3A"/><circle cx="42.6" cy="48.4" r="1.7" fill="#fff"/><circle cx="60.6" cy="48.4" r="1.7" fill="#fff"/></g>`;
  const eyes = mood === 'wow' ? open(5.2)
    : mood === 'sad'
      ? '<path d="M34 48l10-4M66 48l-10-4" stroke="#1E2A3A" stroke-width="2.4" stroke-linecap="round"/><g class="pf-eyes"><circle cx="41" cy="52" r="3.6" fill="#1E2A3A"/><circle cx="59" cy="52" r="3.6" fill="#1E2A3A"/></g><path d="M66 56q2 5 0 7q-2-2 0-7z" fill="#8FC1FF"/>'
      : mood === 'zzz'
        ? '<path d="M36 52q5 4 10 0M54 52q5 4 10 0" stroke="#1E2A3A" stroke-width="3" fill="none" stroke-linecap="round"/><text x="74" y="30" font-size="15" font-weight="800" fill="#7B5CFF" font-family="Nunito,sans-serif">z</text><text x="84" y="19" font-size="11" font-weight="800" fill="#7B5CFF" font-family="Nunito,sans-serif">z</text>'
      : mood === 'joy'
        ? '<path d="M36 51q5-6 10 0M54 51q5-6 10 0" stroke="#1E2A3A" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
        : open(4.2);
  const beak = mood === 'wow' ? '<ellipse cx="50" cy="61" rx="5" ry="6" fill="#FF9F1C"/><ellipse cx="50" cy="62" rx="2.6" ry="3.2" fill="#B85C00"/>' : '<path d="M44 57h12l-6 7z" fill="#FF9F1C"/>';
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <ellipse cx="50" cy="94" rx="24" ry="4" fill="#000" opacity=".08"/>
    <path d="M40 86v6M58 86v6" stroke="#FF9F1C" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="50" cy="58" r="31" fill="#2E5BFF"/>
    <ellipse cx="50" cy="68" rx="19" ry="17" fill="#FFE7C2"/>
    <path class="pf-wl" d="M20 62c0-10 7-15 13-12-1 10-6 16-13 17z" fill="#1D3FC4"/>
    <path class="pf-wr" d="M80 62c0-10-7-15-13-12 1 10 6 16 13 17z" fill="#1D3FC4"/>
    <circle cx="33" cy="60" r="5" fill="#FF8FA3" opacity=".55"/><circle cx="67" cy="60" r="5" fill="#FF8FA3" opacity=".55"/>
    ${eyes}${beak}
    <path d="M24 38c6-17 47-19 54-2-15-6-39-6-54 2z" fill="#E5484D"/>
    <circle cx="52" cy="22" r="4" fill="#E5484D"/>
    ${{
      phones: '<path d="M21 50a29 29 0 0 1 58 0" fill="none" stroke="#1E2A3A" stroke-width="5" stroke-linecap="round"/><rect x="13" y="46" width="12" height="20" rx="6" fill="#FFC93C" stroke="#1E2A3A" stroke-width="2"/><rect x="75" y="46" width="12" height="20" rx="6" fill="#FFC93C" stroke="#1E2A3A" stroke-width="2"/>',
      book: '<path d="M28 72l22 5 22-5v17l-22 5-22-5z" fill="#fff" stroke="#1E2A3A" stroke-width="2.2" stroke-linejoin="round"/><path d="M50 77v17" stroke="#1E2A3A" stroke-width="2"/><path d="M33 78l12 3M33 83l12 3M55 81l12-3M55 86l12-3" stroke="#B8C2D6" stroke-width="1.6" stroke-linecap="round"/>',
      pencil: '<g transform="rotate(32 80 66)"><rect x="76.500" y="48" width="7" height="24" fill="#FFC93C" stroke="#1E2A3A" stroke-width="1.6"/><path d="M76.500 72h7l-3.500 8z" fill="#F4D7A8" stroke="#1E2A3A" stroke-width="1.6" stroke-linejoin="round"/><rect x="76.500" y="43" width="7" height="6" rx="1.500" fill="#FF8FA3" stroke="#1E2A3A" stroke-width="1.6"/></g>',
    }[prop] || ''}
  </svg>`;
}
function hydratePiaf(root = document) { $$('[data-piaf]', root).forEach(el => { el.innerHTML = piaf(el.dataset.piaf === 'mini' ? 'happy' : el.dataset.piaf, el.dataset.prop || ''); }); }

/* ============ navigation ============ */
let screen = 'home', tab = 'learn';
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  screen = id;
  if (Bridge) try { Bridge.keepAwake(id === 'quiz' || id === 'dlg'); } catch { }
}
function setTab(t) {
  tab = t;
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  $$('.tab').forEach(x => x.classList.toggle('active', x.id === 'tab-' + t));
  RENDER[t]();
  $('#tab-' + t).scrollTop = t === 'learn' ? $('#tab-learn').scrollTop : 0;
}
$$('.tabbar button').forEach(b => b.onclick = () => { sfx.tap(); setTab(b.dataset.tab); });
function goHome() { stopAudio(); closeVideo(); show('home'); updateTop(); RENDER[tab](); }

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }
function ask(text, yes = 'Sí') {
  return new Promise(res => {
    $('#c-text').textContent = text; $('#c-yes').textContent = yes; $('#confirm').hidden = false;
    $('#c-yes').onclick = () => { $('#confirm').hidden = true; res(true); };
    $('#c-no').onclick = () => { $('#confirm').hidden = true; res(false); };
  });
}

function updateTop() {
  const st = $('#st-streak');
  st.querySelector('b').textContent = streakAlive() ? S.streak : 0;
  st.classList.toggle('off', S.last !== today());
  $('#st-coins b').textContent = S.coins || 0;
  $('#st-hearts b').textContent = heartsNow();
  $('#st-hearts').hidden = !S.set.hearts;
  const qd = $('.tabbar [data-tab=quests]'); if (qd) qd.classList.toggle('dot', questsReady() > 0);
  const pct = Math.min(1, (S.days[today()] || 0) / S.goal);
  $('#st-goal .g-fg').style.strokeDashoffset = 94.25 * (1 - pct);
}
$('#st-coins').onclick = () => setTab('shop');
$('#st-hearts').onclick = () => toast(heartsNow() >= MAXH ? 'Tenés todas tus vidas.' : `Tenés ${heartsNow()} vidas · +1 en ${nextHeartIn()}`);
$('#st-goal').onclick = () => toast(`Meta del día: ${S.days[today()] || 0} / ${S.goal} XP`);
$('#st-streak').onclick = () => toast(streakAlive() ? `Racha de ${S.streak} día${S.streak > 1 ? 's' : ''}. ¡Seguí así!` : 'Hacé una lección hoy para empezar tu racha.');

/* ============ onglet APRENDER ============ */
function phraseOfDay() {
  const all = UNITS.flatMap(u => u.lessons.flatMap(l => l.sentences));
  if (!all.length) return null;
  const d = today().split('-').join('') | 0;
  return all[(d * 7919) % all.length];
}
function renderLearn() {
  const el = $('#tab-learn');
  const cur = currentNode();
  const pdj = phraseOfDay();
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Bonjour' : h < 19 ? 'Bonjour' : 'Bonsoir';
  let html = `<div class="hello"><span class="piaf" data-piaf="${S.last !== today() && h >= 21 ? 'zzz' : 'happy'}"></span>
    <div class="bubble"><small>${saludo}, ${NAME} · la frase del día</small>
    ${pdj ? `<div class="pdj"><button class="say" data-au="${pdj.au}">${ic('volume-2')}</button><div><b>${esc(pdj.fr)}</b><div class="pdj-es">${esc(pdj.es)}</div></div></div>` : ''}</div></div>`;
  const li = levelInfo(), td = S.days[today()] || 0;
  html += `<div class="hero"><span class="lv">${li.L}</span><div class="hero-main"><small>Nivel ${li.L} · ${li.name}</small>
    <div class="xp-bar"><i style="width:${li.pct}%"></i></div>
    <div class="hero-row"><span>${S.xp} XP · faltan ${li.left}</span><span class="hero-goal">${ic('target')} Hoy ${td} / ${S.goal}${boostOn() ? ' · ×2' : ''}</span></div></div></div>`;
  const nDue = srsDue().length;
  if (nDue) html += `<button class="srs-card" id="h-srs">${ic('brain')}<span><b>Repaso del día</b><small>${nDue} palabra${nDue > 1 ? 's' : ''} para no olvidar</small></span>${ic('chevron-right')}</button>`;
  if (cur) {
    const u = cur.unit;
    html += `<button class="continue-card" data-node="${cur.id}" style="--u:${u.color[0]};--u-d:${u.color[1]}">
      <span class="cc-ico">${cur.type === 'lesson' && cur.lesson.art ? art(cur.lesson.art) : ic(cur.icon)}</span><span><small>${isDone(ORDER[0].id) ? 'Seguir con' : 'Empezar'}</small><b>${esc(cur.title)}</b></span>${ic('chevron-right', 'go')}</button>`;
  }
  UNITS.forEach((u, ui) => {
    html += `<section class="unit" style="--u:${u.color[0]};--u-d:${u.color[1]}">
      <div class="unit-head"><div><small>Unidad ${ui}</small><h2>${esc(u.title)}</h2><p>${esc(u.subtitle || '')}</p></div>
      <button class="u-guide" data-guide="${u.id}" aria-label="Guía de la unidad">${ic('notebook-text')}</button></div><div class="path">`;
    u.nodes.forEach((n, i) => {
      const done = isDone(n.id), open = isOpen(n.id), current = cur && cur.id === n.id;
      const x = Math.round(Math.sin(i * 0.9) * 78);
      const stars = n.type === 'lesson' ? `<span class="stars">${[1, 2, 3].map(k => ic('crown', lvlOf(n.id) >= k ? 'on' : '')).join('')}</span>` : '';
      const side = x > 0 ? 'l' : 'r';
      const nart = n.type === 'lesson' ? n.lesson.art : null; // dialogues, lectures, révisions : icônes maison
      const far = side === 'l' ? 'dr' : 'dl'; // côté libre (à l'opposé du titre)
      const deco = current ? `<span class="piaf here ${far}" data-piaf="happy"></span>` : '';
      html += `<div class="node ${n.type} ${done ? 'done' : ''} ${open ? '' : 'locked'} ${current ? 'current' : ''}" style="transform:translateX(${x}px)" data-node="${n.id}" role="button">
        ${current ? `<span class="start-tag">${isDone(ORDER[0].id) ? 'Seguir' : 'Empezar'}</span>` : ''}
        <span class="disc">${open ? (nart ? art(nart) : ic(n.icon)) : ic('lock')}${done ? `<i class="ok">${ic('check')}</i>` : ''}</span>${stars}
        <span class="node-label ${side}">${esc(n.title)}</span>${deco}</div>`;
      if (i === 3) {
        const cid = 'chest-' + u.id, got = !!S.chests[cid], avail = isDone(n.id) || S.set.unlockAll;
        html += `<div class="node chest ${got ? 'done' : avail ? 'ready' : 'locked'}" style="transform:translateX(${Math.round(Math.sin((i + .5) * 0.9) * 78)}px)" data-chest="${cid}" data-amt="${20 + ui * 5}" data-ok="${avail ? 1 : 0}" role="button"><span class="disc">${ic('gift')}${got ? `<i class="ok">${ic('check')}</i>` : ''}</span></div>`;
      }
    });
    html += `</div></section>`;
  });
  html += `<div class="path-end"><div class="end-art"><svg class="eiffel" viewBox="0 0 60 100"><path d="M30 2v10M27 12h6l3 28H24zM21 40h18l6 30H15zM13 70h34l8 28H43c0-8-5-13-13-13S17 90 17 98H5z" fill="currentColor"/><path d="M22 40h16M14 70h32" stroke="var(--bg)" stroke-width="3"/></svg><span class="piaf" data-piaf="wow"></span></div><div>Al final del camino: ¡nivel A2!</div></div>`;
  el.innerHTML = html;
  hydratePiaf(el);
  drawTrails(el);
  const hs = $('#h-srs', el); if (hs) hs.onclick = () => startQuiz(buildSrs(), { title: 'Repaso del día', xp: 10, practice: 'srs' });
  $$('[data-node]', el).forEach(b => b.onclick = () => openNode(b.dataset.node));
  $$('[data-guide]', el).forEach(b => b.onclick = () => openGuide(b.dataset.guide));
  $$('[data-chest]', el).forEach(b => b.onclick = () => b.dataset.ok === '1' ? openChest(b.dataset.chest, +b.dataset.amt) : (sfx.bad(), toast('Terminá la lección de arriba para abrir el cofre')));
  const hp = $('.hello .piaf', el);
  if (hp) hp.onclick = () => { hp.classList.remove('jump', 'flap'); void hp.offsetWidth; hp.classList.add('jump', 'flap'); if (pdj) play(pdj.au); };
  $$('[data-au]', el).forEach(b => b.onclick = e => { e.stopPropagation(); play(b.dataset.au); });
  if (!renderLearn.scrolled && cur) {
    renderLearn.scrolled = true;
    requestAnimationFrame(() => { const n = el.querySelector('.node.current'); if (n && ORDER.indexOf(cur) > 2) el.scrollTop = n.offsetTop - el.clientHeight / 2; });
  }
}

function openNode(id) {
  const n = NODE[id]; if (!n) return;
  if (!isOpen(id)) { sfx.bad(); toast('Primero terminá la lección anterior'); return; }
  sfx.tap();
  if (n.type === 'lesson') openIntro(n.lesson);
  else if (n.type === 'dialog') openDialog(n.dialog);
  else if (n.type === 'story') openStory(n.story);
  else startQuiz(buildReview(n.unit), { node: n.id, title: n.title, xp: 20, hearts: true });
}

/* ============ présentation de la leçon ============ */
function openIntro(l, guideMode = false) {
  const u = l.unit, el = $('#intro');
  const lv = lvlOf(l.id); let sel = Math.min(3, lv + 1);
  el.style.setProperty('--u', u.color[0]); el.style.setProperty('--u-d', u.color[1]);
  el.innerHTML = `<div class="intro-head"><button class="icon-btn" id="i-back">${ic('arrow-left')}</button>
      <small>Unidad ${UNITS.indexOf(u)} · Lección ${l.n}</small><h1>${esc(l.title)}</h1>${l.art ? `<span class="intro-art">${art(l.art)}</span>` : ''}</div>
    <div class="intro-body">
      ${l.video ? `<button class="vthumb" id="i-video" style="background-image:url(https://i.ytimg.com/vi/${l.video}/hqdefault.jpg)"><span class="play">${ic('play')}</span><span class="vlabel">${ic('clapperboard')} Mirá la clase en video</span></button>` : ''}
      <div class="sec-t">La mini clase</div>
      <div class="tip">${l.tip || ''}</div>
      <div class="sec-t">Palabras de la lección · tocá para escuchar</div>
      <div class="vocab-list">${l.vocab.map((v, i) => `<button class="vchip" data-v="${i}">${v.art ? `<span class="vart">${art(v.art)}</span>` : ''}<div><b>${esc(v.fr)}</b><span>${esc(v.es)}</span></div></button>`).join('')}</div>
      <div class="sec-t">Frases modelo</div>
      ${l.sentences.slice(0, 4).map((s, i) => `<button class="word" data-s="${i}"><div><div class="w-fr">${esc(s.fr)}</div><div class="w-es">${esc(s.es)}</div></div>${ic('volume-2')}</button>`).join('')}
    </div>
    <div class="intro-foot"><div class="lvls">${[1, 2, 3].map(k => `<button class="lvl ${k <= lv ? 'done' : ''} ${k === sel ? 'on' : ''}" data-lvl="${k}" ${k > lv + 1 ? 'disabled' : ''}>${ic(k > lv + 1 ? 'lock' : 'crown')}<b>Nivel ${k}</b><small>${['Descubrir', 'Afianzar', 'Dominar'][k - 1]}</small></button>`).join('')}</div>
    <button class="btn primary wide" id="i-start">Empezar el nivel ${sel}</button></div>`;
  $('#i-back').onclick = goHome;
  $$('.lvl', el).forEach(b => b.onclick = () => { sel = +b.dataset.lvl; $$('.lvl', el).forEach(x => x.classList.toggle('on', x === b)); $('#i-start').textContent = 'Empezar el nivel ' + sel; sfx.tap(); });
  $('#i-start').onclick = () => startQuiz(buildLesson(l, sel), { node: l.id, title: l.title + ' · nivel ' + sel, xp: 10 + 5 * sel, hearts: true, level: sel });
  if (l.video) $('#i-video').onclick = () => openVideo(l.video, l.title);
  $$('[data-v]', el).forEach(b => b.onclick = () => play(l.vocab[b.dataset.v].au));
  $$('[data-s]', el).forEach(b => b.onclick = () => play(l.sentences[b.dataset.s].au));
  // mots français dans l'explication : on retrouve l'audio s'il existe
  const known = {};
  l.vocab.concat(l.sentences).forEach(x => { known[norm(x.fr)] = x.au; });
  $$('.tip .fr', el).forEach(s => { const k = known[norm(s.textContent)]; if (k) s.onclick = () => play(k); });
  show('intro'); el.scrollTop = 0;
}

function openGuide(uid) {
  const u = UNITS.find(x => x.id === uid), el = $('#intro');
  el.style.setProperty('--u', u.color[0]); el.style.setProperty('--u-d', u.color[1]);
  el.innerHTML = `<div class="intro-head"><button class="icon-btn" id="i-back">${ic('arrow-left')}</button>
    <small>Guía · Unidad ${UNITS.indexOf(u)}</small><h1>${esc(u.title)}</h1></div>
    <div class="intro-body">${u.lessons.map(l => `<div class="card"><h3>${l.n}. ${esc(l.title)}</h3><div class="tip">${l.tip || ''}</div>
      ${l.video ? `<button class="btn ghost" data-vid="${l.video}" data-t="${esc(l.title)}" style="padding:0;min-height:36px;color:var(--red)">${ic('circle-play')} Ver el video</button>` : ''}</div>`).join('')}</div>`;
  $('#i-back').onclick = goHome;
  $$('[data-vid]', el).forEach(b => b.onclick = () => openVideo(b.dataset.vid, b.dataset.t));
  show('intro'); el.scrollTop = 0;
}

/* ============ vidéo ============ */
function openVideo(id, title) {
  stopAudio();
  $('#v-title').textContent = title || 'Video';
  $('#v-frame').innerHTML = navigator.onLine === false
    ? '<div class="empty" style="color:#fff">Necesitás internet para ver el video.</div>'
    : `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  $('#v-yt').onclick = () => { if (Bridge) Bridge.openYoutube(id); else window.open('https://www.youtube.com/watch?v=' + id); };
  $('#video').hidden = false;
}
function closeVideo() { $('#video').hidden = true; $('#v-frame').innerHTML = ''; }
$('#v-close').onclick = closeVideo;

/* ============ fabrication des exercices ============ */
const speakOK = () => S.set.speak && Bridge && safeCanListen() && Date.now() > (S.speakOff || 0);
function safeCanListen() { try { return Bridge.canListen(); } catch { return false; } }

/* deux traductions « se recouvrent » si elles partagent une des variantes séparées par « / » */
const esParts = t => String(t).toLowerCase().replace(/\(.*?\)/g, '').split('/').map(norm).filter(Boolean);
const overlap = (a, b) => { const pa = esParts(a); return esParts(b).some(x => pa.includes(x)); };
const distinct = (x, v) => !overlap(x.es, v.es) && norm(x.fr) !== norm(v.fr);
function exPick(v, vs) {
  const others = [];
  shuffle(vs.filter(x => distinct(x, v))).forEach(x => { if (others.length < 3 && others.every(o => distinct(o, x))) others.push(x); });
  return { t: 'pick', item: v, opts: shuffle([v.es, ...others.map(o => o.es)]), ans: v.es, ref: ['v', v.lesson, v.fr] };
}
function exPickFr(v, vs) {
  const others = sample(vs.filter(x => distinct(x, v)), 2);
  return { t: 'pickfr', item: v, opts: shuffle([v, ...others]), ans: v.fr, ref: ['v', v.lesson, v.fr] };
}
const ART = ['#2E5BFF', '#12A48B', '#FF8A1C', '#7B5CFF', '#E8508A', '#1BA3E0'];
function exPickImg(v, vs) {
  const others = sample(vs.filter(x => x.art && x.art !== v.art && distinct(x, v))
    .filter((x, i, a) => a.findIndex(y => y.art === x.art) === i), 3);
  if (others.length < 2) return null;
  const col = shuffle(ART);
  return { t: 'pickimg', item: v, opts: shuffle([v, ...others]).map((o, i) => ({ ...o, col: col[i] })), ans: v.fr, ref: ['v', v.lesson, v.fr] };
}
const imgPool = (V, extra) => { const own = V.filter(v => v.art); return own.length >= 4 ? own : own.concat(extra.filter(v => v.art && !own.includes(v))); };
/* Noms propres : mots écrits avec une majuscule ailleurs qu'en début de phrase. Eux seuls gardent leur majuscule
   sur les étiquettes ; sinon la majuscule désignerait le premier mot (et un leurre en majuscule serait un piège). */
const PROPER = new Set(['Alejandra', 'Jaemeson', 'Adrien', 'Thibault', 'Luca', 'Maxime', 'Amandine', 'Margaux', 'Chloé', 'Manon', 'Clémence', 'Juliette', 'Shelby', 'Jacques', 'Paris', 'Lyon', 'France', 'Argentine', 'Argentina', 'Francia']);
const rawWords = t => String(t).replace(/[’‘]/g, "'").split(/\s+/).filter(Boolean);
const cleanWord = r => r.replace(/^[¿¡«"“(]+|[.,!?;:»"”)…]+$/g, '');
UNITS.forEach(u => u.lessons.forEach(l => l.sentences.forEach(st => [st.fr, st.es].forEach(t => {
  const raw = rawWords(t);
  raw.forEach((r, i) => { const c = cleanWord(r); if (i > 0 && !/[.!?…]$/.test(raw[i - 1]) && /^[A-ZÀ-ÖØ-Þ]/.test(c)) PROPER.add(c); });
}))));
function bankTokens(text) {
  const raw = rawWords(text), out = [];
  raw.forEach((r, i) => {
    const c = cleanWord(r); if (!c) return;
    const start = i === 0 || /[.!?…]$/.test(raw[i - 1]);
    out.push(start && !PROPER.has(c) ? c.charAt(0).toLowerCase() + c.slice(1) : c);
  });
  return out;
}
function distractors(target, from, n) {
  const have = new Set(bankTokens(target).map(t => t.toLowerCase()));
  const seen = new Set(), cand = [];
  from.flatMap(x => bankTokens(x)).forEach(t => { const k = t.toLowerCase(); if (!have.has(k) && !seen.has(k)) { seen.add(k); cand.push(t); } });
  return sample(cand, n);
}
function exBuild(s, ss, dir) {
  const target = dir === 'es' ? s.es : s.fr;
  const others = ss.filter(x => x !== s).map(x => dir === 'es' ? x.es : x.fr);
  const tk = bankTokens(target);
  const bank = shuffle([...tk, ...distractors(target, others, tk.length > 6 ? 2 : 3)]);
  return { t: dir === 'es' ? 'build-es' : 'build', item: s, bank, ans: target, ref: ['s', s.lesson, s.fr] };
}
function exListen(s, ss) { const e = exBuild(s, ss, 'fr'); e.t = 'listen'; return e; }
const fillIn = (q, o) => (/'$/.test(o) ? q.replace('___ ', o) : q.replace('___', o));
function exFill(g) {
  const full = fillIn(g.q, g.opts[g.a]);
  return { t: 'fill', item: g, opts: g.opts.map((o, i) => ({ o, i })).sort(() => Math.random() - .5), ans: g.opts[g.a], full, ref: ['g', g.lesson, g.q] };
}
function exMatch(vs) {
  const p = [];
  shuffle(vs).forEach(x => { if (p.length < 5 && p.every(o => distinct(o, x))) p.push(x); });
  return { t: 'match', pairs: p, ref: null };
}
function exSpeak(s) { return { t: 'speak', item: s, ans: s.fr, ref: ['s', s.lesson, s.fr] }; }

function buildLesson(l, level = 1) {
  if (level > 1) return buildLessonHard(l, level);
  const P = pool([l]);
  const V = P.vocab, SS = P.sent, G = P.gram;
  const ex = [];
  const vq = shuffle(V), sq = shuffle(SS), gq = shuffle(G);
  const takeV = () => vq.length ? vq.shift() : rand(V);
  const takeS = () => sq.length ? sq.shift() : rand(SS);
  const takeG = () => gq.length ? gq.shift() : null;
  const first = !isDone(l.id);
  // exercices en images si la leçon a des mots illustrés
  const withIc = shuffle(V.filter(v => v.art));
  const IP = imgPool(V, pool(l.unit.lessons).vocab);
  if (withIc.length) {
    const a = exPickImg(withIc[0], IP); if (a) { ex.push(a); const k = vq.findIndex(x => x.fr === withIc[0].fr); if (k >= 0) vq.splice(k, 1); }
  }
  ex.push(exPick(takeV(), V));
  if (withIc.length > 1) { const b = exPickImg(withIc[1], IP); ex.push(b || exPick(takeV(), V)); }
  else ex.push(exPick(takeV(), V));
  if (V.length >= 4) ex.push(exMatch(V));
  ex.push(exPickFr(takeV(), V));
  let g = takeG(); if (g) ex.push(exFill(g));
  ex.push(exBuild(takeS(), SS, 'fr'));
  ex.push(exListen(takeS(), SS));
  g = takeG(); if (g) ex.push(exFill(g));
  ex.push(exBuild(takeS(), SS, 'es'));
  if (speakOK()) ex.push(exSpeak(takeS()));
  ex.push(exListen(takeS(), SS));
  ex.push(exBuild(takeS(), SS, 'fr'));
  g = takeG(); if (g) ex.push(exFill(g));
  if (!first) { ex.push(exPick(takeV(), V)); if (speakOK()) ex.push(exSpeak(takeS())); }
  return ex.filter(Boolean);
}

function buildReview(u) {
  const P = pool(u.lessons);
  const ex = [];
  for (let i = 0; i < 3; i++) ex.push(exPick(rand(P.vocab), P.vocab));
  const iv = P.vocab.filter(v => v.art);
  if (iv.length >= 3) sample(iv, 2).forEach(v => { const e = exPickImg(v, iv); if (e) ex.push(e); });
  ex.push(exMatch(P.vocab));
  sample(P.gram, 4).forEach(g => ex.push(exFill(g)));
  sample(P.sent, 7).forEach((s, i) => ex.push(i % 3 === 0 ? exListen(s, P.sent) : i % 3 === 1 ? exBuild(s, P.sent, 'fr') : exBuild(s, P.sent, 'es')));
  if (speakOK()) sample(P.sent, 2).forEach(s => ex.push(exSpeak(s)));
  const [a, ...rest] = ex;
  return [a, ...shuffle(rest)];
}

function findRef(ref) {
  const [k, lid, fr] = ref, l = LESSON[lid]; if (!l) return null;
  if (k === 'v') return l.vocab.find(v => v.fr === fr) && { ...l.vocab.find(v => v.fr === fr), lesson: lid };
  if (k === 's') return l.sentences.find(v => v.fr === fr) && { ...l.sentences.find(v => v.fr === fr), lesson: lid };
  if (k === 'g') return (l.grammar || []).find(v => v.q === fr) && { ...(l.grammar || []).find(v => v.q === fr), lesson: lid };
}
function buildMistakes() {
  const ls = doneLessons(); const P = pool(ls.length ? ls : [UNITS[0].lessons[0]]);
  const ex = [];
  S.mistakes.slice(-14).reverse().forEach(m => {
    const it = findRef(m.ref); if (!it) return;
    if (m.ref[0] === 'v') ex.push(Math.random() < .5 ? exPick(it, P.vocab) : exPickFr(it, P.vocab));
    else if (m.ref[0] === 'g') ex.push(exFill(it));
    else ex.push(m.t === 'listen' ? exListen(it, P.sent) : m.t === 'build-es' ? exBuild(it, P.sent, 'es') : m.t === 'speak' && speakOK() ? exSpeak(it) : exBuild(it, P.sent, 'fr'));
  });
  return ex;
}
function practiceSet(kind) {
  const ls = doneLessons(); const P = pool(ls);
  if (kind === 'listen') return sample(P.sent, 10).map(s => exListen(s, P.sent));
  if (kind === 'speak') return sample(P.sent, 8).map(exSpeak);
  if (kind === 'words') { const ex = []; const iv = P.vocab.filter(v => v.art);
    if (iv.length >= 3) sample(iv, 3).forEach(v => { const e = exPickImg(v, iv); if (e) ex.push(e); }); for (let i = 0; i < 4; i++) ex.push(exPick(rand(P.vocab), P.vocab)); ex.push(exMatch(P.vocab)); for (let i = 0; i < 3; i++) ex.push(exPickFr(rand(P.vocab), P.vocab)); ex.push(exMatch(P.vocab)); return ex; }
  if (kind === 'grammar') return sample(P.gram, 10).map(exFill);
  // mélange
  const ex = [];
  sample(P.vocab, 3).forEach(v => ex.push(exPick(v, P.vocab)));
  sample(P.gram, 3).forEach(g => ex.push(exFill(g)));
  sample(P.sent, 6).forEach((s, i) => ex.push(i % 2 ? exListen(s, P.sent) : exBuild(s, P.sent, 'fr')));
  return shuffle(ex);
}

/* ============ moteur du quiz ============ */
let Q = null;
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Genial!', '¡Perfecto!', '¡Bravo!', '¡Así se hace!', `¡Muy bien, ${NAME}!`, '¡Impecable!', 'Super !', 'Parfait !'];
const TYPE_LABEL = {
  pick: ['sparkles', 'Palabra'], pickfr: ['sparkles', 'Palabra'], pickimg: ['image', 'Palabra nueva'], match: ['link', 'Uní los pares'],
  build: ['languages', 'Traducí'], 'build-es': ['languages', 'Traducí al español'], listen: ['headphones', 'Escuchá'],
  fill: ['puzzle', 'Completá'], speak: ['mic', 'Hablá'],
};
function startQuiz(list, meta) {
  if (!list.length) { toast('Todavía no hay ejercicios para practicar.'); return; }
  if (meta.hearts && S.set.hearts && heartsNow() === 0) { outOfHearts(); return; }
  Q = { list: list.slice(), total: list.length, i: 0, done: 0, right: 0, wrong: 0, combo: 0, bestCombo: 0, retried: new Set(), meta, t0: Date.now(), answer: null, locked: false };
  show('quiz');
  updateHearts();
  nextEx();
}
function setProgress() { $('#q-prog').style.width = (100 * Q.done / Q.total) + '%'; }
function nextEx() {
  stopAudio();
  $('#q-fb').classList.remove('show', 'bad');
  if (Q.i >= Q.list.length) return finishQuiz();
  Q.ex = Q.list[Q.i];
  Q.answer = null; Q.locked = false;
  $('#q-check').disabled = true; $('#q-check').textContent = 'Comprobar'; $('#q-check').hidden = false;
  $('#q-skip').hidden = true;
  setProgress();
  const body = $('#q-body'); body.scrollTop = 0;
  const [icn, lab] = TYPE_LABEL[Q.ex.t];
  const head = ['build', 'build-es', 'listen'].includes(Q.ex.t) ? '' : `<div class="qtype">${ic(icn)} ${lab}</div>`;
  RENDER_EX[Q.ex.t](body, Q.ex, head);
  hydratePiaf(body);
  const more = () => body.classList.toggle('more', body.scrollHeight - body.scrollTop > body.clientHeight + 6);
  body.onscroll = more; setTimeout(more, 60);
}
const setAnswer = v => { Q.answer = v; $('#q-check').disabled = v == null || v === '' || (Array.isArray(v) && !v.length); };

function promptBubble(text, au, sub = '', prop = '') {
  return `<div class="prompt"><span class="piaf" data-piaf="happy" data-prop="${prop}"></span><div class="bubble"><div class="line">${au ? `<button class="say" data-play="${au}">${ic('volume-2')}</button>` : ''}<span>${esc(text)}</span></div>${sub}</div></div>`;
}
function wirePlay(root) { $$('[data-play]', root).forEach(b => b.onclick = () => play(b.dataset.play, b.dataset.slow === '1')); }

const RENDER_EX = {
  pick(body, ex, head) {
    body.innerHTML = head + `<h2 class="qtitle">¿Qué significa?</h2>` + promptBubble(ex.item.fr, ex.item.au) +
      `<div class="options">${ex.opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${i + 1}</span>${esc(o)}</button>`).join('')}</div>`;
    wirePlay(body);
    $$('.opt', body).forEach(b => b.onclick = () => { if (Q.locked) return; sfx.tap(); $$('.opt', body).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); setAnswer(ex.opts[b.dataset.i]); });
    if (S.set.autoplay) setTimeout(() => play(ex.item.au), 250);
  },
  pickimg(body, ex, head) {
    body.innerHTML = head + `<h2 class="qtitle">¿Cuál es «${esc(ex.item.es)}»?</h2>` +
      `<div class="imgs">${ex.opts.map((o, i) => `<button class="imgcard" data-i="${i}"><span class="art-big">${art(o.art)}</span>${esc(o.fr)}</button>`).join('')}</div>`;
    $$('.imgcard', body).forEach(b => b.onclick = () => { if (Q.locked) return; const o = ex.opts[b.dataset.i]; play(o.au); $$('.imgcard', body).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); setAnswer(o.fr); });
  },
  pickfr(body, ex, head) {
    body.innerHTML = head + `<h2 class="qtitle">¿Cómo se dice «${esc(ex.item.es)}»?</h2>` +
      `<div class="options">${ex.opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${i + 1}</span>${esc(o.fr)}</button>`).join('')}</div>`;
    $$('.opt', body).forEach(b => b.onclick = () => { if (Q.locked) return; const o = ex.opts[b.dataset.i]; play(o.au); $$('.opt', body).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); setAnswer(o.fr); });
  },
  fill(body, ex, head) {
    const [a, b] = ex.item.q.split('___');
    body.innerHTML = head + `<h2 class="qtitle">Elegí la palabra que falta</h2>${ex.hint ? `<div class="vhint">${esc(ex.hint)}</div>` : ''}
      <div class="fill-sent">${esc(a)}<span class="gap" id="gap">&nbsp;</span>${esc(b || '')}</div>${ex.item.es ? `<div class="fill-es">${esc(ex.item.es)}</div>` : ''}
      <div class="options">${ex.opts.map(o => `<button class="opt" data-i="${o.i}"><span class="k">${ic('pencil')}</span>${esc(o.o)}</button>`).join('')}</div>`;
    $$('.opt', body).forEach(btn => btn.onclick = () => { if (Q.locked) return; sfx.tap(); $$('.opt', body).forEach(x => x.classList.remove('sel')); btn.classList.add('sel'); const v = ex.item.opts[btn.dataset.i]; $('#gap').textContent = v; setAnswer(v); });
  },
  build(body, ex, head) { buildUI(body, ex, head, `<h2 class="qtitle">Traducí esta frase</h2>` + promptBubble(ex.item.es)); },
  'build-es'(body, ex, head) { buildUI(body, ex, head, `<h2 class="qtitle">Traducí al español</h2>` + promptBubble(ex.item.fr, ex.item.au)); if (S.set.autoplay) setTimeout(() => play(ex.item.au), 250); },
  listen(body, ex, head) {
    buildUI(body, ex, head, `<h2 class="qtitle">Tocá lo que escuchás</h2><div class="big-say"><span class="piaf listener" data-piaf="happy" data-prop="phones"></span><button class="say" data-play="${ex.item.au}">${ic('volume-2')}</button><button class="say slow" data-play="${ex.item.au}" data-slow="1" aria-label="Más lento">${ic('snail')}</button></div>`);
    setTimeout(() => play(ex.item.au), 300);
  },
  match(body, ex, head) {
    const L = shuffle(ex.pairs), R = shuffle(ex.pairs);
    body.innerHTML = head + `<h2 class="qtitle">Tocá los pares</h2><div class="match">${L.map((p, i) => `<button class="opt" data-side="l" data-k="${esc(p.fr)}" style="grid-column:1;grid-row:${i + 1}">${esc(p.fr)}</button>`).join('')}${R.map((p, i) => `<button class="opt" data-side="r" data-k="${esc(p.fr)}" style="grid-column:2;grid-row:${i + 1}">${esc(p.es)}</button>`).join('')}</div>`;
    let sel = null, left = ex.pairs.length, errs = 0;
    $('#q-check').hidden = true;
    $$('.opt', body).forEach(b => b.onclick = () => {
      if (b.classList.contains('gone')) return;
      if (b.dataset.side === 'l') { const p = ex.pairs.find(x => x.fr === b.dataset.k); play(p.au); } else sfx.tap();
      if (!sel || sel.dataset.side === b.dataset.side) { if (sel) sel.classList.remove('sel'); sel = b; b.classList.add('sel'); return; }
      if (sel.dataset.k === b.dataset.k) {
        [sel, b].forEach(x => { x.classList.remove('sel'); x.classList.add('right', 'gone'); });
        haptic('ok'); sel = null;
        if (--left === 0) setTimeout(() => { if (touchDay()) Q.newDay = true; sfx.ok(); Q.combo++; Q.right++; Q.done++; Q.i++; setProgress(); setTimeout(nextEx, 350); }, 450);
      } else {
        errs++; sfx.bad(); haptic('error');
        const a = sel; [a, b].forEach(x => { x.classList.remove('sel'); x.classList.add('wrong'); });
        setTimeout(() => [a, b].forEach(x => x.classList.remove('wrong')), 450);
        sel = null;
      }
    });
  },
  speak(body, ex, head) {
    body.innerHTML = head + `<h2 class="qtitle">Decí esta frase en voz alta</h2>` + promptBubble(ex.item.fr, ex.item.au, `<div class="pdj-es">${esc(ex.item.es)}</div>`) +
      `<div class="speak-box"><button class="mic" id="mic">${ic('mic-g')}</button><div class="heard" id="heard">Tocá el micrófono y hablá</div></div>`;
    wirePlay(body);
    $('#q-check').hidden = true;
    $('#q-skip').hidden = false;
    $('#q-skip').onclick = () => { S.speakOff = Date.now() + 15 * 60e3; save(); toast('Listo: nada de hablar por 15 minutos.'); Q.done++; Q.i++; nextEx(); };
    if (S.set.autoplay) setTimeout(() => play(ex.item.au), 250);
    const mic = $('#mic'), heard = $('#heard');
    let listening = false;
    mic.onclick = () => {
      if (Q.locked) return;
      if (listening) { try { Bridge.stopListening(); } catch { } return; }
      stopAudio(); listening = true; mic.classList.add('on'); heard.textContent = 'Te escucho…';
      try { Bridge.listen(); } catch { listening = false; mic.classList.remove('on'); }
    };
    window.onSpeechLevel = v => mic.style.setProperty('--lvl', 1 + Math.max(0, Math.min(10, v)) / 25);
    window.onSpeechPartial = t => { heard.textContent = t; };
    window.onSpeechState = () => { };
    window.onSpeech = r => {
      listening = false; mic.classList.remove('on');
      if (!r.ok) {
        heard.textContent = { permission: 'Necesito permiso para usar el micrófono.', nomatch: 'No te entendí. Probá de nuevo.', timeout: 'No escuché nada. Probá de nuevo.', network: 'Sin conexión: el reconocimiento de voz necesita internet.', unavailable: 'Tu teléfono no tiene reconocimiento de voz.' }[r.error] || 'Probá de nuevo.';
        return;
      }
      const best = (r.texts || []).map(t => ({ t, s: simil(t, ex.ans) })).sort((a, b) => b.s - a.s)[0] || { t: '', s: 0 };
      const want = tokens(ex.ans).map(w => deacc(norm(w)));
      const got = new Set(tokens(best.t).map(w => deacc(norm(w))));
      heard.innerHTML = tokens(ex.ans).map((w, i) => `<span class="${got.has(want[i]) ? 'ok' : 'ko'}">${esc(w)}</span>`).join(' ');
      Q.answer = best.t;
      judge(best.s >= .72, best.s >= .72 ? '' : `Escuché: «${best.t}»`);
    };
  },
};

function buildUI(body, ex, head, top) {
  body.innerHTML = head + top + `<div class="answer" id="ans"></div><div class="bank" id="bank">${ex.bank.map((t, i) => `<button class="tok" data-i="${i}">${esc(t)}</button>`).join('')}</div>`;
  wirePlay(body);
  const chosen = [];
  const ans = $('#ans', body);
  const refresh = () => setAnswer(chosen.map(i => ex.bank[i]).join(' '));
  const frBank = ex.t !== 'build-es';
  const wordAu = w => frBank && C.words ? C.words[String(w).toLowerCase()] : null;
  $$('#bank .tok', body).forEach(b => b.onclick = () => {
    if (Q.locked) return;
    const au = wordAu(ex.bank[+b.dataset.i]);
    if (au) play(au); else sfx.tap();
    const i = +b.dataset.i; chosen.push(i); b.classList.add('used');
    const t = document.createElement('button'); t.className = 'tok'; t.textContent = ex.bank[i];
    t.onclick = () => { if (Q.locked) return; sfx.tap(); chosen.splice(chosen.indexOf(i), 1); t.remove(); b.classList.remove('used'); refresh(); };
    ans.appendChild(t); refresh();
    try {
      t.style.animation = 'none';
      const r0 = b.getBoundingClientRect(), r1 = t.getBoundingClientRect();
      t.animate([{ transform: `translate(${r0.left - r1.left}px,${r0.top - r1.top}px) scale(1.04)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.3,1)' });
    } catch { }
  });
}

$('#q-check').onclick = () => {
  if (Q.locked || Q.answer == null) return;
  const ex = Q.ex;
  let ok, note = '';
  if (ex.t === 'type' || ex.t === 'dictation') { const r = checkTyped(Q.answer, ex.ans); ok = r.ok; note = r.note; }
  else if (ex.t === 'num') ok = String(Q.answer).replace(/\D/g, '') === ex.ans;
  else ok = norm(Q.answer) === norm(ex.ans);
  if (ex.t === 'pickimg') {
    $$('.imgcard', $('#q-body')).forEach(b => {
      if (norm(ex.opts[b.dataset.i].fr) === norm(ex.ans)) b.classList.add('right');
      else if (b.classList.contains('sel')) b.classList.add('wrong');
    });
  }
  if (ex.t === 'pick' || ex.t === 'hear' || ex.t === 'pickfr' || ex.t === 'fill') {
    $$('.opt', $('#q-body')).forEach(b => {
      const val = ex.t === 'pick' || ex.t === 'hear' ? ex.opts[b.dataset.i] : ex.t === 'pickfr' ? ex.opts[b.dataset.i].fr : ex.item.opts[b.dataset.i];
      if (norm(val) === norm(ex.ans)) b.classList.add('right');
      else if (b.classList.contains('sel')) b.classList.add('wrong');
    });
  }
  judge(ok, note);
};

function judge(ok, extra = '') {
  Q.locked = true;
  if (touchDay()) { Q.newDay = true; updateTop(); }
  { const ti = $('#tin'); if (ti) { ti.disabled = true; ti.blur(); } }
  const ex = Q.ex, fb = $('#q-fb');
  fb.classList.toggle('bad', !ok);
  $('.fb-ico', fb).innerHTML = ok ? ic('check') : ic('x');
  // Piaf réagit : saut de joie ou petite mine triste
  const fp = $('.fb-piaf', fb);
  fp.innerHTML = piaf(ok ? 'joy' : 'sad'); fp.className = 'fb-piaf piaf ' + (ok ? 'jump flap' : 'droop');
  const pp = $('#q-body .prompt .piaf') || $('#q-body .listener');
  if (pp) { pp.innerHTML = piaf(ok ? 'joy' : 'sad', pp.dataset.prop || ''); pp.className = 'piaf ' + (pp.classList.contains('listener') ? 'listener ' : '') + (ok ? 'jump flap' : 'droop'); }
  $('.fb-ico', fb).style.color = ok ? 'var(--green)' : 'var(--red)';
  let text = '';
  const correct = ex.t === 'fill' ? ex.full : ex.t === 'pickfr' ? ex.ans : ex.ans;
  if (ok) {
    $('.fb-title', fb).textContent = rand(PRAISE);
    if (ex.t === 'build-es') text = esc(ex.item.fr);
    else if (ex.t === 'build' || ex.t === 'listen' || ex.t === 'dictation' || ex.t === 'num') text = esc(ex.item.es);
    else if (ex.t === 'type' && extra) text = esc(ex.ans);
    else if (ex.t === 'fill') text = esc(ex.full) + `<span class="why">${esc(ex.item.es)}</span>`;
    if (extra && ex.t === 'dictation') text = esc(ex.ans);
    if (extra) text += `<span class="why">${esc(extra)}</span>`;
    Q.right++; Q.combo++; Q.bestCombo = Math.max(Q.bestCombo, Q.combo); Q.done++;
    bump('right'); if (ex.t === 'listen') bump('listen'); bump('combo', Q.combo, true);
    sfx.ok(); haptic('ok');
    if (Q.combo > 0 && Q.combo % 5 === 0) comboPop(Q.combo);
    // l'audio de la bonne réponse
    const au = ex.t === 'fill' ? ex.item.au : ex.item && ex.item.au;
    if (au && ex.t !== 'pick') setTimeout(() => play(au), 120);
    srsUpdate(ex.ref, true);
    if (ex.ref) S.mistakes = S.mistakes.filter(m => m.ref.join('|') !== ex.ref.join('|'));
  } else {
    $('.fb-title', fb).textContent = ex.t === 'speak' ? 'Casi…' : 'Respuesta correcta:';
    text = esc(correct);
    if (ex.t === 'build' || ex.t === 'listen' || ex.t === 'dictation' || ex.t === 'num') text += `<span class="why">${esc(ex.item.es)}</span>`;
    if (ex.t === 'fill' && ex.item.why) text += `<span class="why">${esc(ex.item.why)}</span>`;
    if (extra) text += `<span class="why">${esc(extra)}</span>`;
    Q.wrong++; Q.combo = 0;
    if (Q.meta.hearts && !ex.dq) { loseHeart(); updateHearts(); }
    sfx.bad(); haptic('error');
    srsUpdate(ex.ref, false);
    if (ex.ref) { S.mistakes = S.mistakes.filter(m => m.ref.join('|') !== ex.ref.join('|')); S.mistakes.push({ ref: ex.ref, t: ex.t }); S.mistakes = S.mistakes.slice(-60); }
    // on la repropose à la fin (une fois)
    if (!Q.retried.has(Q.i) && ex.t !== 'speak') { Q.retried.add(Q.list.length); Q.list.push(regen(ex)); Q.total++; }
    else Q.done++;
    const au = ex.t === 'fill' ? ex.item.au : ex.t !== 'pick' && ex.t !== 'build-es' && ex.item && ex.item.au;
    if (au) setTimeout(() => play(au), 350);
  }
  $('#q-combo').textContent = Q.combo >= 3 ? Q.combo + '×' : '';
  $('.fb-text', fb).innerHTML = text;
  $('#q-check').hidden = true; $('#q-skip').hidden = true;
  setProgress();
  save();
  setTimeout(() => fb.classList.add('show'), 16);
}
function regen(ex) {
  // même contenu, options rebattues
  if (ex.bank) return { ...ex, bank: shuffle(ex.bank) };
  if (ex.opts) return { ...ex, opts: shuffle(ex.opts) };
  return { ...ex };
}
function comboPop(n) {
  const fb = $('#q-fb'), who = n % 10 === 0 ? 'Jacques' : 'Shelby';
  $('.fb-title', fb).textContent = `¡${n} seguidas!`;
  const fp = $('.fb-piaf', fb);
  fp.innerHTML = animal(who); fp.className = 'fb-piaf npc jump';
}
$('#q-next').onclick = () => {
  if (Q.meta.hearts && S.set.hearts && heartsNow() === 0 && Q.i + 1 < Q.list.length) return outOfHearts();
  Q.i++; nextEx();
};
$('#q-close').onclick = async () => {
  if (Q && Q.done > 0 && Q.i < Q.list.length) { if (!(await ask('¿Salir de la lección? Vas a perder el progreso de esta sesión.', 'Salir'))) return; }
  goHome();
};

function finishQuiz() {
  const m = Q.meta;
  const answered = Q.right + Q.wrong;
  const acc = answered ? Math.round(100 * Q.right / answered) : 100;
  const stars = acc >= 95 ? 3 : acc >= 75 ? 2 : 1;
  let xp = m.xp + (acc === 100 ? 5 : 0) + Math.floor(Q.bestCombo / 5) * 2;
  const type = m.node ? (NODE[m.node] ? NODE[m.node].type : 'lesson') : 'practice';
  let newLevel = 0;
  if (m.node) {
    const n = S.nodes[m.node] || { times: 0, stars: 0 };
    const before = n.lvl || 0;
    n.times++; n.stars = Math.max(n.stars, stars); n.lvl = Math.max(before, m.level || 1);
    if (type === 'lesson' && n.lvl > before) newLevel = n.lvl;
    S.nodes[m.node] = n;
  }
  if (m.practice === 'mistakes') S.mistakes = S.mistakes.filter(x => !Q.list.some(e => e.ref && e.ref.join('|') === x.ref.join('|')));
  S.stats.bestCombo = Math.max(S.stats.bestCombo, Q.bestCombo);
  let coins = 3, heart = false;
  if (type === 'lesson') { S.stats.lessons++; bump('lessons'); coins = 5; if (acc === 100) { S.stats.perfect++; bump('perfect'); coins += 3; } }
  else if (type === 'review') coins = 10;
  else if (type === 'dialog') { S.stats.dialogs++; coins = 5; }
  else if (type === 'story') { S.stats.stories = (S.stats.stories || 0) + 1; coins = 5; }
  else { S.stats.practice++; bump('practice'); if (S.set.hearts && heartsNow() < MAXH) { gainHeart(1); heart = true; } }
  const wasStreak = S.last === today() && !Q.newDay;
  const goalBefore = (S.days[today()] || 0) >= S.goal;
  const boost = boostOn();
  const xpLv = levelOf(S.xp);
  xp = addXP(xp);
  const levelUp = levelOf(S.xp) > xpLv ? levelOf(S.xp) : 0;
  const goalHit = !goalBefore && (S.days[today()] || 0) >= S.goal;
  if (goalHit) coins += 10;
  addCoins(coins);
  const badges = checkBadges();
  const questsDone = bump.fresh || 0; bump.fresh = 0;
  results({ title: type === 'dialog' ? '¡Diálogo terminado!' : type === 'story' ? '¡Lectura terminada!' : acc === 100 ? '¡Lección perfecta!' : acc >= 75 ? '¡Lección completada!' : '¡Terminaste!', sub: m.title, xp, acc, time: Date.now() - Q.t0,
    stars: type === 'lesson' ? stars : 0, newStreak: !wasStreak, newLevel, levelUp, coins, badges, questsDone, goalHit, boost, heart });
  Q = null;
}

function results(r) {
  const el = $('#done');
  const mins = Math.floor(r.time / 60000), secs = Math.round(r.time / 1000) % 60;
  el.innerHTML = `<div class="confetti" id="conf"></div><div class="done-wrap"><span class="piaf ${r.acc == null || r.acc >= 75 ? 'party flap' : ''}" data-piaf="${r.acc == null || r.acc >= 75 ? 'joy' : 'happy'}"></span>
    <h1>${esc(r.title)}</h1><p>${esc(r.sub || '')}</p>
    ${r.stars ? `<div class="done-stars">${[1, 2, 3].map(k => ic('star', r.stars >= k ? 'on' : '')).join('')}</div>` : ''}
    <div class="res"><div class="r1"><small>XP ganada</small><b>${ic('zap')} <span id="r-xp">${r.xp}</span></b></div>
    <div class="r2"><small>${r.acc != null ? 'Precisión' : 'Diálogo'}</small><b>${ic('target')} ${r.acc != null ? r.acc + '%' : 'OK'}</b></div>
    <div class="r3"><small>Tiempo</small><b>${ic('timer')} ${mins}:${String(secs).padStart(2, '0')}</b></div></div>
    <div class="perks">
      ${r.levelUp ? `<span class="perk boost">${ic('arrow-big-up-dash')} ¡Nivel ${r.levelUp}!</span>` : ''}
      ${r.newLevel > 1 ? `<span class="perk quest">${ic('crown')} Corona ${r.newLevel} de 3</span>` : ''}
      ${r.coins ? `<span class="perk coin">+${r.coins} ${ic('croissant')}</span>` : ''}
      ${r.boost ? `<span class="perk boost">${ic('rocket')} XP ×2</span>` : ''}
      ${r.heart ? `<span class="perk heart">+1 ${ic('heart')}</span>` : ''}
      ${r.goalHit ? `<span class="perk goalp">${ic('target')} ¡Meta del día!</span>` : ''}
      ${r.questsDone ? `<span class="perk quest">${ic('gift')} ${r.questsDone > 1 ? r.questsDone + ' desafíos listos' : 'Desafío listo'}</span>` : ''}
    </div>
    ${r.newStreak ? `<div class="streak-card"><b>${ic('flame')} ¡Racha de ${S.streak} día${S.streak > 1 ? 's' : ''}!</b><div class="sweek">${[...Array(7)].map((_, i) => { const k = dateShift(i - 6); return `<span class="${k in S.days ? 'on' : ''}">${'DLMMJVS'[new Date(k + 'T12:00').getDay()]}</span>`; }).join('')}</div></div>` : ''}
    </div><div class="done-foot"><button class="btn primary wide" id="d-ok">Continuar</button></div>`;
  hydratePiaf(el);
  $('#d-ok').onclick = () => { goHome(); if (r.levelUp) setTimeout(() => pop(`<span class="piaf party flap" data-piaf="joy"></span><h2>¡Nivel ${r.levelUp}!</h2><p class="big-coins">${esc(levelName(r.levelUp))}</p><p>Seguí así, ${NAME}.</p><button class="btn primary wide" data-close>Merci !</button>`), 350); else if (r.badges && r.badges.length) setTimeout(() => badgePop(r.badges), 350); else if (r.questsDone) toast('¡Tenés un desafío para cobrar!'); };
  show('done');
  countUp($('#r-xp'), r.xp);
  sfx.win(); haptic('ok');
  const conf = $('#conf'), cols = ['#2E5BFF', '#FF9F1C', '#21A35B', '#E5484D', '#FFC93C', '#7B5CFF'];
  for (let i = 0; i < 46; i++) { const c = document.createElement('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = rand(cols); c.style.animationDuration = 1.6 + Math.random() * 1.8 + 's'; c.style.animationDelay = Math.random() * .6 + 's'; conf.appendChild(c); }
}

/* ============ dialogues ============ */
const AVA_COLORS = ['#7B5CFF', '#E8508A', '#12A48B', '#FF8A1C', '#1BA3E0'];
let D = null;
function openDialog(d, roleplay = false) {
  stopAudio();
  const speakers = Object.keys(d.speakers || {});
  d.lines.forEach(l => { if (!speakers.includes(l.who)) speakers.push(l.who); });
  const meWho = speakers.includes('Alejandra') ? 'Alejandra' : null;
  D = { d, i: 0, auto: true, speakers, meWho, roleplay: roleplay && meWho && speakOK(), phase: 'lines', q: 0, right: 0, t0: Date.now() };
  const el = $('#dlg');
  el.innerHTML = `<div class="dlg-head"><button class="icon-btn" id="dl-x">${ic('x')}</button><b>${esc(d.title)}</b>
      ${meWho && speakOK() ? `<button class="icon-btn" id="dl-role" title="Actuar">${ic('drama')}</button>` : ''}</div>
    <div class="stage"><div class="cast">${speakers.map(s => `<div class="cast-p" data-who="${esc(s)}">${person(s, (d.speakers || {})[s])}<span>${esc(s)}</span></div>`).join('')}</div></div>
    <div class="scene">${ic('clapperboard')}<span>${esc(d.scene || '')}${D.roleplay ? '<br><b>Modo actuación:</b> vos decís las frases de Alejandra.' : ''}</span></div>
    <div class="chat" id="chat"></div>
    <div class="hint" id="dl-hint">Tocá un mensaje para ver la traducción</div>
    <div class="dlg-foot" id="dl-foot"><button class="btn ghost" id="dl-replay" aria-label="Escuchar de nuevo">${ic('rotate-ccw')}</button><button class="btn purple" id="dl-next">Siguiente</button></div>`;
  $('#dl-x').onclick = goHome;
  if ($('#dl-role')) $('#dl-role').onclick = () => openDialog(d, !D.roleplay);
  $('#dl-next').onclick = dlgNext;
  $('#dl-replay').onclick = () => { const last = D.i - 1; if (last >= 0) play(d.lines[last].au); };
  show('dlg');
  dlgNext();
}
function dlgBubble(l, idx) {
  const me = D.meWho && l.who === D.meWho;
  const div = document.createElement('div');
  div.className = 'msg' + (me ? ' me' : '');
  div.innerHTML = `<span class="ava">${person(l.who, (D.d.speakers || {})[l.who])}</span>
    <button class="mb"><div class="who">${esc(l.who)}</div><div class="t">${esc(l.fr)}</div><div class="es">${esc(l.es)}</div></button>`;
  $('.mb', div).onclick = () => {
    $('.mb', div).classList.toggle('show-es');
    const t = $('.person', div); t.classList.add('talking');
    play(l.au).then(() => t.classList.remove('talking'));
  };
  return div;
}
async function dlgNext() {
  const d = D.d, chat = $('#chat');
  if (D.phase === 'lines') {
    if (D.i >= d.lines.length) {
      D.phase = 'q';
      $('#dl-next').textContent = 'Preguntas';
      $('#dl-hint').textContent = '¿Entendiste? Vamos a ver.';
      $('#dl-next').onclick = () => startDialogQuestions();
      return;
    }
    const l = d.lines[D.i], idx = D.i++;
    const b = dlgBubble(l, idx);
    chat.appendChild(b); b.scrollIntoView({ behavior: 'smooth', block: 'end' });
    $$('.mb.playing', chat).forEach(x => x.classList.remove('playing'));
    const mb = $('.mb', b);
    if (D.roleplay && l.who === D.meWho) {
      mb.classList.add('yourturn', 'show-es');
      $('#dl-next').disabled = true;
      $('#dl-hint').textContent = 'Tu turno: tocá el micrófono y decí la frase';
      const foot = $('#dl-foot');
      const mic = document.createElement('button'); mic.className = 'btn primary'; mic.innerHTML = ic('mic-g') + ' Hablar';
      foot.appendChild(mic);
      const done = () => { mic.remove(); $('#dl-next').disabled = false; mb.classList.remove('yourturn'); $('#dl-hint').textContent = 'Tocá un mensaje para ver la traducción'; play(l.au).then(() => setTimeout(dlgNext, 300)); };
      mic.onclick = () => { mic.innerHTML = ic('mic-g') + ' Te escucho…'; try { Bridge.listen(); } catch { done(); } };
      window.onSpeechPartial = t => { mic.innerHTML = ic('mic-g') + ' ' + esc(t.slice(0, 22)); };
      window.onSpeechLevel = () => { }; window.onSpeechState = () => { };
      window.onSpeech = r => {
        const s = r.ok ? Math.max(...(r.texts || ['']).map(t => simil(t, l.fr))) : 0;
        if (s >= .6) { sfx.ok(); haptic('ok'); toast(rand(PRAISE)); done(); }
        else { sfx.bad(); mic.innerHTML = ic('mic-g') + ' Otra vez'; toast(r.ok ? 'Casi… escuchá y probá de nuevo' : 'No te escuché, probá de nuevo'); play(l.au); }
      };
      return;
    }
    mb.classList.add('playing');
    const talkers = [$('.person', b), ...$$('.cast-p', $('#dlg')).filter(c => c.dataset.who === l.who).map(c => $('.person', c))].filter(Boolean);
    $$('.cast-p').forEach(c => c.classList.toggle('on', c.dataset.who === l.who));
    talkers.forEach(t => t.classList.add('talking'));
    const finished = await play(l.au);
    talkers.forEach(t => t.classList.remove('talking'));
    mb.classList.remove('playing');
    if (finished && D && D.auto && D.phase === 'lines' && screen === 'dlg' && D.i < d.lines.length && !(D.roleplay && d.lines[D.i].who === D.meWho)) setTimeout(() => { if (D && screen === 'dlg' && D.i === idx + 1) dlgNext(); }, 650);
  }
}
function startDialogQuestions() {
  const d = D.d;
  const list = (d.questions || []).map(q => ({ t: 'pick', dq: true, item: { fr: q.q }, opts: shuffle(q.opts), ans: q.opts[q.a], ref: null }));
  if (!list.length) return finishDialog(100);
  stopAudio();
  const node = d.id;
  startQuiz(list, { node, title: d.title, xp: 15 });
}
// question de dialogue : pas d'audio, consigne en espagnol
const basePick = RENDER_EX.pick;
RENDER_EX.pick = (body, ex, head) => {
  if (!ex.dq) return basePick(body, ex, head);
  body.innerHTML = `<div class="qtype">${ic('messages-square')} Comprensión</div><h2 class="qtitle">${esc(ex.item.fr)}</h2>` +
    `<div class="options">${ex.opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${i + 1}</span>${esc(o)}</button>`).join('')}</div>`;
  $$('.opt', body).forEach(b => b.onclick = () => { if (Q.locked) return; sfx.tap(); $$('.opt', body).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); setAnswer(ex.opts[b.dataset.i]); });
};
function finishDialog() { addXP(15); S.nodes[D.d.id] = { times: (S.nodes[D.d.id]?.times || 0) + 1, stars: 3 }; save(); results({ title: '¡Diálogo terminado!', sub: D.d.title, xp: 15, acc: null, time: Date.now() - D.t0 }); }

/* ============ onglet PRÁCTICA ============ */
function renderPractice() {
  const el = $('#tab-practice');
  const ls = doneLessons(), P = pool(ls);
  const nm = S.mistakes.filter(m => findRef(m.ref)).length;
  const items = [
    ['srs', 'brain', '#7B5CFF', 'Repaso del día', srsDue().length ? 'Las palabras que te toca repasar hoy' : 'Hoy no tenés nada pendiente', srsDue().length, srsDue().length > 0],
    ['mistakes', 'rotate-ccw', '#E5484D', 'Repasar mis errores', 'Lo que te costó, otra vez', nm, nm > 0],
    ['mix', 'shuffle', '#2E5BFF', 'Práctica rápida', '12 ejercicios mezclados', null, P.sent.length >= 6],
    ['listen', 'headphones', '#12A48B', 'Oído francés', 'Escuchá y armá las frases', null, P.sent.length >= 4],
    ['speak', 'mic', '#FF8A1C', 'Pronunciación', speakOK() || !S.set.speak ? 'Decí frases en voz alta' : 'Necesita el reconocimiento de voz del teléfono', null, P.sent.length >= 4 && speakOK()],
    ['words', 'blocks', '#7B5CFF', 'Vocabulario', 'Palabras de tus lecciones', null, P.vocab.length >= 6],
    ['grammar', 'puzzle', '#E8508A', 'Gramática', 'Completá los huecos', null, P.gram.length >= 4],
    ['verbs', 'repeat', '#0B7A67', 'Verbos', 'Conjugá los 24 verbos clave', null, (C.verbs || []).length > 0],
    ['numbers', 'hash', '#D06A00', 'Números', 'Escuchá y escribí del 0 al 100', null, !!C.nums],
  ];
  el.innerHTML = `<h1 class="page">Práctica</h1>` + (ls.length ? '' : `<div class="card"><p>Terminá tu primera lección para desbloquear la práctica.</p></div>`) +
    items.map(([k, icn, col, t, s, n, on]) => `<button class="card prac" data-p="${k}" ${on ? '' : 'disabled'}><span class="p-ico" style="background:${col}">${ic(icn)}</span><span><b>${t}</b><span>${s}</span></span>${n ? `<span class="count">${n}</span>` : ''}</button>`).join('') +
    `<h1 class="page" style="margin-top:22px;font-size:22px">Diálogos</h1>` +
    UNITS.flatMap(u => (u.dialogues || []).map(d => `<button class="card prac" data-d="${d.id}" ${isOpen(d.id) ? '' : 'disabled'}><span class="p-ico" style="background:${u.color[0]}">${ic(isDone(d.id) ? 'check' : 'messages-square')}</span><span><b>${esc(d.title)}</b><span>${esc(u.title)}</span></span></button>`)).join('') +
    `<h1 class="page" style="margin-top:22px;font-size:22px">Lecturas</h1>` +
    (C.stories || []).map(st => `<button class="card prac" data-st="${st.id}" ${NODE[st.id] && isOpen(st.id) ? '' : 'disabled'}><span class="p-ico" style="background:${NODE[st.id] ? NODE[st.id].unit.color[0] : '#888'}">${ic(isDone(st.id) ? 'check' : 'book-open-text')}</span><span><b>${esc(st.title)}</b><span>${esc(st.kind || 'Lectura')}</span></span></button>`).join('');
  const pw = document.createElement('button'); pw.className = 'card prac'; pw.innerHTML = `<span class="p-ico" style="background:#1E2A3A">${ic('book-open')}</span><span><b>Mis palabras</b><span>Todo el vocabulario, con audio</span></span>${ic('chevron-right', 'count')}`;
  pw.onclick = () => setTab('words'); el.insertBefore(pw, el.children[1] || null);
  $$('[data-p]', el).forEach(b => b.onclick = () => {
    const k = b.dataset.p;
    if (k === 'verbs') return chooseTense();
    const list = k === 'mistakes' ? buildMistakes() : k === 'numbers' ? buildNums() : k === 'srs' ? buildSrs() : practiceSet(k);
    startQuiz(list, { title: b.querySelector('b').textContent, xp: 10, practice: k });
  });
  $$('[data-d]', el).forEach(b => b.onclick = () => openDialog(NODE[b.dataset.d].dialog));
  $$('[data-st]', el).forEach(b => b.onclick = () => openStory(NODE[b.dataset.st].story));
}

/* ============ onglet PALABRAS ============ */
let wordsAll = false, wordsQ = '';
function renderWords() {
  const el = $('#tab-words');
  el.innerHTML = `<h1 class="page">Palabras</h1>
    <div class="search">${ic('search')}<input id="w-q" placeholder="Buscar en francés o español" value="${esc(wordsQ)}"></div>
    <div class="seg"><button data-w="0" class="${wordsAll ? '' : 'on'}">Aprendidas</button><button data-w="1" class="${wordsAll ? 'on' : ''}">Todo el curso</button></div>
    <div id="w-list"></div>`;
  $$('[data-w]', el).forEach(b => b.onclick = () => { wordsAll = b.dataset.w === '1'; renderWords(); });
  const inp = $('#w-q', el);
  inp.oninput = () => { wordsQ = inp.value; list(); };
  function list() {
    const q = deacc(norm(wordsQ));
    let html = '', count = 0;
    UNITS.forEach(u => u.lessons.forEach(l => {
      if (!wordsAll && !isDone(l.id)) return;
      const vs = l.vocab.filter(v => !q || deacc(norm(v.fr + ' ' + v.es)).includes(q));
      if (!vs.length) return;
      count += vs.length;
      html += `<div class="wgroup"><h4>${esc(u.title)} · ${esc(l.title)}</h4>${vs.map(v => `<button class="word" data-au="${v.au}">${v.art ? `<span class="vart">${art(v.art)}</span>` : ''}<div><div class="w-fr">${esc(v.fr)}${v.g ? `<span class="gtag ${v.g}">${v.g === 'm' ? 'masc.' : 'fem.'}</span>` : ''}</div><div class="w-es">${esc(v.es)}</div></div>${ic('volume-2')}</button>`).join('')}</div>`;
    }));
    $('#w-list', el).innerHTML = count ? html : `<div class="empty"><span class="piaf" data-piaf="${q ? 'sad' : 'happy'}"></span><p>${q ? 'No encontré esa palabra.' : 'Las palabras aparecen acá cuando terminás una lección.'}</p></div>`;
    hydratePiaf($('#w-list', el));
    $$('[data-au]', el).forEach(b => b.onclick = () => play(b.dataset.au));
  }
  list();
}

/* ============ onglet YO ============ */
function renderMe() {
  const el = $('#tab-me');
  const ls = doneLessons();
  const words = ls.reduce((n, l) => n + l.vocab.length, 0);
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); return { k, xp: S.days[k] || 0, l: 'DLMMJVS'[d.getDay()] }; });
  const max = Math.max(S.goal, ...days.map(d => d.xp));
  const sw = (k, t, s) => `<div class="set"><div><b>${t}</b><span>${s}</span></div><button class="switch ${S.set[k] ? 'on' : ''}" data-set="${k}" aria-label="${t}"></button></div>`;
  el.innerHTML = `<div class="me-head"><span class="piaf" data-piaf="happy"></span><div><h1>${NAME}</h1><p>Nivel ${levelOf(S.xp)} · ${levelName(levelOf(S.xp))} · desde el ${esc((S.since || today()).split('-').reverse().join('/'))}</p></div></div>
    <div class="grid2">
      <div class="kpi" style="color:var(--orange)">${ic('flame')}<div><b>${streakAlive() ? S.streak : 0}</b><span>días de racha</span></div></div>
      <div class="kpi" style="color:var(--blue)">${ic('zap')}<div><b>${S.xp}</b><span>XP en total</span></div></div>
      <div class="kpi" style="color:var(--green)">${ic('graduation-cap')}<div><b>${ls.length} / ${Object.keys(LESSON).length}</b><span>lecciones</span></div></div>
      <div class="kpi" style="color:var(--purple)">${ic('book-open')}<div><b>${words}</b><span>palabras</span></div></div>
    </div>
    <div class="card"><h3>Esta semana</h3><p>Récord de racha: ${S.best} día${S.best === 1 ? '' : 's'}</p>
      <div class="week">${days.map(d => `<div class="d ${d.k === today() ? 'today' : ''}"><div class="bar ${d.xp >= S.goal ? 'ok' : ''}" style="height:${Math.max(6, 100 * d.xp / max)}%"></div><span>${d.l}</span></div>`).join('')}</div></div>
    <div class="card"><h3>Meta diaria</h3><p style="margin-bottom:10px">XP por día</p><div class="chips">${[10, 20, 30, 50].map(g => `<button class="chip ${S.goal === g ? 'on' : ''}" data-goal="${g}">${g} XP · ${{ 10: 'Tranqui', 20: 'Normal', 30: 'En serio', 50: 'Intensa' }[g]}</button>`).join('')}</div></div>
    <div class="card"><h3>Mi progreso</h3><p style="margin-bottom:12px">Tu avance se guarda solo en este teléfono. Hacé una copia de vez en cuando.</p>
      <div class="cheat-row"><button class="btn primary" id="m-save">${ic('download')} Guardar</button><button class="btn" id="m-load">${ic('upload')} Restaurar</button></div>
      <button class="btn ghost wide" id="m-cheat" style="margin-top:6px">${ic('wand-sparkles')} Trucos</button></div>
    <div class="card"><h3>Ajustes</h3>
      ${sw('sound', 'Efectos de sonido', 'Los sonidos de acierto y error')}
      ${sw('autoplay', 'Audio automático', 'Escuchar cada frase al aparecer')}
      ${sw('speak', 'Ejercicios para hablar', Bridge && safeCanListen() ? 'Usa el micrófono del teléfono' : 'No disponible en este teléfono')}
      ${sw('hearts', 'Vidas', 'Perdés una vida con cada error en las lecciones')}
      ${sw('haptic', 'Vibración', 'Un toque al acertar o fallar')}
      ${sw('unlockAll', 'Desbloquear todo el camino', 'Para saltar a cualquier lección')}
      <div class="set"><div><b>Apariencia</b><span>Claro, oscuro o como el teléfono</span></div><div class="chips">${[['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, t]) => `<button class="chip ${(S.set.theme || 'auto') === k ? 'on' : ''}" data-theme-set="${k}">${t}</button>`).join('')}</div></div>
    </div>
    <button class="btn ghost wide" id="m-reset" style="color:var(--red)">Borrar mi progreso</button>
    <p class="foot-note">Petit à petit, l'oiseau fait son nid.<br>Hecho con cariño para ${NAME}.</p>`;
  hydratePiaf(el);
  $$('[data-set]', el).forEach(b => b.onclick = () => { S.set[b.dataset.set] = !S.set[b.dataset.set]; save(); b.classList.toggle('on'); sfx.tap(); updateTop(); });
  $$('[data-goal]', el).forEach(b => b.onclick = () => { S.goal = +b.dataset.goal; save(); renderMe(); updateTop(); });
  $$('[data-theme-set]', el).forEach(b => b.onclick = () => { S.set.theme = b.dataset.themeSet; save(); applyTheme(); renderMe(); });
  $('#m-save').onclick = openBackup; $('#m-load').onclick = openRestore; $('#m-cheat').onclick = openCheats;
  $('#m-reset').onclick = async () => { if (await ask('¿Borrar todo tu progreso? No se puede deshacer.', 'Borrar')) { const keep = S.set; S = normalize({}); S.onboarded = true; S.set = keep; S.since = today(); save(); goHome(); setTab('learn'); } };
}


/* ============ lot 3 : tracé du chemin, compteur animé, révision espacée, thème ============ */
function drawTrails(root) {
  $$('.path', root).forEach(p => {
    const W = p.clientWidth, ns = $$('.node', p);
    if (!W || ns.length < 2) return;
    const pts = ns.map(n => { const m = /translateX\((-?\d+)px\)/.exec(n.style.transform); return [W / 2 + (m ? +m[1] : 0), n.offsetTop + 30]; });
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], my = (y0 + y1) / 2; d += ` C${x0} ${my} ${x1} ${my} ${x1} ${y1}`; }
    const H = p.scrollHeight;
    p.insertAdjacentHTML('afterbegin', `<svg class="trail" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}"/></svg>`);
  });
}
function countUp(el, to, ms = 700) {
  if (!el) return;
  const t0 = performance.now();
  const tick = now => { const k = Math.min(1, (now - t0) / ms); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
  el.textContent = 0; requestAnimationFrame(tick);
  setTimeout(() => { el.textContent = to; }, ms + 120); // filet si l'écran est en arrière-plan
}

/* Révision espacée : chaque mot revient au bon moment (1, 2, 4, 7, 15, 30 jours) */
const SRS_INT = [0, 1, 2, 4, 7, 15, 30];
function srsUpdate(ref, ok) {
  if (!ref || ref[0] !== 'v') return;
  S.srs = S.srs || {};
  const e = S.srs[ref[2]] || { b: 0 };
  e.b = ok ? Math.min(6, e.b + 1) : 1; e.l = ref[1]; e.due = dateShift(ok ? SRS_INT[e.b] : 0);
  S.srs[ref[2]] = e;
}
function srsDue() {
  const t = today();
  return Object.entries(S.srs || {}).filter(([k, e]) => e.due <= t && LESSON[e.l] && LESSON[e.l].vocab.some(v => v.fr === k)).sort((a, b) => (a[1].due < b[1].due ? -1 : 1));
}
function buildSrs() {
  const all = pool(doneLessons().length ? doneLessons() : [UNITS[0].lessons[0]]).vocab, withArt = all.filter(x => x.art);
  return srsDue().slice(0, 14).map(([k, e]) => {
    const v = findRef(['v', e.l, k]); if (!v) return null;
    const own = pool([LESSON[e.l]]).vocab, vs = own.length >= 4 ? own : all, r = Math.random();
    return (v.art && r < .3 && exPickImg(v, withArt)) || (r < .55 ? exHear(v, vs) : r < .8 ? exPick(v, vs) : exPickFr(v, vs));
  }).filter(Boolean);
}

/* Thème clair / sombre / automatique */
function applyTheme() {
  const pref = S.set.theme || 'auto';
  const dark = pref === 'dark' || (pref === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#10141C' : '#FFF8EE';
}
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch { }

const UNIT_ART = ['audio-lines', 'hand', 'coffee', 'bike', 'camera', 'messages-square', 'stethoscope'];

/* ============ niveaux d'XP ============ */
const LEVEL_NAMES = ['Débutante', 'Curieuse', 'Voyageuse', 'Bavarde', 'Gourmande', 'Parisienne', 'Aventurière', 'Experte', 'Brillante', 'Francophone'];
const xpFor = L => 40 * L * (L - 1); // XP cumulés pour atteindre le niveau L
function levelOf(xp) { let L = 1; while (xp >= xpFor(L + 1)) L++; return L; }
const levelName = L => LEVEL_NAMES[Math.min(L, LEVEL_NAMES.length) - 1];
function levelInfo() { const L = levelOf(S.xp), a = xpFor(L), b = xpFor(L + 1); return { L, name: levelName(L), pct: Math.round(100 * (S.xp - a) / (b - a)), left: b - S.xp }; }
const lvlOf = id => (S.nodes[id] && S.nodes[id].lvl) || 0;

/* ============ sauvegarde par code + trucos ============ */
const b64e = s => btoa(unescape(encodeURIComponent(s)));
const b64d = s => decodeURIComponent(escape(atob(s)));
const backupCode = () => 'PAP1.' + b64e(JSON.stringify(S));
function restoreCode(code) {
  code = String(code).replace(/\s+/g, '');
  const i = code.indexOf('PAP1.');
  if (i < 0) throw new Error('code');
  const o = JSON.parse(b64d(code.slice(i + 5)));
  if (!o || typeof o.xp !== 'number' || typeof o.nodes !== 'object') throw new Error('code');
  S = normalize(o); save();
}
function openBackup() {
  const code = backupCode();
  pop(`<span class="npc-art small">${animal('Shelby')}</span><h2>Guardar mi progreso</h2>
    <p>Este es tu código. Mandátelo por WhatsApp o guardalo en tus notas: sirve para recuperar todo, también en otro teléfono.</p>
    <textarea class="code" id="bk-code" readonly>${code}</textarea>
    <button class="btn primary wide" id="bk-copy">${ic('copy')} Copiar el código</button>
    ${navigator.share ? `<button class="btn wide" id="bk-share">${ic('share-2')} Compartir</button>` : ''}
    <button class="btn ghost wide" data-close>Cerrar</button>`, box => {
    const ta = $('#bk-code', box);
    $('#bk-copy', box).onclick = async () => {
      try { await navigator.clipboard.writeText(code); } catch { ta.focus(); ta.select(); try { document.execCommand('copy'); } catch { } }
      toast('Código copiado');
    };
    const sh = $('#bk-share', box);
    if (sh) sh.onclick = () => navigator.share({ title: 'Petit à petit · mi progreso', text: code }).catch(() => { });
  });
}
function openRestore() {
  pop(`<span class="npc-art small">${animal('Jacques')}</span><h2>Restaurar mi progreso</h2>
    <p>Pegá acá el código que guardaste. Va a reemplazar el progreso de este teléfono.</p>
    <textarea class="code" id="rs-code" placeholder="PAP1...." autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
    <button class="btn primary wide" id="rs-go">Restaurar</button>
    <button class="btn ghost wide" data-close>Cancelar</button>`, box => {
    $('#rs-go', box).onclick = () => {
      try { restoreCode($('#rs-code', box).value); closePop(); toast('¡Progreso restaurado!'); goHome(); setTab('learn'); }
      catch { toast('Ese código no es válido. Copialo entero.'); }
    };
  });
}
function openCheats() {
  const cur = currentNode(), curI = cur ? Math.max(0, ORDER.indexOf(cur) - 1) : ORDER.length - 1;
  pop(`<span class="piaf" data-piaf="wow"></span><h2>Trucos</h2><p>Para recuperar tu progreso o darte una ayudita. No se lo contamos a nadie.</p>
    <div class="cheat"><label for="ch-upto">Marcar como hecho hasta</label>
      <select id="ch-upto">${ORDER.map((n, i) => `<option value="${i}" ${i === curI ? 'selected' : ''}>U${UNITS.indexOf(n.unit)} · ${esc(n.title)}</option>`).join('')}</select>
      <button class="btn primary" id="ch-mark">Aplicar</button></div>
    <div class="cheat"><label for="ch-streak">Racha (días seguidos)</label>
      <input id="ch-streak" type="number" inputmode="numeric" min="0" max="999" value="${streakAlive() ? S.streak : 0}">
      <button class="btn primary" id="ch-st">Aplicar</button></div>
    <div class="cheat-row"><button class="btn" id="ch-coins">+200 croissants</button><button class="btn" id="ch-xp">+500 XP</button></div>
    <div class="cheat-row"><button class="btn" id="ch-hearts">Recargar vidas</button><button class="btn" id="ch-bak">Recuperar copia</button></div>
    <button class="btn ghost wide" data-close>Cerrar</button>`, box => {
    const after = msg => { save(); updateTop(); toast(msg); };
    $('#ch-mark', box).onclick = () => {
      const upto = +$('#ch-upto', box).value;
      ORDER.forEach((n, i) => {
        if (i > upto) return;
        const o = S.nodes[n.id] || { times: 0, stars: 0 };
        o.times = Math.max(1, o.times || 0); o.stars = Math.max(o.stars || 0, 3); o.lvl = Math.max(o.lvl || 0, 1);
        S.nodes[n.id] = o;
      });
      S.stats.lessons = Math.max(S.stats.lessons, doneLessons().length);
      checkBadges(); after('¡Listo! Progreso marcado.');
    };
    $('#ch-st', box).onclick = () => {
      const v = Math.max(0, Math.min(999, parseInt($('#ch-streak', box).value, 10) || 0));
      S.streak = v; S.best = Math.max(S.best, v); S.last = v > 0 ? today() : null;
      checkBadges(); after(`Racha: ${v} día${v === 1 ? '' : 's'}`);
    };
    $('#ch-coins', box).onclick = () => { S.coins = (S.coins || 0) + 200; after('+200 croissants'); };
    $('#ch-xp', box).onclick = () => { S.xp += 500; checkBadges(); after('+500 XP'); };
    $('#ch-hearts', box).onclick = () => { gainHeart(MAXH); after('Vidas recargadas'); };
    $('#ch-bak', box).onclick = () => {
      try {
        const o = JSON.parse(localStorage.getItem(KEY + '.bak') || 'null');
        if (!o) return toast('No hay ninguna copia guardada.');
        S = normalize(o); closePop(); after('Copia recuperada'); goHome(); setTab('learn');
      } catch { toast('No se pudo leer la copia.'); }
    };
  });
}

/* ============ exercices supplémentaires : écouter un mot, écrire, dictée, nombres ============ */
function exHear(v, vs) { const e = exPick(v, vs); e.t = 'hear'; return e; }
function exType(s) { return { t: 'type', item: s, ans: s.fr, ref: ['s', s.lesson, s.fr] }; }
function exDict(s) { return { t: 'dictation', item: s, ans: s.fr, ref: ['s', s.lesson, s.fr] }; }
function checkTyped(ans, target) {
  const a = norm(ans), t = norm(target);
  if (a === t) return { ok: true, note: '' };
  const flat = x => deacc(x).replace(/['-]/g, ' ').replace(/\s+/g, ' ').trim();
  const da = flat(a), dt = flat(t);
  if (da === dt) return { ok: true, note: 'Ojo con los acentos y los apóstrofos.' };
  // terminaisons muettes (arrivé / arrivée / arrivés) : impossibles à distinguer à l'oreille
  const mute = x => x.split(' ').map(w => (w.length > 3 ? w.replace(/(es|e|s)$/, '') : w)).join(' ');
  if (mute(da) === mute(dt)) return { ok: true, note: 'Suena igual: fijate en las letras mudas del final.' };
  if (lev(da, dt) <= (dt.length > 14 ? 2 : 1)) return { ok: true, note: 'Casi perfecto: mirá bien la ortografía.' };
  return { ok: false, note: '' };
}
function buildLessonHard(l, level) {
  const P = pool([l]), V = P.vocab, SS = P.sent, G = P.gram;
  const vq = shuffle(V), sq = shuffle(SS), gq = shuffle(G);
  const tv = () => vq.length ? vq.shift() : rand(V), ts = () => sq.length ? sq.shift() : rand(SS);
  const ex = [];
  const fill = () => { const g = gq.shift(); if (g) ex.push(exFill(g)); };
  const short = () => { // une phrase courte, plus facile à écrire
    const s = sq.find(x => tokens(x.fr).length <= 6) || SS.slice().sort((a, b) => a.fr.length - b.fr.length)[Math.floor(Math.random() * 3)];
    const k = sq.indexOf(s); if (k >= 0) sq.splice(k, 1);
    return s;
  };
  if (level === 2) {
    ex.push(exHear(tv(), V), exHear(tv(), V)); if (V.length >= 4) ex.push(exMatch(V));
    fill(); ex.push(exBuild(ts(), SS, 'fr'), exListen(ts(), SS), exType(short()));
    fill(); ex.push(exBuild(ts(), SS, 'es')); if (speakOK()) ex.push(exSpeak(ts()));
    ex.push(exListen(ts(), SS), exType(short())); fill(); ex.push(exPickFr(tv(), V));
  } else {
    ex.push(exHear(tv(), V)); fill(); ex.push(exDict(short()), exType(short()));
    fill(); ex.push(exBuild(ts(), SS, 'fr')); if (speakOK()) ex.push(exSpeak(ts()));
    ex.push(exDict(short()), exType(short())); fill(); ex.push(exListen(ts(), SS), exDict(short()));
    if (speakOK()) ex.push(exSpeak(ts())); fill();
  }
  return ex.filter(Boolean);
}
function typeUI(body, ex, head, top, placeholder, numeric) {
  body.innerHTML = head + top + (numeric
    ? `<input class="tinput num" id="tin" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="${placeholder}" autocomplete="off">`
    : `<textarea class="tinput" id="tin" rows="2" placeholder="${placeholder}" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" lang="fr"></textarea>
       <div class="accents">${"é è ê à â ç ù î ô œ '".split(' ').map(c => `<button class="acc" type="button">${c}</button>`).join('')}</div>`);
  wirePlay(body);
  const tin = $('#tin', body);
  tin.oninput = () => setAnswer(tin.value.trim());
  tin.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (!$('#q-check').disabled) $('#q-check').click(); } };
  $$('.acc', body).forEach(b => b.onclick = () => {
    if (Q.locked) return;
    const a = tin.selectionStart ?? tin.value.length, z = tin.selectionEnd ?? a;
    tin.value = tin.value.slice(0, a) + b.textContent + tin.value.slice(z);
    tin.focus(); tin.setSelectionRange(a + 1, a + 1); tin.oninput();
  });
}
RENDER_EX.hear = (body, ex, head) => {
  body.innerHTML = head + `<h2 class="qtitle">¿Qué escuchás?</h2><div class="big-say"><span class="piaf listener" data-piaf="happy" data-prop="phones"></span><button class="say" data-play="${ex.item.au}">${ic('volume-2')}</button><button class="say slow" data-play="${ex.item.au}" data-slow="1" aria-label="Más lento">${ic('snail')}</button></div>` +
    `<div class="options">${ex.opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${i + 1}</span>${esc(o)}</button>`).join('')}</div>`;
  wirePlay(body);
  $$('.opt', body).forEach(b => b.onclick = () => { if (Q.locked) return; sfx.tap(); $$('.opt', body).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); setAnswer(ex.opts[b.dataset.i]); });
  setTimeout(() => play(ex.item.au), 300);
};
RENDER_EX.type = (body, ex, head) => typeUI(body, ex, head, `<h2 class="qtitle">Escribí en francés</h2>` + promptBubble(ex.item.es, null, '', 'pencil'), 'Escribí acá…');
RENDER_EX.dictation = (body, ex, head) => {
  typeUI(body, ex, head, `<h2 class="qtitle">Escribí lo que escuchás</h2><div class="big-say"><span class="piaf listener" data-piaf="happy" data-prop="phones"></span><button class="say" data-play="${ex.item.au}">${ic('volume-2')}</button><button class="say slow" data-play="${ex.item.au}" data-slow="1" aria-label="Más lento">${ic('snail')}</button></div>`, 'Escribí en francés…');
  setTimeout(() => play(ex.item.au), 300);
};
RENDER_EX.num = (body, ex, head) => {
  typeUI(body, ex, head, `<h2 class="qtitle">¿Qué número escuchás?</h2><div class="big-say"><span class="piaf listener" data-piaf="happy" data-prop="phones"></span><button class="say" data-play="${ex.item.au}">${ic('volume-2')}</button><button class="say slow" data-play="${ex.item.au}" data-slow="1" aria-label="Más lento">${ic('snail')}</button></div>`, '0 – 100', true);
  setTimeout(() => play(ex.item.au), 300);
};
Object.assign(TYPE_LABEL, { hear: ['ear', 'Escuchá'], type: ['keyboard', 'Escribí'], dictation: ['pen-line', 'Dictado'], num: ['hash', 'Números'] });

/* ============ entraîneurs : verbes et nombres ============ */
const TENSE = { present: 'Presente', pc: 'Passé composé', imparfait: 'Imparfait', futur: 'Futur simple' };
const PRON = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];
const subj = (i, form) => i === 0 && /^[aeiouyhéèêâîô]/i.test(form) ? "j'" : PRON[i] + ' ';
function buildVerbs(tense) {
  const vs = shuffle(C.verbs || []), out = [];
  for (let k = 0; k < 12 && vs.length; k++) {
    const v = vs[k % vs.length], forms = v.forms[tense], i = Math.floor(Math.random() * 6), ans = forms[i];
    const others = shuffle([...new Set(forms.filter(f => f !== ans))]).slice(0, 2);
    const opts = shuffle([ans, ...others]);
    const s0 = subj(i, ans), s = s0.charAt(0).toUpperCase() + s0.slice(1);
    out.push({ t: 'fill', item: { q: s + '___', opts, a: opts.indexOf(ans), es: `${v.inf} = ${v.es}`, why: `${v.inf} · ${TENSE[tense]}`, au: v.au[tense][i] },
      opts: opts.map((o, j) => ({ o, i: j })), ans, full: s + ans, hint: `${v.inf} (${v.es}) · ${TENSE[tense]}`, ref: null });
  }
  return out;
}
function frNum(n) {
  const u = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  if (n < 20) return u[n];
  if (n === 100) return 'cent';
  const T = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' }, t = Math.floor(n / 10), r = n % 10;
  if (t <= 6) return r === 0 ? T[t] : r === 1 ? T[t] + ' et un' : T[t] + '-' + u[r];
  if (t === 7) return r === 1 ? 'soixante et onze' : 'soixante-' + u[10 + r];
  if (t === 8) return r === 0 ? 'quatre-vingts' : 'quatre-vingt-' + u[r];
  return 'quatre-vingt-' + u[10 + r];
}
function buildNums() {
  const pick = new Set();
  while (pick.size < 4) pick.add(Math.floor(Math.random() * 21));
  while (pick.size < 10) pick.add(21 + Math.floor(Math.random() * 80));
  return shuffle([...pick]).map(n => ({ t: 'num', item: { au: (C.nums || {})[n], es: `${n} = ${frNum(n)}` }, ans: String(n), ref: null }));
}
function chooseTense() {
  pop(`<span class="piaf" data-piaf="happy"></span><h2>Verbos</h2><p>24 verbos clave. Elegí el tiempo que querés practicar.</p>
    ${Object.entries(TENSE).map(([k, t]) => `<button class="btn wide" data-tense="${k}">${t}</button>`).join('')}
    <button class="btn ghost wide" data-close>Cancelar</button>`, box => {
    $$('[data-tense]', box).forEach(b => b.onclick = () => { closePop(); startQuiz(buildVerbs(b.dataset.tense), { title: 'Verbos · ' + TENSE[b.dataset.tense], xp: 10, practice: 'verbs' }); });
  });
}

/* ============ lectures ============ */
function openStory(st) {
  stopAudio(); D = null;
  const el = $('#dlg');
  el.innerHTML = `<div class="dlg-head"><button class="icon-btn" id="dl-x">${ic('x')}</button><b>${esc(st.title)}</b></div>
    <div class="scene reading"><span class="piaf reader" data-piaf="happy" data-prop="book"></span><span><b>${esc(st.kind || 'Lectura')}</b> · ${esc(st.intro || '')}</span></div>
    <div class="chat story" id="chat">${st.paras.map((p, i) => `<button class="para" data-i="${i}"><span class="t">${esc(p.fr)}</span><span class="es">${esc(p.es)}</span></button>`).join('')}</div>
    <div class="hint">Tocá una frase para escucharla y ver la traducción</div>
    <div class="dlg-foot"><button class="btn" id="st-all">${ic('play')} Escuchar</button><button class="btn purple" id="st-q">Preguntas</button></div>`;
  hydratePiaf(el);
  const paras = $$('.para', el);
  const mark = i => paras.forEach((p, k) => p.classList.toggle('playing', k === i));
  paras.forEach((p, i) => p.onclick = async () => { p.classList.toggle('show-es'); mark(i); await play(st.paras[i].au); p.classList.remove('playing'); });
  $('#st-all', el).onclick = async () => {
    for (let i = 0; i < st.paras.length; i++) {
      if (screen !== 'dlg') return;
      mark(i); paras[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!(await play(st.paras[i].au))) { mark(-1); return; }
    }
    mark(-1);
  };
  $('#dl-x', el).onclick = goHome;
  $('#st-q', el).onclick = () => {
    stopAudio();
    const list = (st.questions || []).map(q => ({ t: 'pick', dq: true, item: { fr: q.q }, opts: shuffle(q.opts), ans: q.opts[q.a], ref: null }));
    startQuiz(list, { node: st.id, title: st.title, xp: 15 });
  };
  show('dlg'); $('#chat').scrollTop = 0;
}

/* ============ bienvenue (premier lancement) ============ */
function welcome() {
  pop(`<span class="piaf party flap" data-piaf="joy"></span><h2>Bonjour, ${NAME} !</h2>
    <p>Soy Piaf. Vamos a aprender francés de a poquito, <i>petit à petit</i>: lecciones cortas, diálogos, lecturas y juegos.</p>
    <p style="color:var(--ink)">¿Cuánto querés practicar por día?</p>
    <div class="chips" style="justify-content:center">${[10, 20, 30, 50].map(g => `<button class="chip ${S.goal === g ? 'on' : ''}" data-goal="${g}">${{ 10: '5 min', 20: '10 min', 30: '15 min', 50: '20 min' }[g]}</button>`).join('')}</div>
    <button class="btn primary wide" data-close>¡Empezar!</button>`, box => {
    $$('[data-goal]', box).forEach(b => b.onclick = () => { S.goal = +b.dataset.goal; $$('[data-goal]', box).forEach(x => x.classList.toggle('on', x === b)); save(); updateTop(); });
  });
  S.onboarded = true; save();
}

const RENDER = { learn: renderLearn, practice: renderPractice, words: renderWords, me: renderMe, quests: renderQuests, shop: renderShop };

/* ============ retour Android ============ */
window.onBackKey = () => {
  if (!$('#pop').hidden) { closePop(); return true; }
  if (!$('#confirm').hidden) { $('#confirm').hidden = true; return true; }
  if (!$('#video').hidden) { closeVideo(); return true; }
  if (screen === 'quiz') { $('#q-close').click(); return true; }
  if (screen !== 'home') { goHome(); return true; }
  if (tab === 'words') { setTab('practice'); return true; }
  if (tab !== 'learn') { setTab('learn'); return true; }
  return false;
};
window.onPauseApp = () => stopAudio();
window.onResumeApp = () => { if (screen === 'home') { updateTop(); RENDER[tab](); } };

/* le quiz de dialogue se termine comme un dialogue */
const baseFinish = finishQuiz;

if (location.hostname === 'localhost') {
  window.__dbg = { Q: () => Q, S: () => S, tokens, bankTokens };
  // aperçu de développement : toujours muet (ni effets, ni voix)
  S.set.sound = false; player.muted = true; player.volume = 0;
}

/* hors ligne (iPhone / navigateur) : le service worker garde l'appli et les audios en cache */
if (!NATIVE && 'serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { });
  navigator.serviceWorker.ready.then(r => setTimeout(() => r.active && r.active.postMessage('precache-audio'), 4000)).catch(() => { });
}

/* ============ démarrage ============ */
if (!S.since) { S.since = today(); save(); }
applyTheme();
const streakMsg = settleStreak();
quests();
if (!S.onboarded) { if (S.xp === 0 && !Object.keys(S.nodes).length) setTimeout(welcome, 400); else { S.onboarded = true; save(); } }
if (streakMsg) setTimeout(() => toast(streakMsg), 900);

/* Série perdue : on propose tout de suite de la récupérer (truco), sans avoir à chercher le bouton. */
function offerStreak() {
  if (!S.lostStreak || screen !== 'home' || !$('#pop').hidden) return;
  const n = S.lostStreak;
  pop(`<span class="npc-art small">${animal('Shelby')}</span><h2>Se cortó tu racha</h2>
    <p>Tenías <b style="color:var(--orange-d)">${n} día${n > 1 ? 's' : ''} seguidos</b> y te perdiste uno. Shelby no llegó a cuidarla… pero podemos hacer un truco.</p>
    <button class="btn primary wide" id="sk-yes">${ic('wand-sparkles')} Recuperar mi racha</button>
    <button class="btn ghost wide" id="sk-no">Empezar de cero</button>`, box => {
    $('#sk-yes', box).onclick = () => {
      // si elle a déjà fait une leçon aujourd'hui, la série reprend avec ce jour en plus
      if (S.last === today()) S.streak = n + Math.max(1, S.streak);
      else { S.streak = n; S.last = dateShift(-1); }
      S.best = Math.max(S.best, S.streak); S.lostStreak = 0;
      save(); closePop(); updateTop(); sfx.win(); haptic('ok');
      if (screen === 'home') RENDER[tab]();
      toast(S.last === today() ? `¡Racha de ${S.streak} días recuperada!` : `¡Racha de ${n} día${n > 1 ? 's' : ''} recuperada! Hacé una lección hoy para seguirla.`);
    };
    $('#sk-no', box).onclick = () => { S.lostStreak = 0; save(); closePop(); };
  });
}
setTimeout(offerStreak, 1200);
// l'appli peut rester ouverte plusieurs jours : on revérifie quand elle revient au premier plan
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const msg = settleStreak();
  if (screen === 'home') { updateTop(); RENDER[tab](); }
  if (msg) toast(msg);
  setTimeout(offerStreak, 600);
});
hydratePiaf();
updateTop();
setTab('learn');
})();
