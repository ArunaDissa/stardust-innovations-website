/* ============================================================
   STARDUST INNOVATIONS — The Stardust Core
   A living universe. No frameworks, no build step, no trackers.
   ============================================================ */
import * as THREE from "./vendor/three.module.min.js";

/* ---------------- environment ---------------- */
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TOUCH = window.matchMedia("(pointer: coarse)").matches;
const SMALL = Math.min(window.innerWidth, window.innerHeight) < 720;
const HERO_N = REDUCED ? 4000 : SMALL ? 6500 : 13000;
const STAR_N = SMALL ? 2600 : 6000;

/* ---------------- tiny tween engine ---------------- */
const tweens = [];
const Ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  smooth: (t) => t * t * (3 - 2 * t),
};
function tween(dur, onUpdate, { ease = Ease.inOut, delay = 0, onDone } = {}) {
  const tw = { t: -delay, dur, onUpdate, ease, onDone, dead: false };
  tweens.push(tw);
  return tw;
}
function stepTweens(dt) {
  for (const tw of tweens) {
    if (tw.dead) continue;
    tw.t += dt;
    if (tw.t < 0) continue;
    const p = Math.min(tw.t / tw.dur, 1);
    tw.onUpdate(tw.ease(p));
    if (p >= 1) { tw.dead = true; tw.onDone && tw.onDone(); }
  }
  for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].dead) tweens.splice(i, 1);
}

/* ---------------- renderer / scene ---------------- */
const canvas = document.getElementById("scene");
let renderer = null;
let GL_OK = true;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !SMALL, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x030308, 1);
} catch (e) {
  // WebGL unavailable (old device / disabled) — the universe degrades to a
  // simple starmap of buttons; every panel and all content still works.
  GL_OK = false;
  canvas.style.display = "none";
}

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030308, 0.0016);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 900);
const HOME_POS = new THREE.Vector3(0, 5, 132);
camera.position.copy(HOME_POS).setZ(REDUCED ? 132 : 185);
const lookTarget = new THREE.Vector3(0, 0, 0);

/* ---------------- shared glow texture ---------------- */
function glowTexture(inner = "#ffffff", outer = "rgba(120,160,255,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.25, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const softDot = glowTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)");

/* ============================================================
   BACKGROUND STARFIELD (twinkling shader points)
   ============================================================ */
{
  const pos = new Float32Array(STAR_N * 3);
  const col = new Float32Array(STAR_N * 3);
  const phase = new Float32Array(STAR_N);
  const size = new Float32Array(STAR_N);
  const palette = [
    [0.75, 0.85, 1], [1, 1, 1], [0.65, 0.9, 1],
    [1, 0.9, 0.7], [0.8, 0.7, 1], [1, 1, 1],
  ];
  for (let i = 0; i < STAR_N; i++) {
    // spherical shell so stars surround the camera in every direction
    const r = 260 + Math.random() * 420;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.7;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 80;
    const c = palette[(Math.random() * palette.length) | 0];
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    phase[i] = Math.random() * Math.PI * 2;
    size[i] = 1.1 + Math.random() * 2.6 + (Math.random() < 0.04 ? 3 : 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uTex: { value: softDot } },
    vertexShader: `
      attribute vec3 aColor; attribute float aPhase; attribute float aSize;
      uniform float uTime;
      varying vec3 vColor; varying float vTw;
      void main() {
        vColor = aColor;
        vTw = 0.55 + 0.45 * sin(uTime * (0.6 + fract(aPhase) * 1.4) + aPhase * 7.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * vTw * (340.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uTex;
      varying vec3 vColor; varying float vTw;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(vColor, 1.0) * t * (0.5 + 0.6 * vTw);
      }`,
  });
  scene.add(new THREE.Points(geo, mat));
  scene.userData.starMat = mat;
}

/* ============================================================
   NEBULA — procedural fbm shader, far behind everything
   ============================================================ */
{
  const geo = new THREE.PlaneGeometry(1600, 900);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
                   mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main(){
        vec2 p = vUv * 3.0;
        float t = uTime * 0.012;
        float n1 = fbm(p + vec2(t, -t*0.6));
        float n2 = fbm(p * 1.7 - vec2(t*0.7, t));
        float n3 = fbm(p * 0.8 + vec2(-t*0.4, t*0.5) + n1);
        vec3 cyan   = vec3(0.10, 0.55, 0.75);
        vec3 blue   = vec3(0.10, 0.18, 0.55);
        vec3 purple = vec3(0.38, 0.16, 0.60);
        vec3 col = cyan * smoothstep(0.55, 0.95, n1) * 0.5
                 + purple * smoothstep(0.55, 0.95, n2) * 0.45
                 + blue * smoothstep(0.4, 0.9, n3) * 0.5;
        float vign = smoothstep(1.0, 0.25, distance(vUv, vec2(0.5)));
        gl_FragColor = vec4(col * vign * 0.34, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = -380;
  scene.add(mesh);
  scene.userData.nebulaMat = mat;
}

/* ============================================================
   COMETS / SHOOTING STARS
   ============================================================ */
const comets = [];
function spawnComet() {
  const n = 26;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const f = 1 - i / n;
    colors[i * 3] = f; colors[i * 3 + 1] = f * 0.95; colors[i * 3 + 2] = f * 0.85 + 0.15 * f;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
  const line = new THREE.Line(geo, mat);
  const start = new THREE.Vector3((Math.random() - 0.5) * 400, 90 + Math.random() * 90, -160 - Math.random() * 120);
  const vel = new THREE.Vector3(-(24 + Math.random() * 30), -(10 + Math.random() * 12), 0);
  comets.push({ line, pos: start, vel, life: 0, max: 4 + Math.random() * 2, trail: [] });
  scene.add(line);
}
function stepComets(dt) {
  for (let i = comets.length - 1; i >= 0; i--) {
    const c = comets[i];
    c.life += dt;
    c.pos.addScaledVector(c.vel, dt);
    c.trail.unshift(c.pos.clone());
    if (c.trail.length > 26) c.trail.pop();
    const attr = c.line.geometry.getAttribute("position");
    for (let j = 0; j < 26; j++) {
      const p = c.trail[Math.min(j, c.trail.length - 1)];
      attr.setXYZ(j, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
    c.line.material.opacity = Math.min(1, c.life * 2) * Math.max(0, 1 - c.life / c.max);
    if (c.life > c.max) { scene.remove(c.line); c.line.geometry.dispose(); c.line.material.dispose(); comets.splice(i, 1); }
  }
}

/* ============================================================
   HERO PARTICLES — logo / neural / brain / galaxy morphs
   ============================================================ */
const hero = {
  geo: new THREE.BufferGeometry(),
  from: new Float32Array(HERO_N * 3),
  to: new Float32Array(HERO_N * 3),
  colFrom: new Float32Array(HERO_N * 3),
  colTo: new Float32Array(HERO_N * 3),
  delay: new Float32Array(HERO_N),
  wobblePhase: new Float32Array(HERO_N),
  morphStart: -1,
  morphDur: 4,
  targets: {},
  phase: "scatter",
  cycle: ["logo", "neural", "brain", "galaxy"],
  cycleIdx: 0,
  cycleTimer: 0,
  cycling: false,
  opacity: 1,
};
{
  const pos = new Float32Array(HERO_N * 3);
  const col = new Float32Array(HERO_N * 3);
  for (let i = 0; i < HERO_N; i++) {
    // initial scatter: huge sphere around the camera path
    const r = 60 + Math.random() * 260;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) * 0.6;
    col[i * 3] = 0.9; col[i * 3 + 1] = 0.82; col[i * 3 + 2] = 0.6;
    hero.delay[i] = Math.random() * 0.4;
    hero.wobblePhase[i] = Math.random() * Math.PI * 2;
  }
  hero.from.set(pos); hero.to.set(pos);
  hero.colFrom.set(col); hero.colTo.set(col);
  hero.geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  hero.geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  hero.mat = new THREE.PointsMaterial({
    size: 0.52, map: softDot, vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9,
  });
  hero.points = new THREE.Points(hero.geo, hero.mat);
  scene.add(hero.points);
}

/* --- target generators --- */
function targetsFromLogo(img) {
  const c = document.createElement("canvas");
  const W = 300;
  const H = Math.round((img.height / img.width) * W);
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H);
  const data = g.getImageData(0, 0, W, H).data;
  const bright = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const lum = data[i] * 0.4 + data[i + 1] * 0.4 + data[i + 2] * 0.2;
      if (lum > 42) bright.push([x, y, data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, lum / 255]);
    }
  }
  const scale = 48 / W;
  const pos = new Float32Array(HERO_N * 3);
  const col = new Float32Array(HERO_N * 3);
  for (let i = 0; i < HERO_N; i++) {
    const b = bright[(Math.random() * bright.length) | 0];
    pos[i * 3] = (b[0] - W / 2) * scale + (Math.random() - 0.5) * 0.22;
    pos[i * 3 + 1] = (H / 2 - b[1]) * scale + (Math.random() - 0.5) * 0.22 + 2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
    const boost = 0.42 + b[5] * 0.5;
    col[i * 3] = Math.min(1, b[2] * boost + 0.08);
    col[i * 3 + 1] = Math.min(1, b[3] * boost + 0.06);
    col[i * 3 + 2] = Math.min(1, b[4] * boost + 0.05);
  }
  return { pos, col };
}
function targetsLogoFallback() {
  // procedural 4-point star + orbit sweep, in case the logo image fails to load
  const pos = new Float32Array(HERO_N * 3);
  const col = new Float32Array(HERO_N * 3);
  for (let i = 0; i < HERO_N; i++) {
    let x, y;
    if (Math.random() < 0.55) {
      const a = ((Math.random() * 4) | 0) * (Math.PI / 2) + Math.PI / 4;
      const d = Math.pow(Math.random(), 2.2) * 14;
      const w = (1 - d / 14) * 1.4;
      x = Math.cos(a) * d + (Math.random() - 0.5) * w;
      y = Math.sin(a) * d + (Math.random() - 0.5) * w;
    } else {
      const a = Math.random() * Math.PI * 1.4 - 0.4;
      x = Math.cos(a) * 17; y = Math.sin(a) * 7;
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y + 2; pos[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    col[i * 3] = 0.95; col[i * 3 + 1] = 0.8; col[i * 3 + 2] = 0.5;
  }
  return { pos, col };
}
function targetsNeural() {
  const layers = 5, perLayer = 13;
  const nodes = [];
  for (let l = 0; l < layers; l++) {
    for (let n = 0; n < perLayer; n++) {
      const a = (n / perLayer) * Math.PI * 2 + l * 0.5;
      const r = 4 + Math.random() * 11;
      nodes.push([(l - 2) * 11.5, Math.sin(a) * r, Math.cos(a) * r * 0.8, l]);
    }
  }
  const pos = new Float32Array(HERO_N * 3);
  const col = new Float32Array(HERO_N * 3);
  for (let i = 0; i < HERO_N; i++) {
    const nd = nodes[(Math.random() * nodes.length) | 0];
    if (Math.random() < 0.7) {
      pos[i * 3] = nd[0] + (Math.random() - 0.5) * 1.6;
      pos[i * 3 + 1] = nd[1] + (Math.random() - 0.5) * 1.6;
      pos[i * 3 + 2] = nd[2] + (Math.random() - 0.5) * 1.6;
    } else {
      // particles along a random connection
      const nd2 = nodes[(Math.random() * nodes.length) | 0];
      const f = Math.random();
      pos[i * 3] = nd[0] + (nd2[0] - nd[0]) * f;
      pos[i * 3 + 1] = nd[1] + (nd2[1] - nd[1]) * f;
      pos[i * 3 + 2] = nd[2] + (nd2[2] - nd[2]) * f;
    }
    col[i * 3] = 0.35; col[i * 3 + 1] = 0.85; col[i * 3 + 2] = 1.0;
  }
  return { pos, col, nodes };
}
function targetsBrain() {
  const pos = new Float32Array(HERO_N * 3);
  const col = new Float32Array(HERO_N * 3);
  for (let i = 0; i < HERO_N; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    // deeper cortical folds so the silhouette clearly reads as a brain
    let r = 1 + 0.13 * Math.sin(6 * ph) * Math.sin(9 * th) + 0.07 * Math.sin(13 * th + 2 * ph);
    let x = 16 * r * Math.sin(ph) * Math.cos(th);
    let y = 11.5 * r * Math.cos(ph);
    let z = 13 * r * Math.sin(ph) * Math.sin(th);
    x += Math.sign(x) * 1.5; // hemisphere split
    if (y < -6) y *= 0.7;    // flatten base
    if (y < -2 && Math.abs(x) < 5 && z > 6) y -= 3; // hint of a brain stem shadow
    pos[i * 3] = x; pos[i * 3 + 1] = y + 1; pos[i * 3 + 2] = z;
    const f = Math.random();
    // saturated violet with electric synapse sparks
    if (f > 0.93) { col[i * 3] = 0.55; col[i * 3 + 1] = 0.95; col[i * 3 + 2] = 1.0; }
    else { col[i * 3] = 0.42 + f * 0.3; col[i * 3 + 1] = 0.18 + f * 0.16; col[i * 3 + 2] = 0.92; }
  }
  return { pos, col };
}
function targetsGalaxy() {
  // face-on spiral in the x/y plane (the screen plane) so the arms are
  // actually visible; stepHero adds spin and a gentle cinematic tilt
  const pos = new Float32Array(HERO_N * 3);
  const col = new Float32Array(HERO_N * 3);
  for (let i = 0; i < HERO_N; i++) {
    const arm = i % 3;
    const r = 1.2 + Math.pow(Math.random(), 0.6) * 24;
    const a = arm * ((Math.PI * 2) / 3) + r * 0.27 + (Math.random() - 0.5) * (0.65 - r * 0.014);
    const thick = (Math.random() + Math.random() + Math.random() - 1.5) * 1.5 * (1 - r / 30);
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.sin(a) * r * 0.94;
    pos[i * 3 + 2] = thick * 2.2;
    const core = 1 - Math.min(1, r / 24);
    if (core > 0.72) {
      // golden galactic core
      col[i * 3] = 0.98; col[i * 3 + 1] = 0.85; col[i * 3 + 2] = 0.6;
    } else {
      col[i * 3] = 0.45 + core * 0.5;
      col[i * 3 + 1] = 0.58 + core * 0.35;
      col[i * 3 + 2] = 0.95;
    }
  }
  return { pos, col };
}

/* --- neural connection lines (visible during neural phase) --- */
let neuralLines = null;
function buildNeuralLines(nodes) {
  const segs = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let k = 0; k < 2; k++) {
      const j = (Math.random() * nodes.length) | 0;
      if (nodes[j][3] === nodes[i][3] + 1) segs.push(nodes[i], nodes[j]);
    }
  }
  const positions = new Float32Array(segs.length * 3);
  segs.forEach((s, i) => { positions[i * 3] = s[0]; positions[i * 3 + 1] = s[1]; positions[i * 3 + 2] = s[2]; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x3fd0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
  neuralLines = new THREE.LineSegments(geo, mat);
  scene.add(neuralLines);
}

function morphTo(name, dur = 3) {
  const tgt = hero.targets[name];
  if (!tgt) return;
  const posAttr = hero.geo.getAttribute("position");
  hero.from.set(posAttr.array);
  hero.colFrom.set(hero.geo.getAttribute("color").array);
  hero.to.set(tgt.pos);
  hero.colTo.set(tgt.col);
  hero.morphStart = clockT;
  hero.morphDur = dur;
  hero.phase = name;
}
function stepHero() {
  const posAttr = hero.geo.getAttribute("position");
  const colAttr = hero.geo.getAttribute("color");
  const p = posAttr.array, c = colAttr.array;
  const t = hero.morphStart < 0 ? 1 : Math.min((clockT - hero.morphStart) / hero.morphDur, 1);
  const rot = hero.phase === "galaxy" ? clockT * 0.12 : 0;
  const cosR = Math.cos(rot), sinR = Math.sin(rot);
  const TILT_C = Math.cos(0.42), TILT_S = Math.sin(0.42); // cinematic disc tilt
  for (let i = 0; i < HERO_N; i++) {
    const d = hero.delay[i];
    const f = Ease.smooth(Math.max(0, Math.min(1, (t * (1 + d) - d) / 1)));
    const i3 = i * 3;
    let x = hero.from[i3] + (hero.to[i3] - hero.from[i3]) * f;
    let y = hero.from[i3 + 1] + (hero.to[i3 + 1] - hero.from[i3 + 1]) * f;
    let z = hero.from[i3 + 2] + (hero.to[i3 + 2] - hero.from[i3 + 2]) * f;
    if (rot) {
      // spin the disc around its own axis, then tip it toward the camera
      const nx = x * cosR - y * sinR;
      const ny = x * sinR + y * cosR;
      x = nx;
      y = ny * TILT_C - z * TILT_S + 1;
      z = ny * TILT_S + z * TILT_C;
    }
    const w = hero.wobblePhase[i];
    p[i3] = x + Math.sin(clockT * 0.8 + w) * 0.14;
    p[i3 + 1] = y + Math.sin(clockT * 0.6 + w * 1.7) * 0.14;
    p[i3 + 2] = z + Math.cos(clockT * 0.7 + w) * 0.14;
    c[i3] = hero.colFrom[i3] + (hero.colTo[i3] - hero.colFrom[i3]) * f;
    c[i3 + 1] = hero.colFrom[i3 + 1] + (hero.colTo[i3 + 1] - hero.colFrom[i3 + 1]) * f;
    c[i3 + 2] = hero.colFrom[i3 + 2] + (hero.colTo[i3 + 2] - hero.colFrom[i3 + 2]) * f;
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  if (neuralLines) {
    const want = hero.phase === "neural" && t > 0.7 ? 0.32 : 0;
    neuralLines.material.opacity += (want - neuralLines.material.opacity) * 0.04;
    neuralLines.rotation.y = 0;
  }
  // idle cycle
  if (hero.cycling && !REDUCED && state.view === "home") {
    hero.cycleTimer += dtGlobal;
    // the logo is the brand — let it hold much longer than the other shapes
    const hold = hero.cycle[hero.cycleIdx] === "logo" ? 16 : 7;
    if (hero.cycleTimer > hold) {
      hero.cycleTimer = 0;
      hero.cycleIdx = (hero.cycleIdx + 1) % hero.cycle.length;
      morphTo(hero.cycle[hero.cycleIdx], 3.2);
    }
  }
  // fade when inside a zone
  const wantOp = state.view === "zone" ? 0.16 : 1;
  hero.mat.opacity += (wantOp - hero.mat.opacity) * 0.05;
}

/* ============================================================
   ZONES — five star systems
   ============================================================ */
// angles keep the lower-center clear for the hero message
const ZONES = [
  { id: "core", name: "The Core", sub: "our vision", color: 0x6ee7ff, angle: 90 },
  { id: "forge", name: "The Forge", sub: "what we build", color: 0xffd479, angle: 167 },
  { id: "archive", name: "The Archive", sub: "our story", color: 0xc9a2ff, angle: 212 },
  { id: "observatory", name: "The Observatory", sub: "AI research", color: 0x7dffc9, angle: 328 },
  { id: "nexus", name: "The Nexus", sub: "contact", color: 0x8fb4ff, angle: 13 },
];
const labelsBox = document.getElementById("labels");
for (const z of ZONES) {
  z.zJitter = (Math.random() - 0.5) * 14;
  z.pos = new THREE.Vector3();
  const cssColor = "#" + z.color.toString(16).padStart(6, "0");
  // star sprite
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(cssColor, "rgba(0,0,0,0)"),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  spr.position.copy(z.pos);
  spr.scale.setScalar(9);
  scene.add(spr);
  z.sprite = spr;
  // white-hot centre
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softDot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  core.position.copy(z.pos);
  core.scale.setScalar(2.6);
  scene.add(core);
  z.coreSprite = core;
  // tilted ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(5.4, 5.55, 64),
    new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  );
  ring.position.copy(z.pos);
  ring.rotation.x = Math.PI / 2.4;
  ring.rotation.y = (Math.random() - 0.5) * 0.8;
  scene.add(ring);
  z.ring = ring;
  // orbiting mote
  z.moteAngle = Math.random() * Math.PI * 2;
  const mote = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  mote.scale.setScalar(1);
  scene.add(mote);
  z.mote = mote;
  // HTML label
  const el = document.createElement("div");
  el.className = "zlabel";
  el.style.opacity = "0";
  el.innerHTML = `${z.name}<small>${z.sub}</small>`;
  labelsBox.appendChild(el);
  z.label = el;
  z.pulse = Math.random() * Math.PI * 2;
  z.screen = { x: -999, y: -999, visible: false };
}
function layoutZones() {
  // keep every star system on screen whatever the aspect ratio
  const aspect = window.innerWidth / window.innerHeight;
  const xr = aspect < 1 ? 62 * Math.max(aspect * 1.2, 0.52) : 62;
  const yr = aspect < 1 ? 42 : 34;
  HOME_POS.z = aspect < 1 ? 168 : 132;
  for (const z of ZONES) {
    const a = (z.angle * Math.PI) / 180;
    z.pos.set(Math.cos(a) * xr, Math.sin(a) * yr, z.zJitter);
    z.sprite.position.copy(z.pos);
    z.coreSprite.position.copy(z.pos);
    z.ring.position.copy(z.pos);
  }
  if (state.view === "home" && !state.navLock) camera.position.z = HOME_POS.z;
  if (journey.visited.length > 1) drawConstellation();
}
function stepZones(dt) {
  const v = new THREE.Vector3();
  for (const z of ZONES) {
    z.pulse += dt * 1.4;
    const s = 9 + Math.sin(z.pulse) * 1.1 + (z.hot ? 2.4 : 0);
    z.sprite.scale.setScalar(s);
    z.ring.rotation.z += dt * 0.25;
    z.moteAngle += dt * (0.5 + z.color % 7 * 0.04);
    z.mote.position.set(
      z.pos.x + Math.cos(z.moteAngle) * 5.5,
      z.pos.y + Math.sin(z.moteAngle) * 1.6,
      z.pos.z + Math.sin(z.moteAngle) * 5.5 * 0.4
    );
    // project to screen for label + hit test
    v.copy(z.pos).project(camera);
    z.screen.visible = v.z < 1;
    z.screen.x = (v.x * 0.5 + 0.5) * window.innerWidth;
    z.screen.y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    // keep labels readable near screen edges
    const margin = Math.min(96, window.innerWidth * 0.24);
    z.label.style.left = Math.max(margin, Math.min(window.innerWidth - margin, z.screen.x)) + "px";
    z.label.style.top = z.screen.y + 34 + "px";
    z.label.style.opacity = state.view === "home" && state.uiOn && z.screen.visible ? "1" : "0";
  }
}
function fadeInZones() {
  for (const z of ZONES) {
    tween(2, (p) => {
      z.sprite.material.opacity = p;
      z.coreSprite.material.opacity = p * 0.95;
      z.ring.material.opacity = p * 0.4;
      z.mote.material.opacity = p * 0.8;
    }, { delay: Math.random() * 0.8 });
  }
}

/* ============================================================
   JOURNEY MEMORY & CONSTELLATION
   ============================================================ */
const STORE_KEY = "stardust_journey_v1";
let journey = { visited: [], visits: 0, sound: true };
try {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) journey = Object.assign(journey, JSON.parse(raw));
} catch (e) { /* private browsing — memory just won't persist */ }
function saveJourney() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(journey)); } catch (e) {}
}
let constellation = null;
function drawConstellation() {
  if (constellation) { scene.remove(constellation); constellation.geometry.dispose(); constellation.material.dispose(); constellation = null; }
  const pts = journey.visited.map((id) => ZONES.find((z) => z.id === id)).filter(Boolean).map((z) => z.pos);
  if (pts.length < 2) return;
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: 0xe8c47a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
  constellation = new THREE.Line(geo, mat);
  scene.add(constellation);
  tween(2.5, (p) => (mat.opacity = p * 0.38));
}
function markVisited(id) {
  const z = ZONES.find((x) => x.id === id);
  if (z) z.label.classList.add("visited");
  const dot = document.querySelector(`.journey [data-z="${id}"]`);
  if (dot) dot.classList.add("lit");
  if (!journey.visited.includes(id)) {
    journey.visited.push(id);
    saveJourney();
    drawConstellation();
    if (journey.visited.length === ZONES.length) setTimeout(unlockEnding, 1200);
  }
}

/* ============================================================
   ENDING STAR
   ============================================================ */
let endingStar3D = null;
let endingUnlocked = false;
function unlockEnding() {
  if (endingUnlocked) return;
  endingUnlocked = true;
  endingStar3D = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture("#ffe9b8", "rgba(232,150,40,0)"),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  endingStar3D.position.set(0, 44, 0);
  endingStar3D.scale.setScalar(0.1);
  scene.add(endingStar3D);
  tween(3, (p) => { endingStar3D.material.opacity = p; endingStar3D.scale.setScalar(0.1 + p * 7); });
  toast("✦ You have explored every star. A new light has appeared above the core…", 6000);
}
function playEnding() {
  state.view = "ending";
  setHeroTag(false);
  closePanel(true);
  orbChat.classList.remove("open");
  document.getElementById("hud").classList.remove("on");
  const end = document.getElementById("ending");
  end.classList.add("open");
  requestAnimationFrame(() => end.classList.add("lit"));
  const textEl = end.querySelector(".ending-text");
  textEl.textContent = "";
  const words = "Every journey ends where it began.".split(" ");
  words.forEach((w, i) => setTimeout(() => (textEl.textContent += (i ? " " : "") + w), 900 + i * 550));
}
document.getElementById("endingStar").addEventListener("click", () => {
  const end = document.getElementById("ending");
  end.classList.remove("lit");
  setTimeout(() => {
    end.classList.remove("open");
    state.view = "home";
    document.getElementById("hud").classList.add("on");
    camera.position.copy(HOME_POS).setZ(200);
    tweenCamera(HOME_POS, new THREE.Vector3(0, 0, 0), 4);
    morphTo("logo", 3.5);
    hero.cycleTimer = -6;
    setHeroTag(true);
    toast("Welcome back to the beginning ✦", 3200);
  }, 2000);
});

/* ============================================================
   CAMERA NAVIGATION
   ============================================================ */
const state = { view: "intro", zone: null, uiOn: false, navLock: false };
const camPos = camera.position;
const heroTag = document.getElementById("heroTag");
function setHeroTag(show) {
  heroTag.classList.toggle("on", !!show && state.uiOn);
}
document.getElementById("heroCta").addEventListener("click", () => zoomTo("forge"));
function tweenCamera(pos, look, dur = 2.2, onDone) {
  const p0 = camPos.clone(), l0 = lookTarget.clone();
  tween(dur, (t) => {
    camPos.lerpVectors(p0, pos, t);
    lookTarget.lerpVectors(l0, look, t);
  }, { onDone });
}
function zoomTo(id, pushHash = true) {
  const z = ZONES.find((x) => x.id === id);
  if (!z || state.navLock || (state.view === "zone" && state.zone === id)) return;
  if (state.view === "zone") closePanel(true);
  setHeroTag(false);
  if (!GL_OK) {
    state.view = "zone";
    state.zone = id;
    if (pushHash && location.hash !== "#" + id) history.pushState(null, "", "#" + id);
    openPanel(id);
    markVisited(id);
    return;
  }
  state.navLock = true;
  state.view = "traveling";
  state.zone = id;
  if (pushHash && location.hash !== "#" + id) history.pushState(null, "", "#" + id);
  const dir = z.pos.clone().normalize();
  const dest = z.pos.clone().addScaledVector(dir, -0.28 * z.pos.length()).add(new THREE.Vector3(0, 2, 24));
  tweenCamera(dest, z.pos.clone(), REDUCED ? 0.3 : 2.4, () => {
    state.view = "zone";
    state.navLock = false;
    openPanel(id);
    markVisited(id);
  });
  playChime(z.color);
}
function goHome(pushHash = true) {
  if (state.navLock) return;
  closePanel();
  if (pushHash && location.hash) history.pushState(null, "", location.pathname);
  if (!GL_OK) { state.view = "home"; state.zone = null; setHeroTag(true); return; }
  state.navLock = true;
  state.view = "traveling";
  state.zone = null;
  tweenCamera(HOME_POS, new THREE.Vector3(0, 0, 0), REDUCED ? 0.3 : 2, () => {
    state.view = "home";
    state.navLock = false;
    setHeroTag(true);
  });
}
window.addEventListener("popstate", () => {
  const id = location.hash.replace("#", "");
  if (id && ZONES.some((z) => z.id === id)) zoomTo(id, false);
  else if (state.view === "zone" || state.zone) goHome(false);
});

/* ============================================================
   PANELS
   ============================================================ */
let openPanelEl = null;
function openPanel(id) {
  const el = document.getElementById("panel-" + id);
  if (!el) return;
  el.classList.add("open");
  el.setAttribute("aria-hidden", "false");
  el.focus({ preventScroll: true });
  openPanelEl = el;
}
function closePanel(instant) {
  if (!openPanelEl) return;
  openPanelEl.classList.remove("open");
  openPanelEl.setAttribute("aria-hidden", "true");
  openPanelEl = null;
}
document.querySelectorAll(".panel-close").forEach((b) =>
  b.addEventListener("click", () => goHome())
);
document.querySelectorAll(".panel").forEach((p) =>
  p.addEventListener("click", (e) => { if (e.target === p) goHome(); })
);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (orbChat.classList.contains("open")) toggleOrb(false);
    else if (state.view === "zone") goHome();
  }
});
document.getElementById("homeBtn").addEventListener("click", () => {
  if (state.view === "zone") goHome();
});

/* ============================================================
   POINTER — hover, click, parallax
   ============================================================ */
const pointer = { x: -999, y: -999, nx: 0, ny: 0 };
let hotZone = null;
window.addEventListener("pointermove", (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.nx = (e.clientX / window.innerWidth - 0.5) * 2;
  pointer.ny = (e.clientY / window.innerHeight - 0.5) * 2;
  if (!TOUCH) spawnTrail(e.clientX, e.clientY, e.movementX || 0, e.movementY || 0);
  if (state.view === "home" && state.uiOn) {
    let found = null;
    for (const z of ZONES) {
      const dx = z.screen.x - e.clientX, dy = z.screen.y - e.clientY;
      if (z.screen.visible && dx * dx + dy * dy < 62 * 62) { found = z; break; }
    }
    if (found !== hotZone) {
      if (hotZone) { hotZone.hot = false; hotZone.label.classList.remove("hot"); }
      hotZone = found;
      if (hotZone) { hotZone.hot = true; hotZone.label.classList.add("hot"); }
      document.body.style.cursor = found ? "pointer" : "";
    }
  } else if (hotZone) {
    hotZone.hot = false; hotZone.label.classList.remove("hot"); hotZone = null;
    document.body.style.cursor = "";
  }
});
canvas.addEventListener("click", (e) => {
  spawnRipple(e.clientX, e.clientY);
  if (state.view !== "home" || !state.uiOn) return;
  // ending star hit test
  if (endingStar3D) {
    const v = new THREE.Vector3().copy(endingStar3D.position).project(camera);
    const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const dx = sx - e.clientX, dy = sy - e.clientY;
    if (v.z < 1 && dx * dx + dy * dy < 70 * 70) { playEnding(); return; }
  }
  for (const z of ZONES) {
    const dx = z.screen.x - e.clientX, dy = z.screen.y - e.clientY;
    if (z.screen.visible && dx * dx + dy * dy < 62 * 62) { zoomTo(z.id); return; }
  }
});

/* ============================================================
   CURSOR ENERGY FIELD (2D overlay)
   ============================================================ */
const fx = document.getElementById("fx");
const fg = fx.getContext("2d");
let fxW, fxH;
function sizeFx() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  fxW = window.innerWidth; fxH = window.innerHeight;
  fx.width = fxW * dpr; fx.height = fxH * dpr;
  fg.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeFx();
const trail = [];
const ripples = [];
const TRAIL_COLORS = ["232,196,122", "110,231,255", "255,255,255", "167,139,250"];
function spawnTrail(x, y, mx, my) {
  if (REDUCED || trail.length > 220) return;
  for (let i = 0; i < 2; i++) {
    trail.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: -mx * 0.06 + (Math.random() - 0.5) * 0.7,
      vy: -my * 0.06 + (Math.random() - 0.5) * 0.7,
      life: 1,
      r: 0.8 + Math.random() * 1.8,
      c: TRAIL_COLORS[(Math.random() * TRAIL_COLORS.length) | 0],
    });
  }
}
function spawnRipple(x, y) {
  if (REDUCED) return;
  ripples.push({ x, y, r: 4, a: 0.55 });
  // gravity ripple: push nearby dust outward
  for (const p of trail) {
    const dx = p.x - x, dy = p.y - y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d < 190) { const f = (1 - d / 190) * 5; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
  }
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    trail.push({ x, y, vx: Math.cos(a) * (1 + Math.random() * 2.4), vy: Math.sin(a) * (1 + Math.random() * 2.4), life: 1, r: 1 + Math.random() * 1.6, c: TRAIL_COLORS[(Math.random() * TRAIL_COLORS.length) | 0] });
  }
}
function stepFx(dt) {
  fg.clearRect(0, 0, fxW, fxH);
  fg.globalCompositeOperation = "lighter";
  for (let i = trail.length - 1; i >= 0; i--) {
    const p = trail[i];
    p.life -= dt * 1.1;
    if (p.life <= 0) { trail.splice(i, 1); continue; }
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.96; p.vy *= 0.96;
    fg.beginPath();
    fg.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    fg.fillStyle = `rgba(${p.c},${0.55 * p.life})`;
    fg.shadowColor = `rgba(${p.c},0.9)`;
    fg.shadowBlur = 8;
    fg.fill();
  }
  fg.shadowBlur = 0;
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.r += 220 * dt; r.a -= dt * 0.9;
    if (r.a <= 0) { ripples.splice(i, 1); continue; }
    fg.beginPath();
    fg.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    fg.strokeStyle = `rgba(110,231,255,${r.a})`;
    fg.lineWidth = 1.4;
    fg.stroke();
  }
  fg.globalCompositeOperation = "source-over";
}

/* ============================================================
   AMBIENT AUDIO (procedural — no files, nothing downloaded)
   ============================================================ */
let audio = null;
function initAudio() {
  if (audio) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 260;
    filter.connect(master);
    [[55, "sine", 0.5], [110.4, "sine", 0.22], [164.8, "triangle", 0.08]].forEach(([f, t, g]) => {
      const o = ctx.createOscillator();
      o.type = t; o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og); og.connect(filter);
      o.start();
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 90;
    lfo.connect(lfoG); lfoG.connect(filter.frequency);
    lfo.start();
    master.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 6);
    audio = { ctx, master };
  } catch (e) { audio = null; }
}
function playChime(colorHex) {
  if (!audio || audio.ctx.state !== "running") return;
  const { ctx, master } = audio;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.value = 440 + (colorHex % 400);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);
  o.connect(g); g.connect(master.gain.value > 0 ? audio.ctx.destination : master);
  o.start(); o.stop(ctx.currentTime + 1.7);
}
const soundBtn = document.getElementById("soundBtn");
function setSound(on) {
  journey.sound = on;
  saveJourney();
  soundBtn.classList.toggle("off", !on);
  if (!audio) { if (on) initAudio(); return; }
  if (on) audio.ctx.resume();
  else audio.ctx.suspend();
}
soundBtn.addEventListener("click", () => setSound(!(journey.sound && audio && audio.ctx.state === "running")));

/* ============================================================
   TOAST
   ============================================================ */
const toastEl = document.getElementById("toast");
let toastTimer = null;
function toast(msg, ms = 4200) {
  toastEl.textContent = msg;
  toastEl.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("on"), ms);
}

/* ============================================================
   GUIDE ORB — Astra (scripted guide, honestly not an AI… yet)
   ============================================================ */
const orb = document.getElementById("orb");
const orbChat = document.getElementById("orbChat");
const orbLog = document.getElementById("orbLog");
const orbChips = document.getElementById("orbChips");
const orbForm = document.getElementById("orbForm");
const orbInput = document.getElementById("orbInput");
function toggleOrb(open) {
  const willOpen = open ?? !orbChat.classList.contains("open");
  orbChat.classList.toggle("open", willOpen);
  orbChat.setAttribute("aria-hidden", String(!willOpen));
  orb.setAttribute("aria-expanded", String(willOpen));
  if (willOpen && !orbLog.children.length) {
    botSay("Hello, traveler ✦ I'm Astra, keeper of this universe. Each star you see is a world of Stardust Innovations — ask me anything, or pick a path below.");
    renderChips();
  }
  if (willOpen) orbInput.focus();
}
orb.addEventListener("click", () => toggleOrb());
document.getElementById("orbClose").addEventListener("click", () => toggleOrb(false));
function say(text, who) {
  const div = document.createElement("div");
  div.className = "msg " + who;
  div.textContent = text;
  orbLog.appendChild(div);
  orbLog.scrollTop = orbLog.scrollHeight;
  return div;
}
function botSay(text, action) {
  const div = say(text, "bot");
  if (action) {
    const btn = document.createElement("button");
    btn.className = "go";
    btn.textContent = action.label;
    btn.addEventListener("click", () => { toggleOrb(false); action.fn(); });
    div.appendChild(document.createElement("br"));
    div.appendChild(btn);
  }
}
const CHIPS = [
  ["What is Manike?", "manike"],
  ["Show me around", "tour"],
  ["Contact Stardust", "contact"],
  ["What is this place?", "place"],
];
function renderChips() {
  orbChips.innerHTML = "";
  for (const [label, key] of CHIPS) {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", () => { say(label, "user"); respond(key); });
    orbChips.appendChild(b);
  }
}
const RULES = [
  [/manike|dating|match|poruwa|lagna|marriage/i, () =>
    botSay("Manike · මැණිකේ is Sri Lanka's culture-first dating app — Poruwa proposals instead of swipes, Lagna horoscope matching, Parent Mode, Chaperone Mode and NIC verification, all in Sinhala, Tamil and English. It lives in The Forge.", { label: "Visit The Forge 🔥", fn: () => zoomTo("forge") })],
  [/tour|show me|explore|around|start/i, () =>
    botSay("Five stars orbit the core: The Core (our vision), The Forge (our apps), The Archive (our story), The Observatory (AI research) and The Nexus (contact). Visit all five and something special happens…", { label: "Begin at The Core ✦", fn: () => zoomTo("core") })],
  [/contact|email|reach|support|business|partner/i, () =>
    botSay("You can reach Stardust at hello@stardust-innovations.com, support@stardust-innovations.com, or business@stardust-innovations.com. All signals arrive at The Nexus.", { label: "Open The Nexus 🛰", fn: () => zoomTo("nexus") })],
  [/privacy|terms|legal|data/i, () =>
    botSay("Your privacy matters here. This site stores only your exploration constellation, on your own device — nothing is sent anywhere.", { label: "Read the Privacy Policy", fn: () => (location.href = "privacy.html") })],
  [/about|company|who (are|is)|stardust|vision|mission/i, () =>
    botSay("Stardust Innovations is a Sri Lankan technology company crafting premium mobile apps for South Asia and the diaspora — guided by safety first, privacy by design, and genuine value.", { label: "Enter The Core ✦", fn: () => zoomTo("core") })],
  [/\bai\b|artificial|research|future|observat/i, () =>
    botSay("In The Observatory we research culture-aware AI, companion experiences and safety intelligence. When a star there is ready, it moves to The Forge.", { label: "Look through the telescope 🔭", fn: () => zoomTo("observatory") })],
  [/story|history|archive|timeline|founded|journey/i, () =>
    botSay("Our story is written in light — from the first spark to the road ahead. The Archive keeps every chapter.", { label: "Open The Archive 📜", fn: () => zoomTo("archive") })],
  [/constellation|memory|remember|visit/i, () =>
    botSay("As you travel, I connect the stars you've visited into your own constellation — drawn in gold, remembered on this device for your next visit. ✦")],
  [/sound|music|audio|quiet|mute/i, () =>
    botSay("The hum you hear is the universe itself. Use the ♪ button in the top right to silence or awaken it.")],
  [/are you (an? )?(ai|real|robot)|chatgpt|claude/i, () =>
    botSay("Honest answer: I'm a guided spirit — scripted, not yet a true AI. My makers believe in telling you the truth about that. One day I may learn to truly converse. ✦")],
  [/place|website|site|what is this|where am i/i, () =>
    botSay("You're inside The Stardust Core — the living universe of Stardust Innovations. Click any star system to travel to it, or simply drift and watch the stars breathe.")],
  [/hello|hi\b|hey|ayubowan|vanakkam/i, () =>
    botSay("Ayubowan · வணக்கம் · Hello ✦ Lovely to see you among the stars. Where shall we go?")],
  [/thank|great|nice|love|cool|wow/i, () =>
    botSay("✦ The stars shine a little brighter when someone notices. Anything else you'd like to see?")],
];
function respond(text) {
  for (const [re, fn] of RULES) {
    if (re.test(text)) { setTimeout(fn, 450); return; }
  }
  setTimeout(() =>
    botSay("That question is beyond my starlight for now — I'm a humble scripted guide. For anything I can't answer, a human at Stardust surely can.", { label: "Contact a human 📧", fn: () => zoomTo("nexus") }), 450);
}
orbForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = orbInput.value.trim();
  if (!text) return;
  say(text, "user");
  orbInput.value = "";
  respond(text);
});

/* ============================================================
   INTRO SEQUENCE
   ============================================================ */
const enterEl = document.getElementById("enter");
function beginJourney(withSound, fast) {
  enterEl.classList.add("gone");
  if (withSound && journey.sound !== false) { initAudio(); setSound(true); }
  else journey.sound = false;
  journey.visits = (journey.visits || 0) + 1;
  saveJourney();
  state.view = "home";
  if (!GL_OK) {
    buildFallbackStars();
    revealUI(0.4);
    return;
  }
  if (REDUCED || fast) {
    camera.position.copy(HOME_POS);
    morphTo("logo", fast ? 1.2 : 0.2);
    revealUI(0.4);
    return;
  }
  // camera drifts forward while particles assemble into the logo
  tween(6, (t) => { camera.position.z = 185 - t * (185 - HOME_POS.z); }, { ease: Ease.out });
  setTimeout(() => morphTo("logo", 4.2), 700);
  setTimeout(playWords, 5200);
  setTimeout(() => revealUI(1.5), 9800);
}
function playWords() {
  const box = document.getElementById("words");
  const words = ["We", "build", "apps", "that", "matter."];
  box.innerHTML = "";
  const span = document.createElement("span");
  box.appendChild(span);
  words.forEach((w, i) => {
    setTimeout(() => {
      span.className = "";
      void span.offsetWidth; // restart animation
      span.textContent = w;
      span.className = "on";
    }, i * 950);
  });
  setTimeout(() => (box.innerHTML = ""), words.length * 950 + 1600);
}
function buildFallbackStars() {
  const box = document.createElement("div");
  box.className = "fstars";
  for (const z of ZONES) {
    const b = document.createElement("button");
    const cssColor = "#" + z.color.toString(16).padStart(6, "0");
    b.style.setProperty("--fc", cssColor);
    b.innerHTML = `<i>✦</i>${z.name}<small>${z.sub}</small>`;
    b.addEventListener("click", () => zoomTo(z.id));
    box.appendChild(b);
  }
  document.body.appendChild(box);
}
function revealUI(fadeDur) {
  state.uiOn = true;
  document.getElementById("hud").classList.add("on");
  orb.classList.add("on");
  setHeroTag(true);
  if (GL_OK) fadeInZones();
  hero.cycling = true;
  hero.cycleTimer = -4;
  // restore memory of past journeys
  for (const id of journey.visited) markVisited(id);
  drawConstellation();
  if (journey.visited.length === ZONES.length) { endingUnlocked = false; unlockEnding(); }
  if (journey.visits > 1 && journey.visited.length) {
    setTimeout(() => toast(`Welcome back, traveler ✦ your constellation of ${journey.visited.length} star${journey.visited.length > 1 ? "s" : ""} awaits`), 1600);
  } else {
    setTimeout(() => toast("Click a star system to explore ✦"), 1800);
  }
  // deep link (#forge etc.)
  const id = location.hash.replace("#", "");
  if (id && ZONES.some((z) => z.id === id)) setTimeout(() => zoomTo(id, false), 1200);
}
document.getElementById("enterBtn").addEventListener("click", () => beginJourney(true));
document.getElementById("enterQuiet").addEventListener("click", () => beginJourney(false));

/* ============================================================
   LOGO LOADING → hero targets
   ============================================================ */
function transparentLogo(img) {
  // the logo PNG has an opaque black background; key it out so the HUD
  // version floats on the starfield (CSS blend modes can't cross the
  // fixed header's stacking context, so we do it in pixels)
  const c = document.createElement("canvas");
  const W = 480, H = Math.round((img.height / img.width) * 480);
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.max(px[i], px[i + 1], px[i + 2]);
    px[i + 3] = lum;
    if (lum > 0) {
      const f = 255 / lum;
      px[i] = Math.min(255, px[i] * f);
      px[i + 1] = Math.min(255, px[i + 1] * f);
      px[i + 2] = Math.min(255, px[i + 2] * f);
    }
  }
  g.putImageData(d, 0, 0);
  document.querySelector(".hud-logo img").src = c.toDataURL("image/png");
}
{
  hero.targets.logo = targetsLogoFallback();
  const img = new Image();
  img.onload = () => {
    hero.targets.logo = targetsFromLogo(img);
    if (hero.phase === "logo") morphTo("logo", 1.5);
    try { transparentLogo(img); } catch (e) {}
  };
  img.src = "logo.png";
  const neural = targetsNeural();
  hero.targets.neural = neural;
  buildNeuralLines(neural.nodes);
  hero.targets.brain = targetsBrain();
  hero.targets.galaxy = targetsGalaxy();
}

/* ============================================================
   MAIN LOOP
   ============================================================ */
layoutZones();
let clockT = 0, dtGlobal = 0, lastT = performance.now(), cometTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  dtGlobal = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (document.hidden || !GL_OK) return;
  clockT += dtGlobal;
  stepTweens(dtGlobal);
  scene.userData.starMat.uniforms.uTime.value = clockT;
  scene.userData.nebulaMat.uniforms.uTime.value = clockT;
  if (!REDUCED) {
    cometTimer -= dtGlobal;
    if (cometTimer <= 0 && comets.length < 3 && state.view !== "ending") {
      spawnComet();
      cometTimer = 7 + Math.random() * 14;
    }
    stepComets(dtGlobal);
  }
  stepHero();
  stepZones(dtGlobal);
  stepFx(dtGlobal);
  // gentle drift + mouse parallax at home
  if (state.view === "home" && !state.navLock) {
    camera.position.x = HOME_POS.x + Math.sin(clockT * 0.07) * 2.4 + pointer.nx * 3.4;
    camera.position.y = HOME_POS.y + Math.cos(clockT * 0.09) * 1.6 - pointer.ny * 2.2;
  }
  camera.lookAt(lookTarget);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

/* ---------------- debug handle (read-only diagnostics) ---------------- */
window.__universe = { state, hero, ZONES, journey, get glOk() { return GL_OK; }, zoomTo, goHome };

/* ---------------- resize ---------------- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (renderer) renderer.setSize(window.innerWidth, window.innerHeight);
  sizeFx();
  layoutZones();
});

// debug/kiosk aid: ?skipintro=1 jumps straight into the universe (no audio).
// Lives at the end of the file so every module binding is initialised.
if (new URLSearchParams(location.search).has("skipintro")) {
  enterEl.style.transition = "none";
  beginJourney(false, true);
}
