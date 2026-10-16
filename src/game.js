import * as THREE from 'three';
import { START_NG, getCurrentUser, onUserChange, signIn, saveScore, getLeaderboard, guestLook } from './platform.js';
const $ = (id) => document.getElementById(id);
const K = Math.PI; // r160 uses physical light units

/* ---------- start.ng style -> character ---------- */
const DEFAULT_STYLE = { body: 'male', primaryColor: '#0b7a3b', secondaryColor: '#2b2f4a', skinColor: '#8a5634', hairColor: '#17100d', hair: 'short', hat: 'none', accessory: 'none' };
const BODIES = ['female', 'male'], HAIRS = ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'];
const HATS = ['none', 'cap', 'beanie', 'tophat', 'crown'], ACCS = ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function normStyle(s) { // unknown or missing values fall back to defaults
  const o = { ...DEFAULT_STYLE };
  if (s && typeof s === 'object') {
    for (const k of ['primaryColor', 'secondaryColor', 'skinColor', 'hairColor']) if (HEX.test(s[k] || '')) o[k] = s[k];
    if (BODIES.includes(s.body)) o.body = s.body;
    if (HAIRS.includes(s.hair)) o.hair = s.hair;
    if (HATS.includes(s.hat)) o.hat = s.hat;
    if (ACCS.includes(s.accessory)) o.accessory = s.accessory;
  }
  return o;
}
const ink = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.18 ? '#111' : '#fff'; };
function styleUI(st) {
  const r = document.documentElement.style;
  r.setProperty('--sng-primary', st.primaryColor); r.setProperty('--sng-accent', st.secondaryColor);
  r.setProperty('--primary-ink', ink(st.primaryColor)); r.setProperty('--accent-ink', ink(st.secondaryColor));
}

/* ---------- three.js world ---------- */
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .1, 200);
const ren = new THREE.WebGLRenderer({ antialias: true });
ren.setPixelRatio(Math.min(devicePixelRatio, 2)); ren.setSize(innerWidth, innerHeight);
ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(ren.domElement);
const hemi = new THREE.HemisphereLight(0xffffff, 0x887766, .9 * K); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, .7 * K); sun.position.set(14, 24, 10); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 70 }); scene.add(sun);
scene.fog = new THREE.Fog(0xbfe3f2, 45, 100);
const L = (c) => new THREE.MeshLambertMaterial({ color: c });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), L(0xd9d2bd)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
[[60, 4], [4, 60]].forEach(([w, d]) => { const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), L(0x3a3a3a)); r.rotation.x = -Math.PI / 2; r.position.y = .02; r.receiveShadow = true; scene.add(r); });
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function groundColor() { ground.material.color.set(css('--ground') || '#d9d2bd'); }
const winMat = new THREE.MeshBasicMaterial({ color: 0xffd36b });
function label(txt) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = 'rgba(17,17,17,.8)'; g.fillRect(0, 0, 1024, 192); g.fillStyle = '#fff'; g.font = '700 76px sans-serif'; g.textAlign = 'center'; g.fillText(txt, 512, 124, 980);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t })); s.scale.set(5.2, .98, 1); return s;
}
const LOC = [
  { name: 'Face-me-I-face-you (Home)', x: -14, z: -10, c: 0x9a7b5a, act: 'Rest & freshen up', fx: { energy: 60, hygiene: 50, bladder: 80 }, t: 'Slept, showered, sorted.' },
  { name: 'Mama Put Buka', x: 12, z: -10, c: 0xd9722b, act: 'Eat jollof (₦1,500)', cost: 1500, fx: { hunger: 55, social: 10 }, t: 'Jollof and plantain. Sweet.' },
  { name: 'Yaba Tech Hub', x: 0, z: 12, c: 0x3b6ea5, act: 'Work a shift (+₦4,000)', work: 4000, t: 'Shift done. Money dey enter.' },
  { name: 'Balogun Market', x: 16, z: 14, c: 0xb5405a, act: 'Hustle trade (₦800)', cost: 800, gamble: 1 },
  { name: 'Landmark Beach Club', x: -16, z: 14, c: 0xe0b84c, act: 'Hang out (₦1,000)', cost: 1000, fx: { fun: 50, social: 45 }, t: 'Good vibes, plenty gist.' },
];
LOC.forEach((l) => {
  const g = new THREE.Group(); g.position.set(l.x, 0, l.z);
  const b = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), L(l.c)); b.position.y = 2; b.castShadow = b.receiveShadow = true; g.add(b);
  const rf = new THREE.Mesh(new THREE.BoxGeometry(6.6, .4, 6.6), L(0x2b2b2b)); rf.position.y = 4.2; rf.castShadow = true; g.add(rf);
  for (let i = -1; i <= 1; i += 2) for (let j = 0; j < 2; j++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), winMat); w.position.set(i * 1.5, 1.6 + j * 1.5, 3.01); g.add(w); }
  const dr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2), L(0x2a1a10)); dr.position.set(0, 1, 3.02); g.add(dr); scene.add(g);
  const s = label(l.name); s.position.set(l.x, 6.4, l.z); scene.add(s);
});
[[-8, -6], [8, -5], [-9, 6], [9, 7], [-22, -18], [22, -20], [24, 6], [-24, 4], [6, 22], [-6, 24], [20, 24], [-22, 24]].forEach(([x, z]) => {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.2, .3, 1.6, 8), L(0x5a3b22)); t.position.set(x, .8, z); t.castShadow = true;
  const k = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 10), L(0x2f7d3a)); k.position.set(x, 2.5, z); k.castShadow = true; scene.add(t, k);
});
const danfos = [];
for (let i = 0; i < 6; i++) {
  const g = new THREE.Group(), add = (geo, m, x, y) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, 0); o.castShadow = true; g.add(o); };
  add(new THREE.BoxGeometry(3, 1.3, 1.4), L(0xf2b705), 0, 1); add(new THREE.BoxGeometry(3.02, .3, 1.42), L(0x111111), 0, 1); add(new THREE.BoxGeometry(1.6, .7, 1.2), L(0xcfe8f5), -.2, 1.9);
  const alongX = i < 3, v = (i % 2 ? 1 : -1) * (5 + i), lane = v > 0 ? 1 : -1;
  g.position.set(alongX ? -28 + i * 18 : lane, 0, alongX ? lane : -20 + (i - 3) * 20); if (!alongX) g.rotation.y = Math.PI / 2;
  g.userData = { alongX, v }; scene.add(g); danfos.push(g);
}

/* ---------- character: every part is driven by the start.ng style ---------- */
function makeAvatar() { // slim, realistic proportions like the start.ng character (about 1.8 m, scaled up for the map)
  const g = new THREE.Group(), root = new THREE.Group(), headG = new THREE.Group(); root.scale.setScalar(1.35); g.add(root);
  headG.position.y = 1.68; headG.scale.setScalar(.27); headG.scale.y = .32; root.add(headG); // old head-space coordinates (head centre y=2.1, r=.42)
  const M = () => new THREE.MeshLambertMaterial();
  const m = { body: M(), skin: M(), hair: M(), acc: M(), dark: L(0x151515), gold: L(0xf2c14e) };
  const add = (geo, mt, x, y, z, fn, p = root) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); o.castShadow = true; fn && fn(o); p.add(o); return o; };
  const Cy = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s), Sp = (r, ...a) => new THREE.SphereGeometry(r, 16, 10, ...a), Bx = (a, b, c) => new THREE.BoxGeometry(a, b, c);
  const P = {}, grp = (n, p = headG) => { const h = new THREE.Group(); h.visible = false; p.add(h); return (P[n] = h); };
  const H = (geo, mt, x, y, z, fn, p = headG) => add(geo, mt, x, y - 2.1, z, fn, p); // place a part in head space using the old coordinates
  headG.scale.set(.27, .27, .27);
  // body: top, sleeves, forearms, neck, shoes
  add(Cy(.24, .2, .64, 16), m.body, 0, 1.18, 0, (o) => o.scale.z = .62);
  [-1, 1].forEach((d) => { add(Cy(.078, .07, .32, 10), m.body, d * .31, 1.36, 0, (o) => o.rotation.z = d * .08);
    add(Cy(.055, .048, .46, 10), m.skin, d * .335, 1.0, 0); add(Sp(.05), m.skin, d * .34, .76, 0);
    add(Bx(.14, .07, .26), m.dark, d * .12, .035, .05); });
  add(Cy(.05, .055, .14, 10), m.skin, 0, 1.55, 0);
  H(Sp(.42), m.skin, 0, 2.1, 0); [-.15, .15].forEach((x) => H(Sp(.05), m.dark, x, 2.15, .38));
  let h = grp('male', root); [-1, 1].forEach((d) => add(Cy(.1, .085, .9, 10), m.acc, d * .12, .5, 0, null, h)); add(Bx(.4, .14, .24), m.acc, 0, .86, 0, null, h); // trousers
  h = grp('female', root); add(Cy(.22, .34, .5, 18), m.acc, 0, .78, 0, null, h); [-1, 1].forEach((d) => add(Cy(.065, .055, .55, 10), m.skin, d * .1, .28, 0, null, h)); // skirt + legs
  const dome = (p) => H(Sp(.45, 0, 6.3, 0, 1.3), m.hair, 0, 2.15, 0, null, p);
  h = grp('short'); dome(h);
  h = grp('afro'); H(Sp(.62), m.hair, 0, 2.3, 0, null, h);
  h = grp('bun'); dome(h); H(Sp(.2), m.hair, 0, 2.68, -.05, null, h);
  h = grp('ponytail'); dome(h); H(Cy(.1, .06, .7, 8), m.hair, 0, 1.95, -.5, (o) => o.rotation.x = -.4, h);
  h = grp('braids'); dome(h); [-.38, -.19, .19, .38].forEach((x) => H(Cy(.05, .05, .8, 6), m.hair, x, 1.85, -.25, null, h));
  h = grp('dreads'); dome(h); [-.4, -.2, 0, .2, .4].forEach((x) => H(Cy(.07, .07, .7, 6), m.hair, x, 1.9, -.3, null, h));
  h = grp('cap'); H(Sp(.47, 0, 6.3, 0, 1.57), m.acc, 0, 2.15, 0, null, h); H(Bx(.5, .06, .5), m.acc, 0, 2.38, .5, null, h);
  h = grp('beanie'); H(Sp(.48, 0, 6.3, 0, 1.75), m.acc, 0, 2.15, 0, null, h); H(Sp(.12), m.body, 0, 2.7, 0, null, h);
  h = grp('tophat'); H(Cy(.65, .65, .06, 20), m.dark, 0, 2.48, 0, null, h); H(Cy(.38, .38, .7, 16), m.dark, 0, 2.83, 0, null, h); H(Cy(.39, .39, .12, 16), m.acc, 0, 2.62, 0, null, h);
  h = grp('crown'); H(Cy(.42, .38, .3, 12), m.gold, 0, 2.6, 0, null, h); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; H(new THREE.ConeGeometry(.08, .28, 6), m.gold, Math.cos(a) * .38, 2.88, Math.sin(a) * .38, null, h); }
  h = grp('glasses'); [-.16, .16].forEach((x) => H(new THREE.TorusGeometry(.1, .025, 6, 12), m.dark, x, 2.15, .4, null, h)); H(Bx(.12, .02, .02), m.dark, 0, 2.15, .41, null, h);
  h = grp('earrings'); [-.43, .43].forEach((x) => H(Sp(.06), m.gold, x, 2.0, 0, null, h));
  h = grp('beard'); H(Bx(.38, .26, .18), m.hair, 0, 1.88, .3, null, h);
  h = grp('scarf', root); add(new THREE.TorusGeometry(.12, .045, 8, 16), m.acc, 0, 1.52, 0, (o) => o.rotation.x = Math.PI / 2, h);
  h = grp('backpack', root); add(Bx(.4, .5, .2), m.acc, 0, 1.2, -.27, null, h);
  g.userData = { m, P }; return g;
}
function applyStyle(g, st) { // primary = top, secondary = trousers/skirt (and hat, scarf, backpack trim)
  const { m, P } = g.userData;
  m.body.color.set(st.primaryColor); m.acc.color.set(st.secondaryColor); m.skin.color.set(st.skinColor); m.hair.color.set(st.hairColor);
  const covered = ['cap', 'beanie', 'tophat'].includes(st.hat);
  for (const k in P) P[k].visible = k === st.body || k === st.hat || k === st.accessory || (k === st.hair && !covered);
}
const tagFor = (name) => { const t = label(name); t.scale.set(2.6, .5, 1); t.position.y = 3.3; return t; };

/* ---------- state, identity, scores ---------- */
const NEEDS = ['hunger', 'energy', 'fun', 'social', 'hygiene', 'bladder'];
const RATE = { hunger: .25, energy: .18, fun: .22, social: .2, hygiene: .14, bladder: .3 };
const GOALS = [['work', 'Work a shift'], ['eat', 'Eat a meal'], ['social', 'Hang out']];
const sid = Math.random().toString(36).slice(2);
const me = { avatar: makeAvatar(), x: 0, z: 3, slow: 0, dark: 0, horn: 0, id: 'guest', name: 'Guest', signed: false, style: normStyle(), best: 0 };
scene.add(me.avatar); applyStyle(me.avatar, me.style);
const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1.05, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .04; me.avatar.add(ring); // marks you
let started = false, target = null, near = null, bc = null; const keys = {}, others = {};
const lagosNow = () => new Date(Date.now() + 3600e3); // WAT = UTC+1, no DST
function nextRent() {
  const n = lagosNow(), d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 9));
  d.setUTCDate(d.getUTCDate() + ((6 - n.getUTCDay() + 7) % 7)); if (d <= n) d.setUTCDate(d.getUTCDate() + 7); return d.getTime() - 3600e3;
}
const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
const save = () => jset('chl:' + me.id, { naira: me.naira, earned: me.earned, needs: me.needs, xp: me.xp, goals: me.goals, streak: me.streak, day: me.day });
function setIdentity(u) { // u = { id, name, style } from start.ng, or null for guest
  if (started) save();
  Object.assign(me, { naira: 20000, earned: 0, needs: { hunger: 70, energy: 80, fun: 60, social: 50, hygiene: 70, bladder: 80 }, xp: 0, goals: {}, streak: 0, day: '', sent: 0, sentAt: 0 },
    jget('chl:' + (u ? u.id : 'guest'), {}), { id: u ? String(u.id) : 'guest', name: u?.name || 'Guest', signed: !!u });
  me.rentDue = nextRent(); me.style = normStyle(u ? u.style : guestLook()?.style); applyStyle(me.avatar, me.style); styleUI(me.style);
  if (me.tag) me.avatar.remove(me.tag); me.tag = tagFor(me.name); me.avatar.add(me.tag);
  $('who').textContent = me.signed ? me.name + ' · start.ng' : 'Guest (scores saved on this device)';
  const today = lagosNow().toISOString().slice(0, 10), yest = new Date(lagosNow() - 864e5).toISOString().slice(0, 10);
  if (me.day !== today) { me.streak = me.day === yest ? me.streak + 1 : 1; me.day = today; me.goals = {}; const bn = Math.min(500 * me.streak, 3000); earn(bn); setTimeout(() => toast('Day ' + me.streak + ' streak! +₦' + bn.toLocaleString()), 600); }
  submit(); hud();
}
function sendScore() { if (me.signed && me.earned > me.sent && Date.now() - me.sentAt > 10000) { me.sent = me.earned; me.sentAt = Date.now(); saveScore({ earned: Math.floor(me.earned) }); } }
function submit() { sendScore(); // best score = total ₦ earned; one entry per user id
  const b = jget('chl:board', []), old = b.find((e) => e.id === me.id); me.best = Math.max(old?.score || 0, me.earned);
  const nb = b.filter((e) => e.id !== me.id).concat({ id: me.id, name: me.name, score: me.best }).sort((a, c) => c.score - a.score).slice(0, 10); jset('chl:board', nb);
  localBoard = '<b>Top hustlers</b> <small>(this device)</small><ol>' + nb.map((e) => `<li>${e.name.replace(/[<&]/g, '')}: ₦${e.score.toLocaleString()}</li>`).join('') + '</ol>';
}
let localBoard = '';
const earn = (n) => { me.naira += n; me.earned += n; };
const lvl = () => Math.floor(Math.sqrt(me.xp / 60)) + 1;
function toast(t) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; clearTimeout(toast.h); toast.h = setTimeout(() => e.style.opacity = 0, 2200); }
function pop(t) { const e = document.createElement('div'); e.className = 'pop'; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 1400); }
function hud() {
  $('naira').textContent = '₦' + me.naira.toLocaleString(); $('clock').textContent = lagosNow().toISOString().substr(11, 5) + ' WAT';
  const ms = Math.max(0, me.rentDue - Date.now()); $('rent').textContent = 'Rent ₦15,000 in ' + Math.floor(ms / 864e5) + 'd ' + Math.floor(ms % 864e5 / 36e5) + 'h';
  $('lvl').textContent = 'Hi ' + me.name + ' · Level ' + lvl() + ' · ' + me.streak + '-day streak · Best ₦' + me.best.toLocaleString();
  $('goals').innerHTML = GOALS.map((g) => (me.goals[g[0]] ? '✅ ' : '⬜ ') + g[1]).join('<br>');
  NEEDS.forEach((n) => { const b = $('b-' + n); b.style.width = me.needs[n] + '%'; b.className = me.needs[n] < 25 ? 'low' : ''; });
}
function after(l) {
  const L0 = lvl(); me.xp += l.work ? 30 : 10;
  const k = l.work ? 'work' : l.fx?.hunger ? 'eat' : l.fx?.social >= 40 ? 'social' : null;
  if (k && !me.goals[k]) { me.goals[k] = 1; earn(2000); me.xp += 15; pop('Goal done +₦2,000'); if (GOALS.every((g) => me.goals[g[0]])) { earn(5000); me.xp += 50; setTimeout(() => pop('All daily goals! +₦5,000'), 700); } }
  if (lvl() > L0) setTimeout(() => toast('Level up! Level ' + lvl() + ': shifts pay more'), 900);
}
function doAct() {
  const l = near; if (!l || !started) return;
  if (l.cost && me.naira < l.cost) return toast('Not enough ₦');
  if (l.work) { if (me.needs.hunger < 20 || me.needs.energy < 20) return toast('Too hungry or tired to work'); const pay = Math.round(l.work * (1 + .1 * (lvl() - 1))); earn(pay); pop('+₦' + pay.toLocaleString()); me.needs.energy -= 25; me.needs.hunger -= 15; me.needs.fun -= 10; }
  if (l.cost) me.naira -= l.cost;
  let msg = l.t;
  if (l.gamble) { const w = Math.random() < .55, g = w ? Math.round(800 * (1.4 + Math.random() * 1.2)) : 0; earn(g); msg = w ? 'Good market day! Profit ₦' + (g - 800).toLocaleString() : 'Market no gentle today. Lost ₦800'; pop(w ? '+₦' + g.toLocaleString() : '-₦800'); }
  for (const k in (l.fx || {})) me.needs[k] = Math.min(100, me.needs[k] + l.fx[k]);
  NEEDS.forEach((n) => me.needs[n] = Math.max(0, me.needs[n])); toast(msg); after(l); save(); submit(); hud();
}
function events() {
  if (Math.random() > .025) return; const r = Math.random();
  if (r < .4) { me.slow = Date.now() + 20000; toast('Go-slow on Third Mainland! You move slower for 20s'); }
  else if (r < .7) { me.dark = Date.now() + 20000; toast('NEPA took light! Lights out for 20s'); }
  else { me.needs.social = Math.min(100, me.needs.social + 15); pop('Gist alert: +social'); }
}
function dayNight() {
  const n = lagosNow(), h = n.getUTCHours() + n.getUTCMinutes() / 60, d = Math.min(1, Math.max(0, Math.sin((h - 6) / 13 * Math.PI)) * 1.4), dk = me.dark > Date.now();
  const c = new THREE.Color(0x0a1226).lerp(new THREE.Color(css('--sky') || '#bfe3f2'), d); scene.background = c; scene.fog.color = c;
  hemi.intensity = (.5 + .5 * d) * (dk ? .5 : 1) * K; sun.intensity = (.08 + .7 * d) * K; winMat.color.set(dk ? 0x222a33 : d > .5 ? 0x6f8fa8 : 0xffd36b); groundColor();
}
function tick() {
  if (!started) return;
  NEEDS.forEach((n) => me.needs[n] = Math.max(0, me.needs[n] - RATE[n]));
  if (Date.now() >= me.rentDue) { me.naira -= 15000; toast('Rent day! ₦15,000 paid' + (me.naira < 0 ? ' (you are in debt)' : '')); me.rentDue = nextRent(); }
  events(); dayNight(); save(); submit(); hud();
  for (const k in others) if (Date.now() - others[k].t > 3000) { scene.remove(others[k].g); delete others[k]; }
}
/* presence across tabs of the same browser (a real backend is the next step) */
function broadcast() { bc?.postMessage({ sid, name: me.name, x: me.x, z: me.z, style: me.style }); }
function peer(d) {
  if (!d || d.sid === sid) return; let o = others[d.sid];
  if (!o) { o = { g: makeAvatar(), name: d.name }; o.g.position.set(d.x, 0, d.z); scene.add(o.g); others[d.sid] = o; }
  if (o.name !== d.name || !o.tag) { if (o.tag) o.g.remove(o.tag); o.tag = tagFor(d.name || 'Player'); o.g.add(o.tag); o.name = d.name; }
  applyStyle(o.g, normStyle(d.style)); o.x = d.x; o.z = d.z; o.t = Date.now();
}

/* ---------- start / sign-in flow ---------- */
function buildHud() { NEEDS.forEach((n) => { const d = document.createElement('div'); d.className = 'n'; d.innerHTML = '<label>' + n + '</label><div class="bar"><i id="b-' + n + '"></i></div>'; $('needs').append(d); }); }
function begin(u) {
  if (started) return;
  buildHud(); setIdentity(u); started = true;
  $('gate').style.display = 'none'; $('hud').style.display = 'flex'; $('lbBtn').style.display = 'block';
  toast(u ? 'Welcome, ' + u.name + '!' : 'Playing as Guest');
  try { bc = new BroadcastChannel('city-hustle-lagos'); bc.onmessage = (e) => peer(e.data); } catch { }
  setInterval(broadcast, 250); dayNight(); hud();
}
function button(text, cls, fn) { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = text; b.onclick = fn; $('gbtns').append(b); }
function showGate() {
  $('gbtns').textContent = '';
  if (START_NG) { $('gnote').innerHTML = '<small>Sign in with start.ng to play with your name and your look.</small>'; button('Sign in with start.ng', 'main', signIn); }
  else $('gnote').innerHTML = '<small>Sign-in isn\'t available here (this game isn\'t served from start.ng), so you can play as a guest.</small>';
  button('Play as guest', START_NG ? 'alt' : 'main', () => begin(null));
}
onUserChange((user) => { // player signed in or out on start.ng
  if (!started) { if (user) begin(user); return; }
  if (user && String(user.id) !== me.id) { setIdentity(user); toast('Signed in as ' + user.name); }
  else if (user) { me.style = normStyle(user.style); applyStyle(me.avatar, me.style); styleUI(me.style); }
  else if (me.signed) { setIdentity(null); toast('Signed out on start.ng. You are now Guest.'); }
});
(async () => { groundColor(); if (location.hash.includes('startng_session')) history.replaceState(null, '', location.pathname + location.search);
  const u = START_NG ? await getCurrentUser() : null; if (u) begin(u); else if (new URLSearchParams(location.search).has('guest')) begin(null); else showGate(); })();

/* ---------- input & loop ---------- */
$('act').onclick = doAct; $('lbBtn').onclick = async () => { const e = $('lb'); if (e.style.display === 'block') { e.style.display = 'none'; return; } e.style.display = 'block'; e.innerHTML = localBoard;
  const r = await getLeaderboard(10); if (r?.ok && Array.isArray(r.entries)) e.innerHTML = '<b>Top hustlers</b> <small>(start.ng)</small><ol>' + r.entries.map((x) => `<li>${String(x.name).replace(/[<&]/g, '')}: ₦${Number(x.stats?.earned ?? x.score ?? 0).toLocaleString()}</li>`).join('') + '</ol>'; };
addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = 1; if (e.key === 'e' || e.key === 'Enter') doAct(); target = null; });
addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = 0);
const ray = new THREE.Raycaster();
ren.domElement.addEventListener('pointerdown', (e) => { if (!started) return; ray.setFromCamera({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight * 2 - 1) }, cam); const h = ray.intersectObject(ground)[0]; if (h) target = { x: h.point.x, z: h.point.z }; });
addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); ren.setSize(innerWidth, innerHeight); });
let zoom = 1; // mouse wheel / trackpad zoom
addEventListener('wheel', (e) => { zoom = Math.max(.3, Math.min(1.6, zoom * (1 + e.deltaY * .001))); }, { passive: true });
setInterval(tick, 1000);
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; let len = 0;
  if (started) {
    let dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), dz = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (!dx && !dz && target) { dx = target.x - me.x; dz = target.z - me.z; if (Math.hypot(dx, dz) < .3) target = null; }
    len = Math.hypot(dx, dz);
    if (len > .01) { const sp = 6 * dt * (me.needs.energy < 15 ? .5 : 1) * (me.slow > Date.now() ? .5 : 1); me.x = Math.max(-28, Math.min(28, me.x + dx / len * sp)); me.z = Math.max(-28, Math.min(28, me.z + dz / len * sp)); me.avatar.rotation.y = Math.atan2(dx, dz); }
    near = LOC.find((l) => Math.hypot(l.x - me.x, l.z - me.z) < 6) || null; const a = $('act'); a.style.display = near ? 'block' : 'none'; if (near) a.textContent = near.act;
  }
  me.avatar.position.set(me.x, len > .01 ? Math.abs(Math.sin(now / 90)) * .15 : 0, me.z);
  for (const k in others) { const o = others[k]; o.g.position.x += (o.x - o.g.position.x) * .2; o.g.position.z += (o.z - o.g.position.z) * .2; }
  danfos.forEach((d) => { const u = d.userData, a = u.alongX ? 'x' : 'z'; d.position[a] += u.v * dt; if (d.position[a] > 30) d.position[a] = -30; if (d.position[a] < -30) d.position[a] = 30;
    if (started && Math.hypot(d.position.x - me.x, d.position.z - me.z) < 2 && Date.now() > me.horn) { me.horn = Date.now() + 3000; toast('Danfo horn! Comot for road!'); } });
  cam.position.set(me.x, 11 * zoom, me.z + 6.5 * zoom); cam.lookAt(me.x, 0, me.z - 2.6 * zoom); ren.render(scene, cam); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.__game = { state: () => ({ id: me.id, name: me.name, signed: me.signed, style: me.style, started, earned: me.earned }) }; // read-only, for testing
