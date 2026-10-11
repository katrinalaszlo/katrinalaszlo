// Procedural watercolor wildflower ornaments → transparent PNGs.
// Usage: node paint.mjs <outDir> [soft|wallpaper]
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] || '.';
mkdirSync(OUT, { recursive: true });

// Palettes: 'soft' is the brief's palette; 'wallpaper' leans toward the
// restaurant's wildflower wallpaper (raspberry, marigold, deep olive).
const PALETTES = {
  soft: {
    blush: '#E8A5B4', blushLt: '#F3CAD3', blushDk: '#D98A9C',
    coral: '#D9694F', coralLt: '#E8917A', coralDk: '#BF5640',
    butter: '#F2C94C', butterLt: '#F7DC8A', butterDk: '#E2AE36',
    white: '#FFFFFF',
    sage: '#7F9472', sageLt: '#A3B396', olive: '#6E8B3D', oliveDk: '#556E2E',
  },
  wallpaper: {
    blush: '#D97890', blushLt: '#EBA9B8', blushDk: '#BE4F6D',
    coral: '#D96A3B', coralLt: '#E8935F', coralDk: '#B9502C',
    butter: '#EDB83A', butterLt: '#F4D27A', butterDk: '#D79A26',
    white: '#FFFFFF',
    sage: '#6A7A4C', sageLt: '#8E9C6B', olive: '#56692E', oliveDk: '#3F4F22',
  },
};
const VARIANT = process.argv[3] || 'soft';
const C = PALETTES[VARIANT];
const SUFFIX = VARIANT === 'soft' ? '' : `-${VARIANT}`;

// ---------- seeded random ----------
let _s = 1;
const seed = (n) => { _s = n >>> 0 || 1; };
const rnd = () => { _s |= 0; _s = (_s + 0x6d2b79f5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();
const jit = (v, f) => v * (1 + rr(-f, f));
const f2 = (n) => Math.round(n * 100) / 100;

let uid = 0;
const id = (p) => `${p}${++uid}`;

// ---------- filters ----------
function defs() {
  const wc = (name, disp, blur, wide, k2, k3, grainF, grainAmt, freq = 0.035) => `
  <filter id="${name}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${disp}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="${blur}" result="soft"/>
    <feGaussianBlur in="d" stdDeviation="${wide}" result="wide"/>
    <feComposite in="soft" in2="wide" operator="arithmetic" k2="${k2}" k3="${k3}" result="edge"/>
    <feTurbulence type="fractalNoise" baseFrequency="${grainF}" numOctaves="2" seed="3" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${-grainAmt} 0 0 0 ${0.5 + grainAmt * 0.95}" result="ga"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="11" result="b"/>
    <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.9 0 0 0 1.25" result="ba"/>
    <feComposite in="edge" in2="ga" operator="in" result="e2"/>
    <feComposite in="e2" in2="ba" operator="in"/>
  </filter>`;
  return `<defs>
  ${wc('wcPetal', 6, 0.55, 3.2, 1.7, -0.95, 0.85, 0.7)}
  ${wc('wcSmall', 3, 0.4, 1.6, 1.65, -0.85, 0.9, 0.5, 0.06)}
  ${wc('wcLeaf', 4, 0.5, 2.6, 1.75, -0.9, 0.8, 0.6)}
  ${wc('wcStem', 1.6, 0.35, 1.2, 1.5, -0.55, 0.9, 0.5, 0.05)}
  <filter id="wcWhite" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.5"/>
  </filter>
  </defs>`;
}

// ---------- geometry ----------
const rad = (d) => (d * Math.PI) / 180;
function bez(p, t) {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}
function bezTan(p, t) {
  const a = bez(p, Math.max(0, t - 0.01)), b = bez(p, Math.min(1, t + 0.01));
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
}
// Tapered ribbon along a cubic bezier.
function ribbon(p, w0, w1, n = 48) {
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = bez(p, t), a = rad(bezTan(p, t));
    const w = (w0 + (w1 - w0) * Math.pow(t, 0.8)) / 2;
    L.push([x - Math.sin(a) * w, y + Math.cos(a) * w]);
    R.push([x + Math.sin(a) * w, y - Math.cos(a) * w]);
  }
  const pts = L.concat(R.reverse());
  return 'M' + pts.map(([x, y]) => `${f2(x)} ${f2(y)}`).join(' L') + 'Z';
}

// ---------- painters ----------
const out = [];
const put = (s) => out.push(s);

function stem(p, w0, w1, col = C.sage, op = 0.9) {
  put(`<path d="${ribbon(p, w0, w1)}" fill="${col}" fill-opacity="${op}" filter="url(#wcStem)"/>`);
}
function curve(x, y, ang, len, bend, w0, w1, col, op) {
  const a = rad(ang), b = rad(ang + bend);
  const p = [[x, y], [x + Math.cos(a) * len * 0.35, y + Math.sin(a) * len * 0.35],
    [x + Math.cos(b) * len * 0.7, y + Math.sin(b) * len * 0.7], [x + Math.cos(b) * len, y + Math.sin(b) * len]];
  stem(p, w0, w1, col, op);
  return p[3];
}
function leaf(x, y, ang, len, wid, col) {
  const g = id('lg');
  const L = jit(len, 0.1), W = jit(wid, 0.15), k = rr(-0.15, 0.15);
  put(`<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${col}" stop-opacity="0.95"/><stop offset="1" stop-color="${col === C.olive ? C.sage : C.sageLt}" stop-opacity="0.85"/></linearGradient>`);
  put(`<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(ang)})"><path d="M0 0 C${f2(L * 0.3)} ${f2(-W * (0.6 + k))} ${f2(L * 0.72)} ${f2(-W * 0.45)} ${f2(L)} ${f2(W * k * 0.6)} C${f2(L * 0.7)} ${f2(W * (0.4 - k))} ${f2(L * 0.3)} ${f2(W * 0.55)} 0 0Z" fill="url(#${g})" filter="url(#wcLeaf)"/></g>`);
}
// Feathery cosmos foliage.
function feather(x, y, ang, len, col = C.sage) {
  const tip = curve(x, y, ang, len, rr(-18, 18), 1.6, 0.4, col, 0.85);
  const pairs = 3 + Math.floor(rnd() * 2);
  for (let i = 1; i <= pairs; i++) {
    const t = i / (pairs + 1);
    const px = x + (tip[0] - x) * t, py = y + (tip[1] - y) * t;
    const l = len * (0.5 - t * 0.28);
    curve(px, py, ang - rr(32, 48), l, rr(-15, 5), 1.1, 0.3, col, 0.8);
    curve(px, py, ang + rr(32, 48), l, rr(-5, 15), 1.1, 0.3, col, 0.8);
  }
}

function petals(n, r, inner, shape, fill, filt, rot0 = 0, op = 0.92, extra = '') {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = rot0 + (360 / n) * i + rr(-9, 9);
    const L = jit(r, 0.08) - inner;
    s += `<g transform="rotate(${f2(a)}) translate(${f2(inner)} 0)"><path d="${shape(L)}" fill="${fill}" fill-opacity="${op}" filter="url(#${filt})" ${extra}/></g>`;
  }
  return s;
}
// Same petals painted twice: a flat body wash (hides stems behind), then the
// edge-darkened pigment layer on top. RNG is rewound so shapes match.
function washed(n, r, inner, shape, bodyFill, fill, filt, rot0, op, bodyOp = 0.6) {
  const saved = _s;
  const body = petals(n, r, inner, shape, bodyFill, 'wcWhite', rot0, bodyOp);
  _s = saved;
  return body + petals(n, r, inner, shape, fill, filt, rot0, op);
}
const grp = (x, y, rot, sq, body) => `<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(rot)}) scale(1 ${f2(sq)})">${body}</g>`;

function dots(n, r0, r1, size, col, op = 0.9) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (r1 - r0) + r0;
    s += `<circle cx="${f2(Math.cos(a) * d)}" cy="${f2(Math.sin(a) * d)}" r="${f2(jit(size, 0.4))}" fill="${col}" fill-opacity="${op}" filter="url(#wcSmall)"/>`;
  }
  return s;
}

function cosmos(x, y, r, rot = 0, sq = 1) {
  const W = r * 0.78;
  const shape = (L) => {
    const w = jit(W, 0.1), n = rr(0.9, 0.95);
    return `M0 0 C${f2(L * 0.35)} ${f2(-w * 0.22)} ${f2(L * 0.68)} ${f2(-w * 0.55)} ${f2(L * 0.97)} ${f2(-w * 0.48)} L${f2(L * n)} ${f2(-w * 0.3)} L${f2(L)} ${f2(-w * 0.14)} L${f2(L * (n + 0.02))} ${f2(w * 0.02)} L${f2(L * 0.995)} ${f2(w * 0.18)} L${f2(L * n)} ${f2(w * 0.32)} L${f2(L * 0.96)} ${f2(w * 0.5)} C${f2(L * 0.68)} ${f2(w * 0.56)} ${f2(L * 0.35)} ${f2(w * 0.22)} 0 0Z`;
  };
  const gp = id('lp');
  put(`<linearGradient id="${gp}" x1="0" y1="0" x2="${f2(r)}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.blushDk}"/><stop offset="0.4" stop-color="${C.blush}"/><stop offset="1" stop-color="${C.blushLt}"/></linearGradient>`);
  let b = washed(8, r, r * 0.1, shape, C.blushLt, `url(#${gp})`, 'wcPetal', rr(0, 45), 0.85, 0.55);
  b += `<circle r="${f2(r * 0.22)}" fill="${C.butter}" fill-opacity="0.95" filter="url(#wcSmall)"/>`;
  b += `<circle r="${f2(r * 0.12)}" fill="${C.butterDk}" fill-opacity="0.8" filter="url(#wcSmall)"/>`;
  b += dots(Math.round(r * 0.45), r * 0.12, r * 0.24, Math.max(0.9, r * 0.025), C.olive, 0.75);
  put(grp(x, y, rot, sq, b));
}

function poppy(x, y, r, rot = 0, sq = 1) {
  const gp = id('lp');
  put(`<linearGradient id="${gp}" x1="0" y1="0" x2="${f2(r)}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.coralDk}"/><stop offset="0.45" stop-color="${C.coral}"/><stop offset="1" stop-color="${C.coralLt}"/></linearGradient>`);
  const shape = (L) => {
    const w = jit(L * 1.25, 0.08), k = rr(-0.08, 0.08);
    return `M0 0 C${f2(L * 0.15)} ${f2(-w * 0.55)} ${f2(L * 0.8)} ${f2(-w * (0.72 + k))} ${f2(L * 0.98)} ${f2(-w * 0.15)} C${f2(L * 1.04)} ${f2(w * 0.12)} ${f2(L * 0.95)} ${f2(w * 0.2)} ${f2(L * 0.97)} ${f2(w * 0.28)} C${f2(L * 0.75)} ${f2(w * (0.72 - k))} ${f2(L * 0.15)} ${f2(w * 0.55)} 0 0Z`;
  };
  const r0 = rr(0, 90);
  let b = washed(2, r * 1.02, r * 0.05, shape, C.coralLt, `url(#${gp})`, 'wcPetal', r0 + 45, 0.72, 0.42);
  b += washed(3, r * 0.9, r * 0.05, shape, C.coralLt, `url(#${gp})`, 'wcPetal', r0 + 10, 0.66, 0.42);
  // dark heart + seed pod
  b += `<circle r="${f2(r * 0.24)}" fill="${C.oliveDk}" fill-opacity="0.55" filter="url(#wcPetal)"/>`;
  b += dots(Math.round(r * 0.5), r * 0.16, r * 0.3, Math.max(1, r * 0.03), C.oliveDk, 0.85);
  b += `<circle r="${f2(r * 0.13)}" fill="${C.sageLt}" fill-opacity="0.95" filter="url(#wcSmall)"/>`;
  for (let i = 0; i < 7; i++) { const a = rad(i * 51.4); b += `<path d="M0 0 L${f2(Math.cos(a) * r * 0.12)} ${f2(Math.sin(a) * r * 0.12)}" stroke="${C.olive}" stroke-opacity="0.7" stroke-width="${f2(Math.max(0.8, r * 0.018))}" filter="url(#wcSmall)"/>`; }
  put(grp(x, y, rot, sq, b));
}

function buttercup(x, y, r, rot = 0, sq = 1) {
  const gp = id('lp');
  put(`<linearGradient id="${gp}" x1="0" y1="0" x2="${f2(r)}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.butterDk}"/><stop offset="0.5" stop-color="${C.butter}"/><stop offset="1" stop-color="${C.butterLt}"/></linearGradient>`);
  const shape = (L) => { const w = L * 1.05; return `M0 0 C${f2(L * 0.1)} ${f2(-w * 0.6)} ${f2(L * 1.05)} ${f2(-w * 0.62)} ${f2(L)} 0 C${f2(L * 1.05)} ${f2(w * 0.62)} ${f2(L * 0.1)} ${f2(w * 0.6)} 0 0Z`; };
  let b = petals(5, r, r * 0.08, shape, `url(#${gp})`, r < 16 ? 'wcSmall' : 'wcPetal', rr(0, 72), 0.92);
  b += dots(Math.round(r * 0.6) + 3, 0, r * 0.25, Math.max(0.8, r * 0.05), C.olive, 0.7);
  put(grp(x, y, rot, sq, b));
}

function daisy(x, y, r, rot = 0, sq = 1) {
  const n = 14 + Math.floor(rnd() * 4);
  const shape = (L) => { const w = jit(L * 0.26, 0.15); return `M0 0 C${f2(L * 0.2)} ${f2(-w * 0.6)} ${f2(L * 0.92)} ${f2(-w * 0.55)} ${f2(L)} 0 C${f2(L * 0.92)} ${f2(w * 0.55)} ${f2(L * 0.2)} ${f2(w * 0.6)} 0 0Z`; };
  const r0 = rr(0, 30);
  const saved = _s;
  // sage shadow under each petal, then reserved-white petal on top
  let b = `<g transform="translate(0.8 1.2)">${petals(n, r, r * 0.12, shape, C.sage, 'wcSmall', r0, 0.32)}</g>`;
  _s = saved;
  b += petals(n, r * 0.98, r * 0.12, shape, C.white, 'wcWhite', r0, 0.97);
  b += `<circle r="${f2(r * 0.24)}" fill="${C.butter}" fill-opacity="0.95" filter="url(#wcSmall)"/>`;
  b += `<circle cx="${f2(r * 0.05)}" cy="${f2(r * 0.07)}" r="${f2(r * 0.14)}" fill="${C.butterDk}" fill-opacity="0.6" filter="url(#wcSmall)"/>`;
  b += dots(Math.round(r * 0.5) + 2, 0, r * 0.2, Math.max(0.7, r * 0.03), C.olive, 0.5);
  put(grp(x, y, rot, sq, b));
}

// Tiny clustered pink florets on an umbel.
function cluster(x, y, r, ang = -90, n = 9) {
  const cols = [C.blush, C.blushDk, C.blushLt, C.blush];
  const heads = [];
  for (let i = 0; i < n; i++) {
    const a = rad(ang + rr(-55, 55)), d = r * Math.sqrt(rr(0.25, 1));
    heads.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  for (const [hx, hy] of heads) stem([[x, y], [x + (hx - x) * 0.4, y + (hy - y) * 0.3], [x + (hx - x) * 0.8, y + (hy - y) * 0.75], [hx, hy]], 0.8, 0.4, C.sage, 0.75);
  for (const [hx, hy] of heads) {
    const fr = rr(r * 0.16, r * 0.26), col = cols[Math.floor(rnd() * cols.length)];
    const shape = (L) => `M0 0 C${f2(L * 0.1)} ${f2(-L * 0.6)} ${f2(L * 1.05)} ${f2(-L * 0.6)} ${f2(L)} 0 C${f2(L * 1.05)} ${f2(L * 0.6)} ${f2(L * 0.1)} ${f2(L * 0.6)} 0 0Z`;
    let b = petals(5, fr, 0, shape, col, 'wcSmall', rr(0, 72), 0.85);
    b += `<circle r="${f2(fr * 0.22)}" fill="${C.butterDk}" fill-opacity="0.7"/>`;
    put(grp(hx, hy, 0, 1, b));
  }
}

function cosmosBud(x, y, r, ang) {
  let b = `<ellipse cx="${f2(r * 0.9)}" rx="${f2(r)}" ry="${f2(r * 0.72)}" fill="${C.blush}" fill-opacity="0.9" filter="url(#wcSmall)"/>`;
  b += `<ellipse cx="${f2(r * 1.2)}" rx="${f2(r * 0.5)}" ry="${f2(r * 0.4)}" fill="${C.blushDk}" fill-opacity="0.55" filter="url(#wcSmall)"/>`;
  for (const s of [-1, 1, 0]) b += `<path d="M0 0 C${f2(r * 0.5)} ${f2(s * r * 0.9)} ${f2(r * 1.1)} ${f2(s * r * 0.8)} ${f2(r * 1.25)} ${f2(s * r * 0.35)} C${f2(r * 0.9)} ${f2(s * r * 0.3)} ${f2(r * 0.4)} ${f2(s * r * 0.15)} 0 0Z" fill="${C.sage}" fill-opacity="0.85" filter="url(#wcSmall)"/>`;
  put(grp(x, y, ang, 1, b));
}
function poppyBud(x, y, r, ang) {
  let b = `<path d="M0 0 C${f2(r * 0.2)} ${f2(-r * 0.75)} ${f2(r * 1.7)} ${f2(-r * 0.85)} ${f2(r * 2.1)} 0 C${f2(r * 1.7)} ${f2(r * 0.85)} ${f2(r * 0.2)} ${f2(r * 0.75)} 0 0Z" fill="${C.sage}" fill-opacity="0.9" filter="url(#wcLeaf)"/>`;
  b += `<path d="M${f2(r * 1.2)} ${f2(-r * 0.15)} C${f2(r * 1.5)} ${f2(-r * 0.55)} ${f2(r * 2.0)} ${f2(-r * 0.35)} ${f2(r * 2.05)} 0 C${f2(r * 1.8)} ${f2(r * 0.2)} ${f2(r * 1.4)} ${f2(r * 0.15)} ${f2(r * 1.2)} ${f2(-r * 0.15)}Z" fill="${C.coral}" fill-opacity="0.75" filter="url(#wcSmall)"/>`;
  b += `<path d="M${f2(r * 0.3)} ${f2(r * 0.05)} C${f2(r * 0.8)} ${f2(r * 0.2)} ${f2(r * 1.4)} ${f2(r * 0.15)} ${f2(r * 1.9)} ${f2(r * 0.05)}" stroke="${C.olive}" stroke-opacity="0.45" stroke-width="${f2(r * 0.08)}" fill="none" filter="url(#wcSmall)"/>`;
  put(grp(x, y, ang, 1, b));
}

// Leaves spaced along a bezier stem, alternating sides, shrinking outward.
function leavesAlong(p, ts, len, wid, cols = [C.sage, C.olive]) {
  ts.forEach((t, i) => {
    const [x, y] = bez(p, t), a = bezTan(p, t), side = i % 2 ? 1 : -1;
    const k = 1 - t * 0.55;
    leaf(x, y, a + side * rr(28, 42), len * k, wid * k, cols[i % cols.length]);
  });
}

function svgDoc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs()}${body}</svg>`;
}

// ===================== 1. HERO SPRIG (1200×400) =====================
// Specs are written for the LEFT half and mirrored, each side with its own
// random seed so the two halves balance without looking stamped.
function hero() {
  out.length = 0;
  const W = 1200, cx = 600, base = [600, 252];
  const layers = { stems: [], leaves: [], small: [], big: [] };
  for (const s of [1, -1]) {
    const X = (x) => (s === 1 ? x : W - x);
    const A = (a) => (s === 1 ? a : 180 - a);
    const P = (pts) => pts.map(([x, y]) => [X(x), y]);
    const sd = s === 1 ? 101 : 202;
    const st = {
      A: P([base, [470, 266], [250, 232], [44, 206]]),
      B: P([[598, 246], [545, 175], [450, 112], [352, 98]]),
      C: P([[596, 248], [520, 176], [340, 118], [160, 124]]),
      D: P([[598, 256], [520, 302], [380, 334], [226, 320]]),
      E: P([[600, 256], [565, 312], [505, 348], [452, 344]]),
      F: P([[600, 250], [565, 228], [525, 214], [488, 204]]),
      G: P([[600, 252], [575, 282], [548, 294], [522, 292]]),
      H: P([[600, 248], [588, 205], [566, 156], [550, 128]]),
      I: P([[600, 252], [540, 254], [450, 246], [398, 236]]),
      J: P([[600, 246], [588, 150], [528, 58], [474, 62]]),
      K: P([[600, 252], [520, 230], [430, 180], [392, 150]]),
      M: P([[600, 254], [540, 276], [380, 290], [318, 262]]),
    };
    layers.stems.push(() => {
      seed(sd);
      stem(st.A, 3.6, 0.6, C.sage);
      stem(st.C, 3.0, 0.8, C.olive, 0.85);
      stem(st.B, 2.8, 1.2);
      stem(st.D, 2.8, 0.9, C.sage);
      stem(st.E, 2.4, 1.2, C.olive, 0.85);
      stem(st.F, 3.0, 1.6);
      stem(st.G, 2.4, 1.4);
      stem(st.H, 2.2, 1.2, C.olive, 0.9);
      stem(st.I, 2.4, 1.2);
      stem(st.J, 2.4, 1.3, C.sage);
      stem(st.K, 2.4, 1.3, C.olive, 0.85);
      stem(st.M, 2.2, 1.0, C.sage);
      const [ax, ay] = bez(st.A, 0.72);
      curve(ax, ay, A(-160), 56, s * 14, 1.4, 0.4, C.sage, 0.85);
      const [cx2, cy2] = bez(st.C, 0.62);
      curve(cx2, cy2, A(-138), 44, s * 20, 1.4, 0.6, C.sage, 0.85);
      const [dx, dy] = bez(st.D, 0.55);
      curve(dx, dy, A(140), 34, s * -10, 1.3, 0.7, C.sage, 0.85);
    });
    layers.leaves.push(() => {
      seed(sd + 7);
      leavesAlong(st.A, [0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.92], 64, 19);
      leavesAlong(st.C, [0.3, 0.45, 0.6, 0.74, 0.87], 50, 14, [C.olive, C.sage]);
      leavesAlong(st.D, [0.22, 0.38, 0.54, 0.7, 0.86], 50, 15);
      leavesAlong(st.B, [0.35, 0.55, 0.75], 42, 13, [C.olive, C.sage]);
      leavesAlong(st.E, [0.4, 0.7], 36, 12);
      leavesAlong(st.M, [0.45, 0.75], 38, 12, [C.olive]);
      // big base leaves to hide where the stems gather
      leaf(X(594), 256, A(163), 86, 24, C.sage);
      leaf(X(596), 250, A(-172), 72, 20, C.olive);
      feather(X(588), 258, A(172), 84, C.sage);
      feather(X(592), 244, A(-150), 68, C.olive);
      feather(X(566), 296, A(145), 54, C.sage);
      feather(X(522), 168, A(-125), 46, C.sage);
      feather(X(430), 272, A(-170), 46, C.olive);
      const [ax, ay] = bez(st.A, 1);
      leaf(ax, ay, A(185), 22, 7, C.sage);
      leaf(ax + s * 6, ay + 2, A(150), 18, 6, C.olive);
    });
    layers.small.push(() => {
      seed(sd + 13);
      cosmosBud(...bez(st.B, 1), 10, A(-168));
      cosmosBud(...bez(st.C, 1), 9, A(-175));
      poppyBud(...bez(st.J, 1), 10, A(150));
      cluster(...bez(st.D, 1), 24, A(-170), 12);
      cluster(X(306), 150, 18, s === 1 ? -120 : -60, 8);
      const [dx, dy] = bez(st.D, 0.55);
      cluster(dx - s * 30, dy + 24, 15, A(150), 7);
      cluster(X(470), 236, 14, -90, 6);
      buttercup(...bez(st.E, 1), 16, 0, 0.9);
      buttercup(...bez(st.H, 1), 15, 20, 0.85);
      buttercup(...bez(st.A, 0.8), 13, 0, 0.9);
      buttercup(X(250), 186, 11, 0, 0.9);
      const [d1x, d1y] = bez(st.A, 0.52);
      daisy(d1x, d1y - 4, 25, 0, 0.8);
      daisy(...bez(st.I, 1), 28, 15 * s, 0.72);
      daisy(...bez(st.M, 1), 22, -10 * s, 0.8);
    });
    layers.big.push(() => {
      seed(sd + 29);
      daisy(...bez(st.G, 1), 34, -10 * s, 0.88);
      cosmos(...bez(st.K, 1), 38, 0, 0.84);
      cosmos(...bez(st.F, 1), 54, 10 * s, 0.9);
    });
  }
  for (const k of ['stems', 'leaves', 'small', 'big']) layers[k].forEach((f) => f());
  seed(999);
  buttercup(cx, 304, 16, 0, 0.9);
  poppy(cx, 194, 66, 0, 0.86);
  return svgDoc(W, 400, out.join(''));
}

// ===================== 2. SECTION ORNAMENT (600×150) =====================
function section() {
  out.length = 0;
  seed(4242);
  const main = [[40, 92], [190, 70], [390, 108], [562, 76]];
  stem(main, 2.6, 1.0, C.sage);
  leavesAlong(main, [0.12, 0.24, 0.4, 0.62, 0.78, 0.9], 36, 11);
  const b1 = bez(main, 0.3), b2 = bez(main, 0.66);
  const t1 = curve(b1[0], b1[1], -100, 40, -15, 1.6, 0.9, C.sage, 0.85);
  const t2 = curve(b2[0], b2[1], 75, 26, -15, 1.5, 0.9, C.olive, 0.8);
  const t3 = curve(...bez(main, 0.82), -80, 28, 25, 1.4, 0.8, C.sage, 0.85);
  feather(...bez(main, 0.5), 200, 34, C.sage);
  cosmosBud(...bez(main, 1), 7, -20);
  cluster(t2[0], t2[1], 17, 70, 9);
  buttercup(t3[0], t3[1], 12, 0, 0.9);
  daisy(...bez(main, 0.04), 18, 0, 0.82);
  cosmos(t1[0] + 4, t1[1] + 6, 26, 0, 0.82);
  poppy(...bez(main, 0.52), 24, 0, 0.82);
  return svgDoc(600, 150, out.join(''));
}

// ===================== 3. SINGLE STEM (160×400) =====================
function single() {
  out.length = 0;
  seed(777);
  const main = [[86, 392], [70, 300], [100, 190], [84, 108]];
  stem(main, 3.4, 2.0, C.sage);
  const side = [bez(main, 0.42), [118, 230], [140, 150], [128, 122]];
  stem(side, 2.0, 1.4, C.sage, 0.85);
  // basal & stem leaves
  leaf(84, 384, -128, 70, 16, C.olive);
  leaf(86, 384, -58, 62, 14, C.sage);
  leaf(82, 372, -100, 52, 12, C.sage);
  leavesAlong(main, [0.32, 0.55], 40, 10, [C.olive, C.sage]);
  poppyBud(128, 122, 11, 115);
  poppy(84, 84, 54, 8, 0.8);
  return svgDoc(160, 400, out.join(''));
}

// ---------- render ----------
const pieces = [
  ['hero-sprig', hero(), 1200, 400],
  ['section-ornament', section(), 600, 150],
  ['single-stem', single(), 160, 400],
];
const browser = await chromium.launch();
for (const [name, svg, w, h] of pieces) {
  writeFileSync(join(OUT, `${name}${SUFFIX}.svg`), svg);
  for (const scale of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.screenshot({ path: join(OUT, `${name}${SUFFIX}${scale === 2 ? '@2x' : ''}.png`), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
  }
  // preview on ivory for review
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#FFFCF6">${svg}</body></html>`);
  await page.screenshot({ path: join(OUT, `_preview-${name}${SUFFIX}.png`), clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
}
await browser.close();
console.log('done');
