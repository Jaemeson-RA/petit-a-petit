/* Personnages des dialogues : portraits SVG dessinés à la main (paramétriques).
   window.person(nom, { talking }) -> chaîne SVG. Clignement et bouche animés en CSS. */
(() => {
'use strict';

const DARK = '#2A2230';
const CAST = {
  'Alejandra':    { bg: '#DCE6FF', skin: '#E7B793', hair: '#4E2D1C', style: 'long', eyes: '#5A3A22', outfit: 'tshirt', color: '#FF6B5B', earrings: true, lash: true },
  'Amandine':     { bg: '#FDE4EE', skin: '#F6D3BE', hair: '#B5562B', style: 'bun', eyes: '#3F6B4A', outfit: 'sweater', color: '#12A48B', lash: true, freckles: true },
  'Jaemeson':     { bg: '#FFF0D6', skin: '#F3C9A8', hair: '#D49A3A', style: 'side', eyes: '#3D6FA8', outfit: 'tshirt', color: '#2E5BFF' },
  'Adrien':       { bg: '#E1F5EC', skin: '#8D5A3C', hair: '#1E1A1A', style: 'curly', eyes: '#2A1A12', outfit: 'sweater', color: '#F2B544' },
  'Thibault':     { bg: '#ECE7FF', skin: '#F1C7A5', hair: '#3B2A20', style: 'short', eyes: '#3B2A20', outfit: 'shirt', color: '#5B7083', beard: '#3B2A20', glasses: true },
  'Luca':         { bg: '#FFE4D6', skin: '#D9A066', hair: '#2A1C14', style: 'side', eyes: '#3B2A20', outfit: 'tshirt', color: '#21A35B' },
  'Maxime':       { bg: '#E4EAFF', skin: '#F3C9A8', hair: '#8A5A2B', style: 'curly', eyes: '#3D6FA8', outfit: 'shirt', color: '#E8508A' },
  'Margaux':      { bg: '#FFF0D6', skin: '#F6D3BE', hair: '#E0B052', style: 'long', eyes: '#3D6FA8', outfit: 'sweater', color: '#7B5CFF', lash: true },
  'Chloé':        { bg: '#E1F5EC', skin: '#A9744F', hair: '#1E1A1A', style: 'bun', eyes: '#2A1A12', outfit: 'tshirt', color: '#FF8A1C', lash: true, earrings: true },
  'Manon':        { bg: '#ECE7FF', skin: '#F1C7A5', hair: '#2A1C14', style: 'long', eyes: '#3F6B4A', outfit: 'shirt', color: '#1BA3E0', lash: true, glasses: true },
  'Le serveur':   { bg: '#F6EEDF', skin: '#EDC2A0', hair: '#1F1B1B', style: 'slick', eyes: '#2A1A12', outfit: 'waiter', color: '#FFFFFF', mustache: '#1F1B1B' },
  'Le boulanger': { bg: '#FFE9C7', skin: '#F0C29C', hair: '#7A4A2A', style: 'short', eyes: '#4A3020', outfit: 'apron', color: '#A9C8F0', mustache: '#7A4A2A', hat: 'toque' },
  'Le passant':   { bg: '#E4EAFF', skin: '#E9BC98', hair: '#B8B4AE', style: 'sides', eyes: '#4A3020', outfit: 'coat', color: '#B88E62', beard: '#C9C5BF', hat: 'cap', hatColor: '#6B4E3A' },
  'Le médecin':   { bg: '#DDF5E7', skin: '#C98E66', hair: '#9A9590', style: 'sides', eyes: '#2A1A12', outfit: 'labcoat', color: '#7FA8E8', glasses: true, steth: true },
  'Le pharmacien':{ bg: '#DDF5E7', skin: '#F5CFB3', hair: '#8E8A86', style: 'short', eyes: '#3D5A80', outfit: 'labcoat', color: '#21A35B', glasses: true, cross: true },
};
const FALLBACK = {
  f: [{ skin: '#F1C7A5', hair: '#6B3A22', style: 'long', outfit: 'sweater', color: '#E8508A', lash: true }, { skin: '#B07A55', hair: '#1E1A1A', style: 'bun', outfit: 'tshirt', color: '#7B5CFF', lash: true }],
  m: [{ skin: '#E9BC98', hair: '#3B2A20', style: 'short', outfit: 'tshirt', color: '#1BA3E0' }, { skin: '#8D5A3C', hair: '#1E1A1A', style: 'curly', outfit: 'shirt', color: '#FF8A1C' }],
};
const BGS = ['#DCE6FF', '#FDE4EE', '#FFF0D6', '#E1F5EC', '#ECE7FF'];

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(c * k)));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function look(name, gender) {
  if (CAST[name]) return CAST[name];
  const g = gender === 'm' ? 'm' : 'f';
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Object.assign({ eyes: '#3B2A20', bg: BGS[h % BGS.length] }, FALLBACK[g][h % FALLBACK[g].length]);
}

function body(p) {
  const c = p.color, d = shade(c, .82);
  const torso = `<path d="M14 104C14 80 30 71 50 71s36 9 36 33z" fill="${c}"/>`;
  switch (p.outfit) {
    case 'sweater':
      return torso + `<path d="M40 72q10 9 20 0" fill="none" stroke="${d}" stroke-width="4" stroke-linecap="round"/><path d="M26 90v14M74 90v14" stroke="${d}" stroke-width="2" opacity=".6"/>`;
    case 'shirt':
      return torso + `<path d="M42 72l8 10 8-10" fill="#fff"/><path d="M42 72l-4 6 8 5zM58 72l4 6-8 5z" fill="${shade(c, 1.15)}"/><path d="M50 82v22" stroke="${d}" stroke-width="1.6"/><circle cx="50" cy="88" r="1.2" fill="${d}"/><circle cx="50" cy="96" r="1.2" fill="${d}"/>`;
    case 'waiter':
      return `<path d="M14 104C14 80 30 71 50 71s36 9 36 33z" fill="#fff"/><path d="M14 104C14 82 26 74 40 72l6 32zM86 104C86 82 74 74 60 72l-6 32z" fill="#23232B"/><path d="M43 76l7 3 7-3-2 6-5-2-5 2z" fill="#23232B"/><circle cx="50" cy="79" r="1.8" fill="#3A3A44"/>`;
    case 'apron':
      return torso + `<path d="M33 84h34v20H33z" fill="#FFFDF8"/><path d="M33 84q17-6 34 0" fill="none" stroke="#E6DCCB" stroke-width="2"/><path d="M38 84l-4-11M62 84l4-11" stroke="#FFFDF8" stroke-width="3"/><path d="M45 72q5 4 10 0" fill="none" stroke="${d}" stroke-width="3"/>`;
    case 'coat':
      return torso + `<path d="M40 71l10 14 10-14 2 33H38z" fill="#F4EEE4"/><path d="M40 71l-6 9 9 4 7-0zM60 71l6 9-9 4-7 0z" fill="${shade(c, .9)}"/><path d="M38 72q12 7 24 0" fill="none" stroke="#8B2E2E" stroke-width="5" stroke-linecap="round"/>`;
    case 'labcoat':
      return `<path d="M14 104C14 80 30 71 50 71s36 9 36 33z" fill="#FBFBFD"/><path d="M42 71l8 12 8-12 1 33H41z" fill="${c}"/><path d="M42 71l-7 12 11 21M58 71l7 12-11 21" fill="none" stroke="#D9DCE6" stroke-width="2"/>` +
        (p.steth ? `<path d="M38 74q-3 18 9 20M62 74q3 16-5 22" fill="none" stroke="#3B4252" stroke-width="2.2" stroke-linecap="round"/><circle cx="57" cy="97" r="3.4" fill="#9AA3B5" stroke="#3B4252" stroke-width="1.6"/>` : '') +
        (p.cross ? `<rect x="64" y="84" width="10" height="10" rx="2" fill="#fff" stroke="#D9DCE6"/><path d="M69 86v6M66 89h6" stroke="#21A35B" stroke-width="2.4" stroke-linecap="round"/>` : '');
    default: // tshirt
      return torso + `<path d="M41 72q9 7 18 0" fill="none" stroke="${d}" stroke-width="3" stroke-linecap="round"/>`;
  }
}

function hairBack(p) {
  if (p.style === 'long') return `<path d="M29 50C26 27 38 17 50 17s25 9 21 33l3 26c-8 6-40 6-48 0z" fill="${p.hair}"/>`;
  if (p.style === 'bun') return `<circle cx="50" cy="16" r="8.5" fill="${p.hair}"/><path d="M31 50C28 30 38 21 50 21s22 9 19 29" fill="${p.hair}"/>`;
  return '';
}

function hairFront(p) {
  const h = p.hair, hl = shade(h, 1.35);
  switch (p.style) {
    case 'long':
    case 'bun':
      return `<path d="M32 45C31 30 40 23 50 23c11 0 19 8 18 22-4-8-10-13-19-13-3 5-10 9-17 13z" fill="${h}"/><path d="M46 26q8-1 14 4" stroke="${hl}" stroke-width="1.6" fill="none" opacity=".6" stroke-linecap="round"/>`;
    case 'side':
      return `<path d="M32 46C30 28 43 21 53 23c11 1 18 9 15 23-2-7-6-11-11-12-5 5-15 5-25 12z" fill="${h}"/><path d="M55 25q7 2 10 8" stroke="${hl}" stroke-width="1.6" fill="none" opacity=".7" stroke-linecap="round"/>`;
    case 'curly':
      return [[35, 36, 6], [41, 29, 7], [50, 26, 7.5], [59, 29, 7], [65, 36, 6], [33, 44, 4.5], [67, 44, 4.5], [45, 31, 5], [55, 31, 5]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${h}"/>`).join('');
    case 'slick':
      return `<path d="M33 44C32 28 41 22 51 22c11 0 18 7 16 22-2-6-7-10-14-10-7 0-15 3-20 10z" fill="${h}"/><path d="M40 28q10-4 20 1" stroke="${hl}" stroke-width="1.4" fill="none" opacity=".7"/>`;
    case 'sides':
      return `<path d="M33 50c-2-9 0-15 4-18l2 14zM67 50c2-9 0-15-4-18l-2 14z" fill="${h}"/><path d="M38 31q12-6 24 0" stroke="${h}" stroke-width="2" fill="none" opacity=".7"/>`;
    default: // short
      return `<path d="M33 45C31 29 41 22 51 22c11 0 18 8 16 23-3-7-9-11-17-11s-14 4-17 11z" fill="${h}"/>`;
  }
}

function hat(p) {
  if (p.hat === 'toque') return `<path d="M34 35l2-12c-7-4-3-15 6-12 3-7 13-7 16 0 9-3 13 8 6 12l2 12z" fill="#FFFFFF" stroke="#E6DCCB" stroke-width="1.2"/><rect x="34" y="31" width="32" height="6" rx="2" fill="#F3EDE2"/>`;
  if (p.hat === 'cap') { const c = p.hatColor || '#5A4A3A'; return `<path d="M32 39C32 27 41 22 51 22c11 0 19 6 18 17z" fill="${c}"/><path d="M58 37c11-2 19 0 18 4-7 2-13 1-20-1z" fill="${shade(c, .75)}"/><path d="M40 27q10-3 20 0" stroke="${shade(c, 1.3)}" stroke-width="1.4" fill="none"/>`; }
  return '';
}

function face(p) {
  const s = p.skin, sd = shade(s, .88);
  let f = `<rect x="44" y="58" width="12" height="15" rx="5" fill="${sd}"/>` +
    `<ellipse cx="32.5" cy="48" rx="3.6" ry="4.6" fill="${sd}"/><ellipse cx="67.5" cy="48" rx="3.6" ry="4.6" fill="${sd}"/>` +
    `<ellipse cx="50" cy="45" rx="17.5" ry="19.5" fill="${s}"/>`;
  if (p.earrings) f += `<circle cx="32" cy="54" r="1.8" fill="#F2B544"/><circle cx="68" cy="54" r="1.8" fill="#F2B544"/>`;
  if (p.beard) f += `<path d="M33 46c0 16 9 23 17 23s17-7 17-23c-3 9-8 12-17 12s-14-3-17-12z" fill="${p.beard}"/>`;
  // joues, sourcils, yeux (groupe qui cligne), nez, bouche
  f += `<circle cx="39" cy="53" r="3.6" fill="#FF8FA3" opacity=".35"/><circle cx="61" cy="53" r="3.6" fill="#FF8FA3" opacity=".35"/>`;
  if (p.freckles) f += [[40, 50], [42, 52], [38, 52], [58, 50], [60, 52], [62, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".7" fill="#B5562B" opacity=".6"/>`).join('');
  f += `<path d="M39 39.5q4-2.5 8 0M53 39.5q4-2.5 8 0" stroke="${shade(p.hair, .9)}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  f += `<g class="pp-eyes"><ellipse cx="43" cy="46" rx="2.6" ry="3.1" fill="${DARK}"/><ellipse cx="57" cy="46" rx="2.6" ry="3.1" fill="${DARK}"/>` +
    `<circle cx="43.9" cy="45" r=".9" fill="#fff"/><circle cx="57.9" cy="45" r=".9" fill="#fff"/>` +
    (p.lash ? `<path d="M40 44.5l-1.6-1.4M60 44.5l1.6-1.4" stroke="${DARK}" stroke-width="1.1" stroke-linecap="round"/>` : '') + `</g>`;
  f += `<path d="M50 48.5q-1.6 3.6 1 4.2" stroke="${shade(s, .7)}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  if (p.mustache) f += `<path d="M42.5 56.5c3-3.2 6-2.6 7.5-1.3 1.5-1.3 4.5-1.9 7.5 1.3-3 1.3-5.5 1-7.5-.2-2 1.2-4.5 1.5-7.5.2z" fill="${p.mustache}"/>`;
  f += `<path class="pp-smile" d="M45.5 57.5q4.5 3.6 9 0" stroke="#7A3B3B" stroke-width="1.7" fill="none" stroke-linecap="round"/>` +
    `<ellipse class="pp-open" cx="50" cy="58.4" rx="3.2" ry="2.5" fill="#7A3B3B"/>`;
  if (p.glasses) f += `<g fill="rgba(255,255,255,.18)" stroke="#2F3542" stroke-width="1.5"><rect x="37" y="41.5" width="11.5" height="9" rx="3.5"/><rect x="51.5" y="41.5" width="11.5" height="9" rx="3.5"/></g><path d="M48.5 45h3" stroke="#2F3542" stroke-width="1.5"/>`;
  return f;
}

window.person = (name, gender, opts = {}) => {
  const p = look(name, gender);
  const id = 'pp' + Math.random().toString(36).slice(2, 8);
  return `<svg class="person${opts.talking ? ' talking' : ''}" viewBox="0 0 100 100" aria-label="${name}">
    <defs><clipPath id="${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect width="100" height="100" fill="${p.bg}"/>
    ${hairBack(p)}${body(p)}${face(p)}${hairFront(p)}${hat(p)}</g></svg>`;
};
/* Shelby (le chien) et Jacques (le chat) */
window.animal = (name, opts = {}) => {
  const id = 'an' + Math.random().toString(36).slice(2, 8);
  const cls = 'person animal' + (opts.talking ? ' talking' : '');
  const wrap = (bg, inner) => `<svg class="${cls}" viewBox="0 0 100 100" aria-label="${name}"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#${id})"><rect width="100" height="100" fill="${bg}"/>${inner}</g></svg>`;
  if (name === 'Shelby') {
    return wrap('#FFE9C7',
      `<path d="M20 104c0-22 13-32 30-32s30 10 30 32z" fill="#E0A458"/>
       <path d="M36 80h28v7q-14 6-28 0z" fill="#E5484D"/><circle cx="50" cy="90" r="4" fill="#FFC93C" stroke="#D9A21A" stroke-width="1"/>
       <path class="an-earl" d="M30 30c-12 2-17 16-13 30 7 2 13-4 15-14z" fill="#B9783A"/>
       <path class="an-earr" d="M70 30c12 2 17 16 13 30-7 2-13-4-15-14z" fill="#B9783A"/>
       <ellipse cx="50" cy="46" rx="23" ry="24" fill="#E0A458"/>
       <path d="M50 24c-5 6-6 14-4 22h8c2-8 1-16-4-22z" fill="#F7E3C0"/>
       <ellipse cx="50" cy="59" rx="14" ry="11.5" fill="#F7E3C0"/>
       <g class="pp-eyes"><ellipse cx="40.5" cy="43" rx="3.2" ry="3.8" fill="${DARK}"/><ellipse cx="59.5" cy="43" rx="3.2" ry="3.8" fill="${DARK}"/><circle cx="41.6" cy="41.8" r="1.1" fill="#fff"/><circle cx="60.6" cy="41.8" r="1.1" fill="#fff"/></g>
       <path d="M36 36q4-3 8-1M64 36q-4-3-8-1" stroke="#B9783A" stroke-width="1.8" fill="none" stroke-linecap="round"/>
       <ellipse cx="50" cy="54" rx="4.6" ry="3.4" fill="${DARK}"/><path d="M50 57v4" stroke="${DARK}" stroke-width="1.6"/>
       <path class="pp-smile" d="M43 61q3.5 4 7 0q3.5 4 7 0" stroke="${DARK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
       <path class="an-tongue" d="M46.5 63h7v5a3.5 3.5 0 0 1-7 0z" fill="#FF7B93"/>`);
  }
  return wrap('#E4EAFF',
    `<path d="M22 104c0-20 12-30 28-30s28 10 28 30z" fill="#8E97A6"/>
     <path d="M37 80h26v6q-13 5-26 0z" fill="#2E5BFF"/><circle cx="50" cy="88" r="3.4" fill="#FFC93C" stroke="#D9A21A" stroke-width="1"/>
     <path d="M26 44L24 16l20 12zM74 44l2-28-20 12z" fill="#8E97A6"/>
     <path d="M29 36l-1-13 10 6zM71 36l1-13-10 6z" fill="#FFB3C1"/>
     <ellipse cx="50" cy="48" rx="25" ry="22" fill="#8E97A6"/>
     <path d="M44 27l3 9M50 26v10M56 27l-3 9" stroke="#6E7786" stroke-width="2" stroke-linecap="round"/>
     <path d="M50 46c-9 0-17 6-17 14 0 7 8 10 17 10s17-3 17-10c0-8-8-14-17-14z" fill="#FFFFFF"/>
     <g class="pp-eyes"><ellipse cx="39.5" cy="45" rx="4.2" ry="4.6" fill="#7BC96F"/><ellipse cx="60.5" cy="45" rx="4.2" ry="4.6" fill="#7BC96F"/><ellipse cx="39.5" cy="45" rx="1.5" ry="3.8" fill="${DARK}"/><ellipse cx="60.5" cy="45" rx="1.5" ry="3.8" fill="${DARK}"/></g>
     <path d="M47 54h6l-3 3.4z" fill="#FF8FA3"/>
     <path class="pp-smile" d="M44 60q3 3 6-1q3 4 6 1" stroke="${DARK}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
     <ellipse class="pp-open" cx="50" cy="61.5" rx="2.6" ry="2.2" fill="#7A3B3B"/>
     <path d="M30 55l-11-3M30 59l-11 2M70 55l11-3M70 59l11 2" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".9"/>`);
};
window.personColor = (name, gender) => look(name, gender).bg;
})();
