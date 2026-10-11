// Ink-and-watercolor venue illustrations → PNGs.
// Usage: node tools/illustrate.mjs assets/illustrations [name ...]
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] || '.';
const ONLY = process.argv.slice(3);
mkdirSync(OUT, { recursive: true });

const INK = '#3D3A33';
const P = {
  brick: '#C9705A', brickDk: '#A9533F', roof: '#B5553F',
  trim: '#FFFDF8', glass: '#A9BDC6', glassDk: '#7F96A0', stone: '#D5CDBD',
  sky: '#C7D5DA', trunk: '#8E7D60', wood: '#B48A5E',
  sage: '#7F9472', sageLt: '#A3B396', olive: '#6E8B3D', oliveDk: '#4F6230',
  leafDk: '#3F5A3C', teal: '#4E6E62',
  rasp: '#C9506E', raspLt: '#E28A9E', raspDk: '#A63D5A',
  pink: '#E0708A', pinkLt: '#EFA3B2', coral: '#D9694F',
  mari: '#E68A3C', butter: '#F2B144', butterLt: '#F4D27A',
  plum: '#8C76A8', plumDk: '#6B5590',
  blue: '#7FA6C9', blueDk: '#4F7398', rock: '#A9B6BF', rockDk: '#8796A3',
  cream: '#EDE4CF', ochre: '#EBBE84', ivory: '#FFFCF6',
  blushW: '#E8A5B4', coralW: '#E8917A',
};

// ---------- seeded random ----------
let _s = 1;
const seed = (n) => { _s = n >>> 0 || 1; };
const rnd = () => { _s |= 0; _s = (_s + 0x6d2b79f5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();
const pick = (a) => a[Math.floor(rnd() * a.length)];
const f2 = (n) => Math.round(n * 100) / 100;
const rad = (d) => (d * Math.PI) / 180;

// ---------- filters ----------
function defs(extra = '') {
  const wc = (name, disp, blur, wide, k2, k3, freq = 0.035) => `
  <filter id="${name}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${disp}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="${blur}" result="soft"/>
    <feGaussianBlur in="d" stdDeviation="${wide}" result="wide"/>
    <feComposite in="soft" in2="wide" operator="arithmetic" k2="${k2}" k3="${k3}" result="edge"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.6 0 0 0 1.07" result="ga"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="11" result="b"/>
    <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.9 0 0 0 1.25" result="ba"/>
    <feComposite in="edge" in2="ga" operator="in" result="e2"/>
    <feComposite in="e2" in2="ba" operator="in"/>
  </filter>`;
  return `<defs>
  ${wc('wcPetal', 6, 0.55, 3.2, 1.7, -0.95)}
  ${wc('wcSmall', 3, 0.4, 1.6, 1.65, -0.85, 0.06)}
  ${wc('wcLeaf', 4, 0.5, 2.6, 1.75, -0.9)}
  ${wc('wcWall', 4, 0.6, 7, 1.45, -0.6, 0.03)}
  ${wc('wcSky', 26, 7, 14, 1.25, -0.45, 0.012)}
  <filter id="wcWhite" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.4"/>
  </filter>
  <filter id="ink" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="5" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.22"/>
  </filter>
  ${extra}
  </defs>`;
}

// ---------- output buffer ----------
const out = [];
const put = (s) => out.push(s);

// ---------- geometry ----------
function smooth(pts, closed = true) {
  const n = pts.length, at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f2(pts[0][0])} ${f2(pts[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += ` C${f2(p1[0] + (p2[0] - p0[0]) / 6)} ${f2(p1[1] + (p2[1] - p0[1]) / 6)} ${f2(p2[0] - (p3[0] - p1[0]) / 6)} ${f2(p2[1] - (p3[1] - p1[1]) / 6)} ${f2(p2[0])} ${f2(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}
function blobPts(cx, cy, rx, ry, n = 10, j = 0.15, rot = 0) {
  const a0 = rnd() * Math.PI * 2, pts = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2, k = 1 + rr(-j, j);
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k, r = rad(rot);
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
}
const blob = (...a) => smooth(blobPts(...a));
const poly = (pts) => 'M' + pts.map(([x, y]) => `${f2(x)} ${f2(y)}`).join(' L') + 'Z';
function bez(p, t) {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]);
}
function bezTan(p, t) {
  const a = bez(p, Math.max(0, t - 0.01)), b = bez(p, Math.min(1, t + 0.01));
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
}
function ribbon(p, w0, w1, n = 40) {
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = bez(p, t), a = rad(bezTan(p, t)), w = (w0 + (w1 - w0) * t) / 2;
    L.push([x - Math.sin(a) * w, y + Math.cos(a) * w]);
    R.push([x + Math.sin(a) * w, y - Math.cos(a) * w]);
  }
  return poly(L.concat(R.reverse()));
}
const bezD = (p) => `M${f2(p[0][0])} ${f2(p[0][1])} C${p.slice(1).map(([x, y]) => `${f2(x)} ${f2(y)}`).join(' ')}`;
// a curved stroke from (x,y) along angle with a bend, as a bezier
function arc(x, y, ang, len, bend) {
  const a = rad(ang), b = rad(ang + bend);
  return [[x, y], [x + Math.cos(a) * len * 0.35, y + Math.sin(a) * len * 0.35],
    [x + Math.cos(b) * len * 0.7, y + Math.sin(b) * len * 0.7], [x + Math.cos(b) * len, y + Math.sin(b) * len]];
}

// ---------- marks ----------
// Watercolor wash, slightly misregistered from the ink like a quick sketch.
function wash(d, col, op = 0.85, filt = 'wcLeaf', mis = 2.5) {
  put(`<path d="${d}" transform="translate(${f2(rr(-mis, mis))} ${f2(rr(-mis, mis))})" fill="${col}" fill-opacity="${op}" filter="url(#${filt})"/>`);
}
function solid(d, col = P.trim, op = 1) {
  put(`<path d="${d}" fill="${col}" fill-opacity="${op}" filter="url(#wcWhite)"/>`);
}
// Ink line. sketchy=true breaks the line with small gaps.
function ink(d, w = 1.2, op = 0.85, sketchy = false) {
  const dash = sketchy ? ` stroke-dasharray="${f2(rr(50, 120))} ${f2(rr(3, 7))} ${f2(rr(25, 70))} ${f2(rr(2, 6))}"` : '';
  put(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="round" stroke-linejoin="round"${dash} filter="url(#ink)"/>`);
}
// A ruled line drawn by hand: slight overshoot and bow.
function seg(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const o1 = rr(-0.5, 2.5), o2 = rr(-0.5, 2.5), bow = rr(-0.006, 0.006) * L;
  const ax = x1 - ux * o1, ay = y1 - uy * o1, bx = x2 + ux * o2, by = y2 + uy * o2;
  return `M${f2(ax)} ${f2(ay)} Q${f2((ax + bx) / 2 - uy * bow)} ${f2((ay + by) / 2 + ux * bow)} ${f2(bx)} ${f2(by)}`;
}
const rectD = (x, y, w, h) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
function box(x, y, w, h, lw = 1.1, op = 0.85) {
  ink([seg(x, y, x + w, y), seg(x + w, y, x + w, y + h), seg(x + w, y + h, x, y + h), seg(x, y + h, x, y)].join(' '), lw, op);
}

// ---------- shared motifs ----------
function leafD(x, y, ang, L, W) {
  const k = rr(-0.12, 0.12);
  return `<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(ang)})"><path d="M0 0 C${f2(L * 0.3)} ${f2(-W * (0.6 + k))} ${f2(L * 0.72)} ${f2(-W * 0.45)} ${f2(L)} 0 C${f2(L * 0.7)} ${f2(W * (0.4 - k))} ${f2(L * 0.3)} ${f2(W * 0.55)} 0 0Z" FILL/></g>`;
}
function leaf(x, y, ang, L, W, col, withInk = true, vein = true) {
  const g = leafD(x, y, ang, L, W);
  put(g.replace('FILL', `fill="${col}" fill-opacity="0.9" filter="url(#wcLeaf)"`));
  if (withInk) {
    put(g.replace('FILL', `fill="none" stroke="${INK}" stroke-width="0.9" stroke-opacity="0.8" stroke-dasharray="${f2(rr(40, 90))} ${f2(rr(3, 6))}" filter="url(#ink)"`));
    if (vein) put(`<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(ang)})"><path d="M${f2(L * 0.08)} 0 Q${f2(L * 0.5)} ${f2(-W * 0.08)} ${f2(L * 0.85)} 0" fill="none" stroke="${INK}" stroke-width="0.6" stroke-opacity="0.55" filter="url(#ink)"/></g>`);
  }
}
function stemLine(p, w0, w1, col, inked = true) {
  wash(ribbon(p, w0, w1), col, 0.9, 'wcSmall', 1);
  if (inked) ink(bezD(p), 0.9, 0.7, true);
}
function butterfly(x, y, s, rot, col = P.blue, dk = P.blueDk) {
  const up = `M0 0 C${-10 * s} ${-30 * s} ${-50 * s} ${-46 * s} ${-56 * s} ${-22 * s} C${-59 * s} ${-6 * s} ${-30 * s} ${4 * s} 0 ${2 * s}Z`;
  const lo = `M0 ${2 * s} C${-24 * s} ${8 * s} ${-40 * s} ${28 * s} ${-26 * s} ${40 * s} C${-12 * s} ${46 * s} ${-4 * s} ${26 * s} 0 ${6 * s}Z`;
  const tip = `M${-40 * s} ${-36 * s} C${-50 * s} ${-40 * s} ${-58 * s} ${-30 * s} ${-55 * s} ${-18 * s} C${-50 * s} ${-22 * s} ${-44 * s} ${-28 * s} ${-40 * s} ${-36 * s}Z`;
  let b = '';
  for (const m of [1, -1]) {
    b += `<g transform="scale(${m} 1)">`;
    b += `<path d="${up}" fill="${col}" fill-opacity="0.9" filter="url(#wcSmall)"/>`;
    b += `<path d="${lo}" fill="${col}" fill-opacity="0.8" filter="url(#wcSmall)"/>`;
    b += `<path d="${tip}" fill="${dk}" fill-opacity="0.85" filter="url(#wcSmall)"/>`;
    b += `<path d="${up} ${lo}" fill="none" stroke="${INK}" stroke-width="${f2(Math.max(0.7, s * 1.1))}" stroke-opacity="0.85" filter="url(#ink)"/>`;
    b += `<path d="M0 0 L${-34 * s} ${-26 * s} M0 0 L${-44 * s} ${-12 * s} M0 ${3 * s} L${-22 * s} ${30 * s}" fill="none" stroke="${INK}" stroke-width="${f2(Math.max(0.5, s * 0.6))}" stroke-opacity="0.6" filter="url(#ink)"/>`;
    b += `<circle cx="${-46 * s}" cy="${-14 * s}" r="${f2(2.2 * s)}" fill="${P.trim}"/>`;
    b += `<path d="M0 ${-8 * s} Q${-6 * s} ${-22 * s} ${-12 * s} ${-28 * s}" fill="none" stroke="${INK}" stroke-width="${f2(Math.max(0.5, s * 0.7))}" stroke-opacity="0.85"/>`;
    b += `<circle cx="${-12 * s}" cy="${-28 * s}" r="${f2(1.4 * s)}" fill="${INK}"/>`;
    b += `</g>`;
  }
  b += `<ellipse cx="0" cy="${4 * s}" rx="${f2(2.6 * s)}" ry="${f2(15 * s)}" fill="${INK}" fill-opacity="0.85" filter="url(#ink)"/>`;
  put(`<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(rot)})">${b}</g>`);
}

// ---------- render ----------
function svgDoc(w, h, body, extraDefs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs(extraDefs)}${body}</svg>`;
}

// ===================== BUILDING (1200×700) =====================
function building() {
  out.length = 0;
  seed(31);
  // sky wash behind the roofline
  wash(blob(600, 230, 640, 170, 14, 0.12), P.sky, 0.32, 'wcSky', 0);
  // trees behind, right side
  for (let i = 0; i < 40; i++) {
    const x = rr(1060, 1170), y = rr(330, 600), r = rr(16, 30);
    wash(blob(x, y, r, r * 0.8, 8, 0.25), pick([P.leafDk, P.olive, P.sage, P.teal]), 0.7, 'wcLeaf');
    if (i % 3 === 0) ink(`M${f2(x - r)} ${f2(y)} q${f2(r * 0.5)} ${f2(-r)} ${f2(r * 1.4)} ${f2(-r * 0.3)}`, 0.7, 0.5, true);
  }

  // roof + chimneys
  for (const cx of [420, 780]) {
    wash(rectD(cx - 13, 168, 26, 60), P.brickDk, 0.9, 'wcSmall', 1);
    solid(rectD(cx - 16, 162, 32, 8));
    box(cx - 13, 168, 26, 56);
    box(cx - 16, 162, 32, 8, 0.9);
  }
  const roof = [[128, 302], [1072, 302], [972, 214], [228, 214]];
  wash(poly(roof), P.roof, 0.88, 'wcWall');
  ink([seg(128, 302, 228, 214), seg(228, 214, 972, 214), seg(972, 214, 1072, 302)].join(' '), 1.3);
  // a few shingle strokes
  for (let i = 0; i < 26; i++) {
    const y = rr(225, 292), x = rr(260 + (300 - y) * 0.2, 940 - (300 - y) * 0.2);
    ink(seg(x, y, x + rr(14, 30), y), 0.7, 0.35);
  }
  // dormers
  for (const cx of [330, 600, 870]) {
    solid(poly([[cx - 34, 296], [cx + 34, 296], [cx + 34, 244], [cx, 214], [cx - 34, 244]]));
    wash(poly([[cx - 46, 250], [cx, 204], [cx + 46, 250], [cx + 40, 254], [cx, 216], [cx - 40, 254]]), P.roof, 0.9, 'wcSmall', 1);
    ink([seg(cx - 46, 250, cx, 204), seg(cx, 204, cx + 46, 250), seg(cx - 34, 252, cx - 34, 296), seg(cx + 34, 252, cx + 34, 296)].join(' '), 1.1);
    wash(rectD(cx - 13, 250, 26, 36), P.glass, 0.75, 'wcSmall', 1);
    box(cx - 13, 250, 26, 36, 1);
    ink(seg(cx - 13, 268, cx + 13, 268) + seg(cx, 250, cx, 286), 0.7, 0.7);
  }

  // brick walls
  wash(rectD(150, 304, 900, 296), P.brick, 0.86, 'wcWall', 1);
  for (let i = 0; i < 7; i++) wash(blob(rr(200, 1000), rr(340, 560), rr(60, 140), rr(30, 60), 8, 0.25), P.brickDk, 0.22, 'wcSky', 0);
  for (let i = 0; i < 70; i++) {
    const x = rr(160, 1030), y = rr(312, 585);
    let d = '';
    for (let k = 0; k < 3; k++) d += seg(x + (k % 2) * 6, y + k * 5, x + (k % 2) * 6 + rr(9, 14), y + k * 5);
    put(`<path d="${d}" fill="none" stroke="${P.brickDk}" stroke-width="1" stroke-opacity="0.55" filter="url(#ink)"/>`);
  }
  ink(seg(150, 304, 150, 600) + seg(1050, 304, 1050, 600), 1.3);
  // eave fascia
  solid(rectD(126, 298, 948, 9));
  ink(seg(126, 298, 1074, 298) + seg(126, 307, 1074, 307), 1.1);

  // windows
  const xs = Array.from({ length: 9 }, (_, i) => 196 + i * 101);
  function windowAt(cx, y, w, h) {
    solid(rectD(cx - w / 2 - 5, y - 5, w + 10, h + 10));
    wash(rectD(cx - w / 2, y, w, h), P.glass, 0.72, 'wcSmall', 1);
    wash(rectD(cx - w / 2, y, w, h * 0.3), P.glassDk, 0.35, 'wcSmall', 1);
    box(cx - w / 2 - 5, y - 5, w + 10, h + 10, 1);
    box(cx - w / 2, y, w, h, 0.8, 0.7);
    ink(seg(cx - w / 2, y + h / 2, cx + w / 2, y + h / 2) + seg(cx, y, cx, y + h), 0.7, 0.7);
    solid(rectD(cx - w / 2 - 8, y + h + 5, w + 16, 5));
    box(cx - w / 2 - 8, y + h + 5, w + 16, 5, 0.8);
  }
  for (const cx of xs) windowAt(cx, 334, 38, 80);
  xs.forEach((cx, i) => { if (i !== 4) windowAt(cx, 486, 38, 76); });
  // door + transom
  wash(rectD(582, 500, 36, 98), P.oliveDk, 0.8, 'wcSmall', 1);
  box(582, 500, 36, 98);
  wash(rectD(582, 486, 36, 12), P.glass, 0.7, 'wcSmall', 1);
  box(582, 486, 36, 12, 0.9);
  ink(seg(590, 512, 590, 590) + seg(610, 512, 610, 590), 0.6, 0.5);

  // foundation
  wash(rectD(150, 590, 900, 12), P.stone, 0.8, 'wcSmall', 1);
  ink(seg(150, 590, 1050, 590), 0.9, 0.6);

  // porch: roof, columns, railing, steps
  wash(poly([[288, 480], [912, 480], [898, 452], [302, 452]]), P.roof, 0.9, 'wcSmall', 1);
  ink(seg(302, 452, 898, 452) + seg(302, 452, 288, 480) + seg(898, 452, 912, 480), 1.1);
  solid(rectD(286, 479, 628, 8));
  box(286, 479, 628, 8, 1);
  const cols = Array.from({ length: 9 }, (_, k) => 300 + k * 75);
  // rails first so columns overlap them
  solid(rectD(296, 552, 608, 5));
  ink(seg(296, 552, 556, 552) + seg(296, 557, 556, 557) + seg(644, 552, 904, 552) + seg(644, 557, 904, 557), 0.8, 0.8);
  for (let x = 300; x < 900; x += 9) if (x < 554 || x > 646) ink(seg(x, 558, x, 596), 0.6, 0.5);
  for (const x of cols) {
    solid(rectD(x - 4, 487, 8, 112));
    box(x - 4, 487, 8, 112, 0.9);
    solid(rectD(x - 6, 487, 12, 5));
    box(x - 6, 487, 12, 5, 0.7);
  }
  for (let k = 0; k < 3; k++) {
    const w = 80 + k * 14, y = 600 + k * 8;
    wash(rectD(600 - w / 2, y, w, 8), P.stone, 0.8, 'wcSmall', 1);
    box(600 - w / 2, y, w, 8, 0.8);
  }
  ink(seg(150, 600, 556, 600) + seg(644, 600, 1050, 600), 1.1);

  // hedge with white roses
  const hedge = [];
  for (let x = 120; x <= 1080; x += rr(34, 48)) if (x < 540 || x > 660) hedge.push([x, rr(600, 612), rr(26, 38)]);
  for (const [x, y, r] of hedge) wash(blob(x, y, r, r * 0.8, 9, 0.2), pick([P.sage, P.olive, P.leafDk]), 0.85, 'wcLeaf');
  for (const [x, y, r] of hedge) if (rnd() < 0.7) ink(`M${f2(x - r * 0.9)} ${f2(y - r * 0.1)} Q${f2(x - r * 0.4)} ${f2(y - r * 1.05)} ${f2(x + r * 0.2)} ${f2(y - r * 0.75)}`, 0.8, 0.6, true);
  for (let i = 0; i < 46; i++) {
    const [x, y, r] = pick(hedge), rx = x + rr(-r, r) * 0.8, ry = y + rr(-r * 0.7, r * 0.3), rs = rr(3.5, 6);
    solid(blob(rx, ry, rs, rs, 7, 0.2));
    ink(`M${f2(rx)} ${f2(ry)} m${f2(-rs * 0.5)} 0 a${f2(rs * 0.5)} ${f2(rs * 0.45)} 0 1 1 ${f2(rs * 0.6)} ${f2(rs * 0.3)}`, 0.6, 0.6);
  }
  // bench
  wash(rectD(810, 616, 74, 6), P.wood, 0.85, 'wcSmall', 1);
  wash(rectD(810, 600, 74, 10), P.wood, 0.8, 'wcSmall', 1);
  box(810, 600, 74, 10, 0.8);
  box(810, 616, 74, 6, 0.8);
  ink(seg(816, 622, 816, 640) + seg(878, 622, 878, 640) + seg(820, 610, 820, 616) + seg(874, 610, 874, 616), 0.9);

  // palm (cabbage palm) at left
  const trunk = [[226, 652], [218, 520], [236, 400], [244, 330]];
  wash(ribbon(trunk, 16, 10), P.trunk, 0.85, 'wcLeaf', 1);
  for (const s of [-1, 1]) ink(bezD(trunk.map(([x, y], i) => [x + s * (8 - i * 1), y])), 1, 0.75, true);
  for (let t = 0.05; t < 0.95; t += 0.045) {
    const [x, y] = bez(trunk, t);
    ink(`M${f2(x - 7)} ${f2(y)} q7 ${f2(rr(2, 4))} 14 0`, 0.6, 0.5);
  }
  const crown = [244, 326];
  for (let i = 0; i < 70; i++) {
    const a = -90 + rr(-150, 150);
    const L = rr(70, 150), droop = Math.abs(Math.cos(rad(a))) * L * 0.45 + (Math.sin(rad(a)) > 0 ? L * 0.15 : 0);
    const p = [crown, [crown[0] + Math.cos(rad(a)) * L * 0.4, crown[1] + Math.sin(rad(a)) * L * 0.4],
      [crown[0] + Math.cos(rad(a)) * L * 0.8, crown[1] + Math.sin(rad(a)) * L * 0.8 + droop * 0.5],
      [crown[0] + Math.cos(rad(a)) * L, crown[1] + Math.sin(rad(a)) * L + droop]];
    wash(ribbon(p, 8, 0.6), pick([P.sage, P.olive, P.sageLt, P.leafDk]), 0.82, 'wcSmall', 1);
    if (i % 3 === 0) ink(bezD(p), 0.7, 0.5);
  }
  // lawn
  wash(blob(600, 668, 620, 34, 14, 0.15), P.olive, 0.5, 'wcSky', 0);
  wash(blob(500, 672, 300, 18, 10, 0.2), P.sageLt, 0.5, 'wcSky', 0);
  return svgDoc(1200, 700, out.join(''));
}

// ===================== WALLPAPER TILE (600×600, seamless) =====================
function bigBloom(x, y, r) {
  for (let k = 0; k < 3; k++) {
    const n = 8 - k, rr0 = r * (0.62 - k * 0.2), pr = r * (0.5 - k * 0.1);
    const col = [P.raspLt, P.rasp, P.raspDk][k];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * 0.4 + rr(-0.15, 0.15);
      const d = blob(x + Math.cos(a) * rr0, y + Math.sin(a) * rr0, pr, pr * 0.82, 8, 0.15, (a * 180) / Math.PI);
      wash(d, col, 0.88, 'wcPetal', 1);
      ink(d, 0.8, 0.7, true);
    }
  }
  wash(blob(x, y, r * 0.16, r * 0.16, 7, 0.2), P.butter, 0.95, 'wcSmall', 0.5);
  for (let i = 0; i < 6; i++) put(`<circle cx="${f2(x + rr(-r, r) * 0.12)}" cy="${f2(y + rr(-r, r) * 0.12)}" r="1.1" fill="${INK}" fill-opacity="0.7"/>`);
}
function rayFlower(x, y, r, col = P.mari, inner = P.butter) {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + rr(-6, 6);
    const g = `<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(a)})"><path d="M${f2(r * 0.18)} 0 C${f2(r * 0.4)} ${f2(-r * 0.17)} ${f2(r * 0.9)} ${f2(-r * 0.15)} ${f2(r)} 0 C${f2(r * 0.9)} ${f2(r * 0.15)} ${f2(r * 0.4)} ${f2(r * 0.17)} ${f2(r * 0.18)} 0Z" FILL/></g>`;
    put(g.replace('FILL', `fill="${i % 3 ? col : inner}" fill-opacity="0.9" filter="url(#wcSmall)"`));
    put(g.replace('FILL', `fill="none" stroke="${INK}" stroke-width="0.7" stroke-opacity="0.75" filter="url(#ink)"`));
  }
  wash(blob(x, y, r * 0.24, r * 0.24, 7, 0.15), P.mari, 0.95, 'wcSmall', 0.5);
  ink(blob(x, y, r * 0.24, r * 0.24, 7, 0.15), 0.8, 0.8);
}
function smallFlower(x, y, r, col = P.butter) {
  for (let i = 0; i < 5; i++) {
    const a = rad(i * 72 + rr(-8, 8)), d = blob(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.4, 7, 0.12, (i * 72));
    wash(d, col, 0.9, 'wcSmall', 0.5);
    ink(d, 0.6, 0.65);
  }
  put(`<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r * 0.18)}" fill="${P.mari}"/>`);
}
function allium(x, y, r) {
  wash(blob(x, y, r, r, 9, 0.12), P.plum, 0.55, 'wcPetal', 1);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r;
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    put(`<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(rr(2, 3.4))}" fill="${pick([P.plum, P.plumDk])}" fill-opacity="0.85" filter="url(#wcSmall)"/>`);
    if (i % 3 === 0) ink(`M${f2(cx - 2)} ${f2(cy)} L${f2(cx + 2)} ${f2(cy)} M${f2(cx)} ${f2(cy - 2)} L${f2(cx)} ${f2(cy + 2)}`, 0.5, 0.6);
  }
}
function bird(x, y, s, flip = 1) {
  const body = `M-28 4 C-20 -10 0 -16 14 -12 C22 -18 32 -14 33 -6 L42 -4 L33 -1 C30 8 14 16 0 14 C-12 13 -20 10 -28 4Z`;
  const tail = `M-26 2 L-48 -6 L-44 4 L-48 12 L-26 8Z`;
  const wing = `M-14 -2 C-4 -12 10 -9 15 0 C6 7 -6 7 -14 -2Z`;
  const belly = `M-10 10 C0 6 18 4 30 2 C26 10 12 15 0 14 C-5 14 -8 12 -10 10Z`;
  const g = `<g transform="translate(${f2(x)} ${f2(y)}) scale(${f2(s * flip)} ${f2(s)})">
    <path d="${tail}" fill="${P.oliveDk}" fill-opacity="0.85" filter="url(#wcSmall)"/>
    <path d="${body}" fill="${P.trunk}" fill-opacity="0.9" filter="url(#wcSmall)"/>
    <path d="${belly}" fill="${P.butterLt}" fill-opacity="0.95" filter="url(#wcSmall)"/>
    <path d="${wing}" fill="${P.olive}" fill-opacity="0.85" filter="url(#wcSmall)"/>
    <path d="${body} ${tail} ${wing}" fill="none" stroke="${INK}" stroke-width="${f2(1 / s)}" stroke-opacity="0.85" filter="url(#ink)"/>
    <circle cx="26" cy="-8" r="1.8" fill="${INK}"/></g>`;
  put(g);
}
function fern(x, y, ang, len, col = P.leafDk) {
  const p = arc(x, y, ang, len, rr(-20, 20));
  stemLine(p, 1.6, 0.6, col, true);
  for (let t = 0.12; t < 0.96; t += 0.11) {
    const [px, py] = bez(p, t), a = bezTan(p, t), L = len * 0.22 * (1 - t * 0.6);
    for (const sd of [-1, 1]) leaf(px, py, a + sd * 55, L, L * 0.38, col, t < 0.5, false);
  }
}
function plant(x, yb, h, bloom) {
  const p = [[x, yb], [x + rr(-20, 20), yb - h * 0.35], [x + rr(-25, 25), yb - h * 0.7], [x + rr(-8, 8), yb - h]];
  stemLine(p, 3, 1.6, P.leafDk);
  for (let t = 0.1; t < 0.85; t += 0.12) {
    const [px, py] = bez(p, t), a = bezTan(p, t), sd = Math.round(t / 0.12) % 2 ? 1 : -1;
    leaf(px, py, a + sd * rr(40, 60), rr(40, 58), rr(13, 17), pick([P.leafDk, P.teal, P.olive]));
  }
  // side sprigs with small yellow flowers
  for (const t of [0.45, 0.65]) {
    const [px, py] = bez(p, t), sd = t === 0.45 ? 1 : -1;
    const q = arc(px, py, -90 + sd * 55, 46, -sd * 25);
    stemLine(q, 1.4, 0.8, P.leafDk);
    smallFlower(q[3][0], q[3][1], 9);
  }
  const [bx, by] = p[3];
  bloom(bx, by);
}
function wallpaper(ground) {
  out.length = 0;
  seed(57);
  const W = 600, motifs = [];
  const add = (fn) => { const start = out.length; fn(); motifs.push(out.splice(start).join('')); };
  add(() => plant(110, 640, 600, (x, y) => bigBloom(x, y, 50)));
  add(() => plant(420, 340, 600, (x, y) => bigBloom(x, y, 46)));
  add(() => plant(270, 470, 240, (x, y) => rayFlower(x, y, 30)));
  add(() => plant(560, 180, 220, (x, y) => rayFlower(x, y, 28)));
  add(() => plant(20, 220, 200, (x, y) => bigBloom(x, y, 30)));
  add(() => plant(330, 60, 220, (x, y) => rayFlower(x, y, 26, P.butter, P.mari)));
  add(() => { stemLine(arc(300, 240, -80, 80, 10), 1.6, 0.9, P.leafDk); allium(312, 160, 24); });
  add(() => { stemLine(arc(545, 600, -95, 90, -8), 1.6, 0.9, P.leafDk); allium(537, 512, 22); });
  add(() => { stemLine(arc(180, 400, -70, 70, 12), 1.4, 0.8, P.leafDk); allium(206, 336, 18); });
  add(() => rayFlower(500, 420, 22));
  add(() => rayFlower(60, 520, 20, P.butter, P.mari));
  add(() => rayFlower(230, 320, 18, P.raspLt, P.rasp));
  for (const [x, y, r, c] of [[230, 210, 11, P.butter], [80, 450, 11, P.butter], [520, 470, 10, P.raspLt], [370, 560, 10, P.butter], [160, 120, 10, P.raspLt], [450, 120, 9, P.butter], [590, 360, 10, P.butter], [300, 380, 9, P.pinkLt]]) add(() => smallFlower(x, y, r, c));
  add(() => fern(240, 590, -60, 90));
  add(() => fern(70, 330, -120, 80, P.teal));
  add(() => fern(380, 400, -40, 70));
  add(() => fern(500, 300, -110, 70, P.teal));
  add(() => fern(120, 40, -70, 60));
  add(() => fern(420, 560, -130, 70, P.olive));
  for (let i = 0; i < 10; i++) add(() => { const q = arc(rr(0, 600), rr(0, 600), rr(-130, -50), rr(40, 70), rr(-20, 20)); stemLine(q, 1.3, 0.6, pick([P.leafDk, P.olive, P.teal])); for (const t of [0.3, 0.6, 0.9]) { const [px, py] = bez(q, t), an = bezTan(q, t); for (const sd of [-1, 1]) leaf(px, py, an + sd * 50, rr(12, 18), rr(5, 7), pick([P.leafDk, P.olive, P.teal]), true, false); } });
  add(() => butterfly(380, 280, 0.46, 20));
  add(() => butterfly(80, 80, 0.4, -15));
  add(() => butterfly(560, 120, 0.34, 35, P.mari, P.raspDk));
  add(() => butterfly(260, 520, 0.3, -30, P.butter, P.mari));
  add(() => bird(230, 380, 0.85, 1));
  add(() => bird(520, 560, 0.8, -1));
  // each motif drawn in all 9 tile offsets so edges wrap seamlessly
  let body = '';
  for (const m of motifs) for (const dx of [-W, 0, W]) for (const dy of [-W, 0, W]) body += `<g transform="translate(${dx} ${dy})">${m}</g>`;
  const paper = `<filter id="paper" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${W}"><feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="3" stitchTiles="stitch" seed="2"/><feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.4  0 0 0 0 0.2  0 0 0 0.5 -0.18"/></filter>`;
  return svgDoc(W, W, `<rect width="${W}" height="${W}" fill="${ground}"/><rect width="${W}" height="${W}" filter="url(#paper)"/>${body}`, paper);
}

// ===================== HOLLYHOCK MURAL (520×860) =====================
function hollyFlower(x, y, r, tilt) {
  const cols = [P.pink, P.pinkLt, P.rasp, P.coral];
  const base = pick(cols);
  for (let i = 0; i < 5; i++) {
    const a = rad(i * 72 + rr(-10, 10) + tilt);
    const d = blob(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45 * 0.85, r * 0.56, r * 0.5, 9, 0.12, i * 72);
    wash(d, rnd() < 0.7 ? base : pick(cols), 0.88, 'wcPetal', 1);
    ink(d, 0.8, 0.7, true);
  }
  wash(blob(x, y, r * 0.3, r * 0.28, 8, 0.15), P.raspDk, 0.55, 'wcSmall', 0.5);
  put(`<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r * 0.1)}" fill="${P.butterLt}"/>`);
  ink(`M${f2(x)} ${f2(y)} m-${f2(r * 0.1)} 0 a${f2(r * 0.1)} ${f2(r * 0.1)} 0 1 0 ${f2(r * 0.2)} 0`, 0.6, 0.6);
}
function lobedLeaf(x, y, ang, r, col) {
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2, k = 1 + 0.12 * Math.cos(a * 5) + rr(-0.04, 0.04);
    pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k * 0.88]);
  }
  const d = smooth(pts);
  put(`<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(ang)})"><path d="${d}" fill="${col}" fill-opacity="0.88" filter="url(#wcLeaf)"/><path d="${d}" fill="none" stroke="${INK}" stroke-width="0.9" stroke-opacity="0.75" stroke-dasharray="70 5 40 4" filter="url(#ink)"/><path d="M${f2(-r)} 0 L${f2(r * 0.7)} 0 M${f2(-r * 0.5)} 0 L${f2(r * 0.2)} ${f2(-r * 0.6)} M${f2(-r * 0.5)} 0 L${f2(r * 0.2)} ${f2(r * 0.6)}" fill="none" stroke="${INK}" stroke-width="0.6" stroke-opacity="0.5" filter="url(#ink)"/></g>`);
}
function spike(x, yb, yt, sway) {
  const p = [[x, yb], [x + sway * 0.3, yb - (yb - yt) * 0.35], [x + sway, yb - (yb - yt) * 0.7], [x + sway * 0.8, yt]];
  stemLine(p, 4.5, 1.6, P.olive);
  for (let t = 0.12; t < 0.4; t += 0.09) {
    const [px, py] = bez(p, t), sd = Math.round(t / 0.09) % 2 ? 1 : -1;
    lobedLeaf(px + sd * 30, py, sd * rr(-20, 20), rr(26, 34), pick([P.sage, P.olive]));
  }
  for (let t = 0.97; t > 0.78; t -= 0.035) {
    const [px, py] = bez(p, t), sd = Math.round(t / 0.035) % 2 ? 1 : -1, r = rr(4, 6) * (1.2 - (t - 0.78) * 2);
    const d = blob(px + sd * 6, py, r, r * 1.1, 7, 0.15);
    wash(d, P.sage, 0.9, 'wcSmall', 0.5);
    ink(d, 0.6, 0.7);
  }
  const fl = [];
  for (let t = 0.42; t < 0.8; t += 0.055) {
    const [px, py] = bez(p, t), sd = Math.round(t / 0.055) % 2 ? 1 : -1;
    fl.push([px + sd * rr(6, 14), py, 30 * (1.15 - (t - 0.42) * 1.4)]);
  }
  fl.reverse().forEach(([fx, fy, r]) => hollyFlower(fx, fy, r, rr(0, 72)));
}
function thistle(x, yb, yt) {
  const p = [[x, yb], [x - 6, yb - (yb - yt) * 0.4], [x + 8, yb - (yb - yt) * 0.75], [x, yt]];
  stemLine(p, 3, 1.8, P.sage);
  for (const t of [0.25, 0.5, 0.7]) {
    const [px, py] = bez(p, t);
    for (const sd of [-1, 1]) {
      const L = 46 * (1 - t * 0.5), pts = [[0, 0]];
      for (let i = 1; i <= 5; i++) pts.push([L * i / 5, (i % 2 ? -1 : 1) * L * 0.14 * (1 - i / 6)]);
      const d = `M0 0 ${pts.slice(1).map(([a, b]) => `L${f2(a)} ${f2(b)}`).join(' ')} L${f2(L * 0.4)} ${f2(L * 0.1)}Z`;
      put(`<g transform="translate(${f2(px)} ${f2(py)}) rotate(${f2(sd === 1 ? -35 : -145)})"><path d="${d}" fill="${P.sage}" fill-opacity="0.85" filter="url(#wcSmall)"/><path d="${d}" fill="none" stroke="${INK}" stroke-width="0.7" stroke-opacity="0.7" filter="url(#ink)"/></g>`);
    }
  }
  const [hx, hy] = p[3];
  const bulb = blob(hx, hy + 6, 13, 12, 8, 0.08);
  wash(bulb, P.sage, 0.9, 'wcSmall', 0.5);
  ink(bulb, 0.8, 0.8);
  for (let i = -3; i <= 3; i++) ink(seg(hx - 10, hy + i * 3 + 6, hx + 10, hy - i * 3 + 6), 0.4, 0.35);
  for (let i = 0; i < 22; i++) {
    const a = -90 + rr(-55, 55), L = rr(16, 26);
    const x0 = hx + rr(-8, 8), y0 = hy - 4;
    const d = `M${f2(x0)} ${f2(y0)} L${f2(x0 + Math.cos(rad(a)) * L)} ${f2(y0 + Math.sin(rad(a)) * L)}`;
    put(`<path d="${d}" stroke="${pick([P.plum, P.plumDk, P.raspLt])}" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.9" filter="url(#wcSmall)"/>`);
    if (i % 2) ink(d, 0.5, 0.6);
  }
}
function hollyhocks() {
  out.length = 0;
  seed(88);
  // rock
  const rock = blob(110, 790, 90, 50, 9, 0.18);
  wash(rock, P.rock, 0.8, 'wcWall');
  wash(blob(85, 775, 50, 26, 8, 0.2), P.rockDk, 0.4, 'wcSky', 0);
  ink(rock, 1, 0.6, true);
  spike(300, 840, 70, -20);
  spike(180, 840, 170, 20);
  spike(400, 840, 250, -15);
  thistle(470, 840, 470);
  // agave-like clump at the base
  for (let i = 0; i < 26; i++) {
    const a = -90 + rr(-75, 75), L = rr(60, 150), x0 = rr(200, 420);
    const p = arc(x0, 846, a, L, (a > -90 ? 1 : -1) * rr(5, 25));
    wash(ribbon(p, rr(9, 13), 0.6), pick([P.leafDk, P.olive, P.sage, P.teal]), 0.88, 'wcSmall', 1);
    if (i % 2) ink(bezD(p), 0.6, 0.55, true);
  }
  butterfly(110, 470, 0.4, -20, P.mari, P.raspDk);
  return svgDoc(520, 860, out.join(''));
}

function poppyBud(x, y, r, ang) {
  const d = `M0 0 C${f2(r * 0.2)} ${f2(-r * 0.75)} ${f2(r * 1.7)} ${f2(-r * 0.85)} ${f2(r * 2.1)} 0 C${f2(r * 1.7)} ${f2(r * 0.85)} ${f2(r * 0.2)} ${f2(r * 0.75)} 0 0Z`;
  put(`<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(ang)})"><path d="${d}" fill="${P.sage}" fill-opacity="0.9" filter="url(#wcLeaf)"/><path d="M${f2(r * 1.2)} ${f2(-r * 0.15)} C${f2(r * 1.5)} ${f2(-r * 0.55)} ${f2(r * 2)} ${f2(-r * 0.35)} ${f2(r * 2.05)} 0 C${f2(r * 1.8)} ${f2(r * 0.2)} ${f2(r * 1.4)} ${f2(r * 0.15)} ${f2(r * 1.2)} ${f2(-r * 0.15)}Z" fill="${P.coral}" fill-opacity="0.75" filter="url(#wcSmall)"/><path d="${d}" fill="none" stroke="${INK}" stroke-width="0.9" stroke-opacity="0.8" filter="url(#ink)"/><path d="M${f2(r * 0.3)} 0 C${f2(r * 0.8)} ${f2(r * 0.2)} ${f2(r * 1.4)} ${f2(r * 0.15)} ${f2(r * 1.9)} 0" stroke="${INK}" stroke-width="0.6" stroke-opacity="0.5" fill="none" filter="url(#ink)"/></g>`);
}
// ===================== INK ORNAMENTS =====================
// Same hand as the building: ink line, wash slipping off the line.
function inkCosmos(x, y, r, tilt = 0) {
  const n = 8, cols = [P.pink, P.pinkLt, P.blushW];
  const pet = [];
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + tilt + rr(-7, 7), L = r * rr(0.88, 1.05), w = r * 0.42;
    const d = `M0 0 C${f2(L * 0.3)} ${f2(-w * 0.5)} ${f2(L * 0.75)} ${f2(-w * 0.62)} ${f2(L * 0.96)} ${f2(-w * 0.45)} L${f2(L)} ${f2(-w * 0.1)} L${f2(L * 0.97)} ${f2(w * 0.3)} L${f2(L * 0.9)} ${f2(w * 0.5)} C${f2(L * 0.7)} ${f2(w * 0.6)} ${f2(L * 0.3)} ${f2(w * 0.5)} 0 0Z`;
    pet.push([a, d]);
  }
  for (const [a, d] of pet) put(`<g transform="translate(${f2(x + rr(-2, 2))} ${f2(y + rr(-2, 2))}) rotate(${f2(a)})"><path d="${d}" fill="${pick(cols)}" fill-opacity="0.8" filter="url(#wcPetal)"/></g>`);
  for (const [a, d] of pet) put(`<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(a)})"><path d="${d}" fill="none" stroke="${INK}" stroke-width="0.9" stroke-opacity="0.8" stroke-dasharray="${f2(rr(30, 60))} ${f2(rr(2, 5))}" filter="url(#ink)"/><path d="M${f2(r * 0.2)} 0 L${f2(r * 0.7)} ${f2(-r * 0.04)} M${f2(r * 0.25)} ${f2(r * 0.06)} L${f2(r * 0.6)} ${f2(r * 0.1)}" stroke="${INK}" stroke-width="0.5" stroke-opacity="0.4" filter="url(#ink)"/></g>`);
  wash(blob(x, y, r * 0.2, r * 0.2, 7, 0.15), P.butter, 0.95, 'wcSmall', 0.5);
  for (let i = 0; i < 10; i++) put(`<circle cx="${f2(x + rr(-r, r) * 0.17)}" cy="${f2(y + rr(-r, r) * 0.17)}" r="0.9" fill="${INK}" fill-opacity="0.7"/>`);
}
function inkPoppy(x, y, r, tilt = 0) {
  const pet = [];
  for (let i = 0; i < 4; i++) {
    const a = i * 90 + tilt + rr(-12, 12), L = r * rr(0.85, 1), w = L * 1.1, k = rr(-0.1, 0.1);
    pet.push([a, `M0 0 C${f2(L * 0.1)} ${f2(-w * 0.55)} ${f2(L * 0.8)} ${f2(-w * (0.7 + k))} ${f2(L * 0.98)} ${f2(-w * 0.12)} C${f2(L * 1.02)} ${f2(w * 0.1)} ${f2(L * 0.9)} ${f2(w * 0.25)} ${f2(L * 0.95)} ${f2(w * 0.3)} C${f2(L * 0.75)} ${f2(w * (0.7 - k))} ${f2(L * 0.1)} ${f2(w * 0.55)} 0 0Z`]);
  }
  for (const [a, d] of pet) put(`<g transform="translate(${f2(x + rr(-3, 3))} ${f2(y + rr(-3, 3))}) rotate(${f2(a)})"><path d="${d}" fill="${pick([P.coral, P.coral, P.coralW])}" fill-opacity="0.72" filter="url(#wcPetal)"/></g>`);
  wash(blob(x, y, r * 0.5, r * 0.45, 8, 0.2), P.raspDk, 0.3, 'wcSky', 0);
  for (const [a, d] of pet) put(`<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(a)})"><path d="${d}" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity="0.8" stroke-dasharray="${f2(rr(40, 80))} ${f2(rr(3, 6))}" filter="url(#ink)"/><path d="M${f2(r * 0.15)} 0 Q${f2(r * 0.5)} ${f2(-r * 0.2)} ${f2(r * 0.8)} ${f2(-r * 0.35)} M${f2(r * 0.15)} 0 Q${f2(r * 0.5)} ${f2(r * 0.15)} ${f2(r * 0.8)} ${f2(r * 0.3)}" fill="none" stroke="${INK}" stroke-width="0.5" stroke-opacity="0.4" filter="url(#ink)"/></g>`);
  const pod = blob(x, y, r * 0.14, r * 0.14, 7, 0.1);
  wash(pod, P.sageLt, 0.9, 'wcSmall', 0.5); ink(pod, 0.8, 0.8);
  for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, d = r * rr(0.16, 0.26); put(`<circle cx="${f2(x + Math.cos(a) * d)}" cy="${f2(y + Math.sin(a) * d)}" r="1.1" fill="${INK}" fill-opacity="0.75"/>`); }
}
function inkDaisy(x, y, r, tilt = 0) {
  const n = 13 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + tilt + rr(-5, 5), L = r * rr(0.85, 1.05), w = L * 0.24;
    const d = `M${f2(r * 0.2)} 0 C${f2(L * 0.35)} ${f2(-w * 0.6)} ${f2(L * 0.92)} ${f2(-w * 0.55)} ${f2(L)} 0 C${f2(L * 0.92)} ${f2(w * 0.55)} ${f2(L * 0.35)} ${f2(w * 0.6)} ${f2(r * 0.2)} 0Z`;
    put(`<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(a)})"><path d="${d}" fill="${P.trim}" fill-opacity="0.95" filter="url(#wcWhite)"/><path d="${d}" fill="none" stroke="${INK}" stroke-width="0.8" stroke-opacity="0.75" stroke-dasharray="${f2(rr(20, 40))} ${f2(rr(2, 4))}" filter="url(#ink)"/></g>`);
  }
  wash(blob(x + 1, y + 1, r * 0.28, r * 0.26, 8, 0.12), P.butter, 0.95, 'wcSmall', 0.5);
  ink(blob(x, y, r * 0.27, r * 0.26, 8, 0.1), 0.8, 0.8);
  for (let i = 0; i < 8; i++) put(`<circle cx="${f2(x + rr(-r, r) * 0.18)}" cy="${f2(y + rr(-r, r) * 0.18)}" r="0.8" fill="${INK}" fill-opacity="0.5"/>`);
}
function inkButtercup(x, y, r, tilt = 0) { smallFlower(x, y, r, pick([P.butter, P.butter, P.butterLt])); void tilt; }
function inkBud(x, y, ang, r) {
  const g = (d, fill, op, f) => put(`<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(ang)})"><path d="${d}" fill="${fill}" fill-opacity="${op}" filter="url(#${f})"/></g>`);
  const bud = `M0 0 C${f2(r * 0.4)} ${f2(-r * 0.9)} ${f2(r * 1.6)} ${f2(-r * 0.9)} ${f2(r * 2)} 0 C${f2(r * 1.6)} ${f2(r * 0.9)} ${f2(r * 0.4)} ${f2(r * 0.9)} 0 0Z`;
  g(bud, P.pink, 0.75, 'wcSmall');
  for (const sd of [-1, 1]) g(`M0 0 C${f2(r * 0.5)} ${f2(sd * r * 0.7)} ${f2(r * 1.2)} ${f2(sd * r * 0.6)} ${f2(r * 1.5)} ${f2(sd * r * 0.2)} C${f2(r * 1.1)} ${f2(sd * r * 0.25)} ${f2(r * 0.5)} ${f2(sd * r * 0.1)} 0 0Z`, P.sage, 0.85, 'wcSmall');
  put(`<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(ang)})"><path d="${bud}" fill="none" stroke="${INK}" stroke-width="0.8" stroke-opacity="0.8" filter="url(#ink)"/><path d="M0 0 L${f2(r * 1.5)} ${f2(-r * 0.2)} M0 0 L${f2(r * 1.5)} ${f2(r * 0.2)}" stroke="${INK}" stroke-width="0.6" stroke-opacity="0.6" filter="url(#ink)"/></g>`);
}
function sprigLeaves(p, ts, L, W) {
  ts.forEach((t, i) => {
    const [x, y] = bez(p, t), a = bezTan(p, t), sd = i % 2 ? 1 : -1, k = 1 - t * 0.45;
    leaf(x, y, a + sd * rr(30, 45), L * k, W * k, pick([P.sage, P.olive, P.sageLt]), true, true);
  });
}
function heroSprig() {
  out.length = 0; seed(1201);
  const W = 1200, base = [600, 262];
  // stems for the left half; right half is the same spine, re-rolled
  for (const s of [1, -1]) {
    seed(s === 1 ? 7 : 9);
    const X = (x) => (s === 1 ? x : W - x), A = (a) => (s === 1 ? a : 180 - a), Pm = (pts) => pts.map(([x, y]) => [X(x), y]);
    const st = {
      A: Pm([base, [460, 272], [240, 236], [40, 212]]),
      B: Pm([[598, 250], [540, 180], [440, 118], [340, 104]]),
      C: Pm([[596, 254], [510, 185], [330, 126], [150, 134]]),
      D: Pm([[598, 262], [520, 306], [380, 338], [222, 322]]),
      F: Pm([[600, 256], [562, 232], [522, 216], [484, 206]]),
      G: Pm([[600, 258], [575, 288], [546, 300], [518, 298]]),
      I: Pm([[600, 258], [540, 258], [450, 248], [396, 238]]),
      J: Pm([[600, 250], [588, 160], [532, 70], [476, 70]]),
      K: Pm([[600, 258], [520, 236], [430, 186], [386, 156]]),
    };
    stemLine(st.A, 3.2, 0.6, P.sage); stemLine(st.C, 2.6, 0.7, P.olive); stemLine(st.B, 2.4, 1, P.sage);
    stemLine(st.D, 2.4, 0.8, P.sage); stemLine(st.F, 2.6, 1.4, P.olive); stemLine(st.G, 2.2, 1.2, P.sage);
    stemLine(st.I, 2.2, 1, P.olive); stemLine(st.J, 2.2, 1.1, P.sage); stemLine(st.K, 2.2, 1.1, P.olive);
    sprigLeaves(st.A, [0.1, 0.22, 0.34, 0.47, 0.6, 0.72, 0.84, 0.94], 58, 17);
    sprigLeaves(st.C, [0.3, 0.46, 0.62, 0.78, 0.9], 46, 13);
    sprigLeaves(st.D, [0.24, 0.4, 0.56, 0.72, 0.88], 46, 14);
    sprigLeaves(st.B, [0.4, 0.6, 0.8], 38, 12);
    fern(X(588), 262, A(170), 90, P.sage); fern(X(592), 250, A(-150), 70, P.olive);
    leaf(X(594), 262, A(160), 80, 22, P.sage); leaf(X(596), 254, A(-172), 66, 18, P.olive);
    const tipA = bez(st.A, 1); leaf(tipA[0], tipA[1], A(185), 20, 6, P.sage);
    inkBud(...bez(st.B, 1), A(-168), 9); inkBud(...bez(st.C, 1), A(-175), 8);
    inkBud(...bez(st.J, 1), A(150), 9);
    inkButtercup(...bez(st.A, 0.8), 11); inkButtercup(...bez(st.I, 1), 13); inkButtercup(X(250), 190, 10);
    inkDaisy(...bez(st.A, 0.52), 22, rr(0, 30)); inkDaisy(...bez(st.D, 1), 24, rr(0, 30)); inkDaisy(...bez(st.G, 1), 30);
    inkCosmos(...bez(st.K, 1), 36, rr(0, 45)); inkCosmos(...bez(st.F, 1), 50, rr(0, 45));
    smallFlower(X(312), 150, 8, P.pinkLt); smallFlower(X(330), 162, 7, P.pinkLt); smallFlower(X(300), 166, 7, P.pink);
    butterfly(X(430), 300, 0.22, s * 20);
  }
  seed(1202);
  inkButtercup(600, 306, 14);
  inkPoppy(600, 200, 62, rr(0, 90));
  return svgDoc(W, 400, out.join(''));
}
function sectionSprig() {
  out.length = 0; seed(601);
  const main = [[40, 92], [190, 70], [390, 108], [560, 76]];
  stemLine(main, 2.6, 1, P.sage);
  sprigLeaves(main, [0.1, 0.24, 0.4, 0.62, 0.78, 0.9], 36, 11);
  const t1 = arc(...bez(main, 0.3), -100, 40, -15), t2 = arc(...bez(main, 0.66), 75, 26, -15), t3 = arc(...bez(main, 0.82), -80, 28, 25);
  stemLine(t1, 1.6, 0.9, P.sage); stemLine(t2, 1.5, 0.9, P.olive); stemLine(t3, 1.4, 0.8, P.sage);
  inkBud(...bez(main, 1), -20, 7);
  smallFlower(t2[3][0] - 6, t2[3][1] + 4, 7, P.pinkLt); smallFlower(t2[3][0] + 7, t2[3][1], 6, P.pink); smallFlower(t2[3][0], t2[3][1] - 8, 6, P.pinkLt);
  inkButtercup(t3[3][0], t3[3][1], 11);
  inkDaisy(...bez(main, 0.05), 18, 10);
  inkCosmos(t1[3][0] + 4, t1[3][1] + 6, 26, 20);
  inkPoppy(...bez(main, 0.52), 24, 30);
  return svgDoc(600, 150, out.join(''));
}
function singleStemInk() {
  out.length = 0; seed(401);
  const main = [[86, 392], [70, 300], [100, 190], [84, 108]];
  stemLine(main, 3.4, 2, P.sage);
  const side = [bez(main, 0.42), [118, 230], [140, 150], [128, 122]];
  stemLine(side, 2, 1.4, P.olive);
  leaf(84, 384, -128, 70, 16, P.olive); leaf(86, 384, -58, 62, 14, P.sage); leaf(82, 372, -100, 52, 12, P.sage);
  sprigLeaves(main, [0.32, 0.55], 40, 10);
  poppyBud(128, 122, 11, 115);
  inkPoppy(84, 84, 52, 8);
  return svgDoc(160, 400, out.join(''));
}

// ===================== SPOTS =====================
function butterflySpot() {
  out.length = 0; seed(12);
  butterfly(120, 100, 1.4, -8);
  return svgDoc(240, 200, out.join(''));
}
function hummingbird() {
  out.length = 0; seed(14);
  const g = (s) => `<g transform="translate(150 125) rotate(-14)">${s}</g>`;
  const body = 'M-70 18 C-50 6 -20 -6 8 -10 C20 -26 44 -26 50 -12 C54 -4 50 6 42 10 C24 20 -10 26 -40 26 C-52 26 -62 24 -70 18Z';
  const tail = 'M-66 16 L-108 4 L-100 16 L-112 26 L-96 30 L-104 40 L-62 26Z';
  const wingA = 'M-14 -8 C-30 -60 -10 -100 30 -112 C24 -80 14 -40 6 -8Z';
  const wingB = 'M-4 -8 C10 -56 40 -84 76 -92 C60 -62 34 -30 14 -6Z';
  const throat = 'M30 4 C38 -4 48 -6 52 -2 C50 6 42 12 30 12Z';
  const belly = 'M-40 22 C-14 14 14 10 30 10 C18 20 -8 26 -40 26Z';
  put(g(`<path d="${wingA}" fill="${P.sageLt}" fill-opacity="0.7" filter="url(#wcLeaf)"/><path d="${wingB}" fill="${P.sage}" fill-opacity="0.75" filter="url(#wcLeaf)"/>`));
  put(g(`<path d="${tail}" fill="${P.oliveDk}" fill-opacity="0.85" filter="url(#wcSmall)"/><path d="${body}" fill="${P.olive}" fill-opacity="0.85" filter="url(#wcPetal)"/><path d="${belly}" fill="${P.cream}" fill-opacity="0.95" filter="url(#wcSmall)"/><path d="${throat}" fill="${P.coral}" fill-opacity="0.95" filter="url(#wcSmall)"/>`));
  put(g(`<path d="M50 -10 L118 -22" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" filter="url(#ink)"/>`));
  put(g(`<path d="${body} ${tail} ${wingA} ${wingB}" fill="none" stroke="${INK}" stroke-width="1.1" stroke-opacity="0.85" stroke-dasharray="120 5 60 4" filter="url(#ink)"/>`));
  put(g(`<path d="M-4 -30 L18 -86 M2 -20 L40 -70 M8 -14 L56 -60 M-8 -40 L4 -96" fill="none" stroke="${INK}" stroke-width="0.6" stroke-opacity="0.5" filter="url(#ink)"/><circle cx="38" cy="-14" r="2.6" fill="${INK}"/><circle cx="39" cy="-15" r="0.8" fill="${P.trim}"/>`));
  return svgDoc(320, 240, out.join(''));
}
function budVase() {
  out.length = 0; seed(19);
  const cx = 120;
  // stems behind glass
  const s1 = [[cx, 330], [cx - 2, 250], [cx - 20, 160], [cx - 40, 110]];
  const s2 = [[cx + 2, 330], [cx + 6, 240], [cx + 30, 140], [cx + 54, 70]];
  stemLine(s1, 2.4, 1.6, P.olive);
  stemLine(s2, 2, 1.2, P.sage);
  // mimosa sprig
  for (let t = 0.45; t <= 1; t += 0.11) {
    const [x, y] = bez(s2, t), sd = Math.round(t / 0.11) % 2 ? 1 : -1;
    const q = arc(x, y, -90 + sd * 50, rr(20, 34), -sd * 20);
    stemLine(q, 1, 0.6, P.sage, false);
    for (let k = 0; k < 6; k++) {
      const px = q[3][0] + rr(-9, 9), py = q[3][1] + rr(-9, 9), r = rr(3, 4.6);
      put(`<circle cx="${f2(px)}" cy="${f2(py)}" r="${f2(r)}" fill="${pick([P.butter, P.butterLt])}" fill-opacity="0.95" filter="url(#wcSmall)"/>`);
      if (k % 2) ink(`M${f2(px - r)} ${f2(py)} a${f2(r)} ${f2(r)} 0 1 0 ${f2(r * 2)} 0`, 0.5, 0.55);
    }
  }
  leaf(cx - 10, 200, -150, 54, 16, P.olive);
  // anthurium
  const [ax, ay] = s1[3];
  const spathe = `M${ax} ${ay} C${ax - 50} ${ay - 10} ${ax - 64} ${ay - 70} ${ax - 30} ${ay - 78} C${ax - 14} ${ay - 82} ${ax - 2} ${ay - 70} ${ax} ${ay - 58} C${ax + 4} ${ay - 72} ${ax + 22} ${ay - 82} ${ax + 36} ${ay - 70} C${ax + 62} ${ay - 48} ${ax + 30} ${ay - 6} ${ax} ${ay}Z`;
  wash(spathe, P.coral, 0.92, 'wcPetal', 1);
  wash(blob(ax - 4, ay - 46, 22, 18, 8, 0.2), P.raspDk, 0.35, 'wcSky', 0);
  ink(spathe, 1.1, 0.85, true);
  ink(`M${ax} ${ay - 4} Q${ax - 4} ${ay - 34} ${ax} ${ay - 58} M${ax} ${ay - 20} Q${ax - 22} ${ay - 30} ${ax - 36} ${ay - 56} M${ax} ${ay - 20} Q${ax + 20} ${ay - 30} ${ax + 30} ${ay - 54}`, 0.6, 0.5);
  const spad = `M${ax} ${ay - 22} Q${ax + 6} ${ay - 44} ${ax + 22} ${ay - 52}`;
  put(`<path d="${spad}" stroke="${P.butterLt}" stroke-width="7" stroke-linecap="round" fill="none" filter="url(#wcSmall)"/>`);
  ink(spad, 0.7, 0.6);
  // glass bud vase
  const vase = `M${cx - 9} 262 L${cx - 9} 284 C${cx - 46} 296 ${cx - 50} 352 ${cx - 30} 366 C${cx - 14} 374 ${cx + 14} 374 ${cx + 30} 366 C${cx + 50} 352 ${cx + 46} 296 ${cx + 9} 284 L${cx + 9} 262Z`;
  wash(vase, P.glass, 0.25, 'wcSky', 0);
  wash(`M${cx - 44} 320 C${cx - 40} 360 ${cx + 40} 360 ${cx + 44} 320 C${cx + 48} 352 ${cx + 30} 370 ${cx} 370 C${cx - 30} 370 ${cx - 48} 352 ${cx - 44} 320Z`, P.glass, 0.45, 'wcSmall', 0.5);
  ink(vase, 1.2, 0.85);
  ink(`M${cx - 12} 262 Q${cx} 258 ${cx + 12} 262 M${cx - 34} 300 Q${cx - 40} 320 ${cx - 34} 344`, 0.8, 0.6);
  ink(seg(cx - 70, 374, cx + 70, 374), 0.8, 0.4);
  return svgDoc(240, 380, out.join(''));
}

// ---------- render ----------
const pieces = [
  ['hero-sprig', heroSprig, 1200, 400, true],
  ['section-ornament', sectionSprig, 600, 150, true],
  ['single-stem', singleStemInk, 160, 400, true],
  ['building', building, 1200, 700, true],
  ['wallpaper-tile-ochre', () => wallpaper(P.ochre), 600, 600, false],
  ['wallpaper-tile-ivory', () => wallpaper(P.ivory), 600, 600, false],
  ['hollyhocks', hollyhocks, 520, 860, true],
  ['butterfly', butterflySpot, 240, 200, true],
  ['hummingbird', hummingbird, 320, 240, true],
  ['bud-vase', budVase, 240, 380, true],
].filter(([n]) => !ONLY.length || ONLY.includes(n));

const browser = await chromium.launch();
for (const [name, fn, w, h, transparent] of pieces) {
  const svg = fn();
  writeFileSync(join(OUT, `${name}.svg`), svg);
  for (const scale of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.screenshot({ path: join(OUT, `${name}${scale === 2 ? '@2x' : ''}.png`), omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
  }
  if (transparent) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#FFFCF6">${svg}</body></html>`);
    await page.screenshot({ path: join(OUT, `_preview-${name}.png`), clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
  }
}
await browser.close();
console.log('done');
