import { useEffect, useRef, useState } from 'react';
import { Renderer, Camera, Transform, Geometry, Program, Mesh } from 'ogl';

/**
 * The signature moment: one point cloud that morphs between three structures as
 * the reader scrubs the pinned section.
 *
 *   A  an ECO lipid nanoparticle — lipid shell condensed around a nucleic acid core
 *   B  a macrocyclic gadolinium chelate — the MRI contrast agent geometry
 *   C  that chelate carrying a targeting peptide, docked onto a fibronectin fibril
 *
 * These are SCHEMATIC. They are built from parametric primitives to read as the
 * right class of molecule at a glance; they are not derived from any structure
 * file and no claim is made about bond lengths, conformation, or stoichiometry.
 * The section labels them as such. See TODO.md.
 *
 * Every particle exists in all three stages at the same array index, so the
 * morph is a per-particle interpolation in the vertex shader — one draw call,
 * no geometry rebuilt, and scrubbing backwards reverses it exactly. Particles
 * are staggered by a per-particle random so the cloud swirls through the
 * transition rather than sliding rigidly.
 *
 * The scroll driver lives in Motion.astro, which owns ScrollTrigger. This
 * component publishes `window.__molecule` on mount and removes it on unmount;
 * Motion calls it if it is there and does nothing if it is not.
 */

declare global {
  interface Window {
    __molecule?: { set(progress: number): void };
  }
}

/* ---- Structure builders --------------------------------------------------
   Deterministic PRNG so the cloud looks identical on every load and between
   this and any future screenshot. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Vec3 = [number, number, number];

/**
 * Evenly spaced directions on a sphere — no clustering at the poles.
 *
 * `u` runs 0..1 across whatever set of particles is being placed, NOT across
 * the whole buffer: each band covers only part of the index range, so feeding
 * the global index in here gives that band only the slice of latitudes it
 * happens to occupy, and the shell comes out as a bowl.
 */
function fibDir(u: number, spin: number): Vec3 {
  const y = 1 - Math.min(1, Math.max(0, u)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = spin * 2.399963229728653;
  return [Math.cos(phi) * r, y, Math.sin(phi) * r];
}

function hex(c: string): Vec3 {
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Four index bands, each playing a different role in each stage. A particle
 * keeps its band, so the nucleic acid cargo in stage A becomes the gadolinium
 * ion in stage B — the payload stays the payload as the platform changes.
 */
const BANDS = [0, 0.12, 0.48, 0.76, 1] as const;

const PALETTE = {
  a: ['#e0703f', '#1e6ba8', '#a6d2e6', '#7fb0d4'].map(hex),
  b: ['#ffffff', '#a6d2e6', '#1f80bd', '#3f76ab'].map(hex),
  c: ['#ffffff', '#e0703f', '#9ec9e4', '#3d7fb8'].map(hex),
};
const SIZES = [1.0, 0.95, 1.15, 0.85];

/** Rotate a point about Y, then about X — used to lay the chelate over. */
function orient(p: Vec3, ry: number, rx: number): Vec3 {
  const [x, y, z] = p;
  const x1 = x * Math.cos(ry) + z * Math.sin(ry);
  const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
  return [x1, y2, z2];
}

/** Stage A — the ECO lipid nanoparticle. */
function lipidNanoparticle(band: number, u: number, i: number, r: () => number): Vec3 {
  if (band === 0) {
    // Condensed nucleic acid: a coil wound around a larger coil, the way a
    // polynucleotide packs when electrostatically condensed.
    const t = u * Math.PI * 2 * 5;
    const ax: Vec3 = [Math.cos(t * 0.21) * 0.19, Math.sin(t * 0.29) * 0.17, Math.sin(t * 0.21) * 0.19];
    const strand = i % 2 === 0 ? 0 : Math.PI;
    return [
      ax[0] + Math.cos(t + strand) * 0.2 + (r() - 0.5) * 0.04,
      ax[1] + Math.sin(t * 0.9) * 0.09 + (r() - 0.5) * 0.04,
      ax[2] + Math.sin(t + strand) * 0.2 + (r() - 0.5) * 0.04,
    ];
  }
  if (band === 1) {
    // Oleic acid tails: short chains running inward from each headgroup.
    const d = fibDir((i % 520) / 519, i);
    const depth = 0.94 - (i % 5) * 0.062;
    const w = (r() - 0.5) * 0.05;
    return [d[0] * depth + w, d[1] * depth + w, d[2] * depth + w];
  }
  if (band === 2) {
    // Protonable head groups on the shell.
    const d = fibDir(u, i);
    const rad = 0.99 + (r() - 0.5) * 0.035;
    return [d[0] * rad, d[1] * rad, d[2] * rad];
  }
  // PEG corona: sparse filaments standing off the surface.
  const d = fibDir(u, i * 7);
  const rad = 1.06 + r() * 0.34;
  return [d[0] * rad, d[1] * rad, d[2] * rad];
}

/** Stage B — a macrocyclic gadolinium chelate, seen roughly face on. */
function chelate(band: number, u: number, i: number, r: () => number): Vec3 {
  if (band === 0) {
    // The metal centre.
    const d = fibDir(u, i);
    const rad = Math.cbrt(r()) * 0.105;
    return [d[0] * rad, d[1] * rad, d[2] * rad];
  }
  if (band === 1) {
    // Twelve-membered macrocycle: dense at each ring position, thinner along
    // the bonds between them.
    const seg = 12;
    const k = Math.floor(u * seg * 40) % seg;
    const atom = r() < 0.45;
    const a = ((k + (atom ? 0 : r())) / seg) * Math.PI * 2;
    const rad = 0.44 + (r() - 0.5) * (atom ? 0.05 : 0.02);
    const p: Vec3 = [Math.cos(a) * rad, (r() - 0.5) * 0.09, Math.sin(a) * rad];
    return orient(p, 0, Math.PI / 2.15);
  }
  if (band === 2) {
    // Four pendant arms out to carboxylate clusters.
    const arm = i % 4;
    const a = (arm / 4) * Math.PI * 2 + Math.PI / 4;
    const along = (i % 40) / 40;
    const head = along > 0.78;
    const rad = 0.44 + along * 0.52;
    const jitter = head ? 0.09 : 0.025;
    const p: Vec3 = [
      Math.cos(a) * rad + (r() - 0.5) * jitter,
      (r() - 0.5) * jitter + Math.sin(along * Math.PI) * 0.16,
      Math.sin(a) * rad + (r() - 0.5) * jitter,
    ];
    return orient(p, 0, Math.PI / 2.15);
  }
  // Coordinated water and solvent shell — faint, keeps the frame occupied.
  const d = fibDir(u, i * 3);
  const rad = 1.12 + r() * 0.5;
  return [d[0] * rad, d[1] * rad * 0.72, d[2] * rad];
}

/** Stage C — the chelate carrying a peptide, docked onto a fibronectin fibril. */
function targeted(band: number, u: number, i: number, r: () => number): Vec3 {
  const lift: Vec3 = [-0.1, 0.76, 0];
  const s = 0.62;
  if (band === 0) {
    const p = chelate(0, u, i, r);
    return [p[0] * s + lift[0], p[1] * s + lift[1], p[2] * s + lift[2]];
  }
  if (band === 2) {
    const p = chelate(1, u, i, r);
    const q = chelate(2, u, i, r);
    const m: Vec3 = i % 2 === 0 ? p : q;
    return [m[0] * s + lift[0], m[1] * s + lift[1], m[2] * s + lift[2]];
  }
  if (band === 1) {
    // The targeting peptide: an alpha helix running from the chelate down to
    // the binding site.
    const t = u;
    const ang = t * Math.PI * 2 * 4.5;
    const ax: Vec3 = [
      lift[0] + t * 0.3,
      lift[1] - 0.2 - t * 1.44,
      lift[2] + Math.sin(t * 2.2) * 0.1,
    ];
    const rad = 0.115 * (1 - t * 0.25);
    return [
      ax[0] + Math.cos(ang) * rad + (r() - 0.5) * 0.02,
      ax[1] + (r() - 0.5) * 0.02,
      ax[2] + Math.sin(ang) * rad + (r() - 0.5) * 0.02,
    ];
  }
  // Fibronectin: fibrils running across the floor of the frame, denser where
  // the peptide meets them.
  const fib = i % 9;
  const along = r() * 2 - 1;
  const skew = (fib - 4) * 0.17;
  // Denser where the peptide meets it, so the docking site reads as a site.
  const near = Math.exp(-Math.pow((along * 1.15 - 0.1) / 0.4, 2));
  return [
    along * 1.15 + (r() - 0.5) * 0.08,
    -0.92 + skew * 0.035 + (r() - 0.5) * 0.05 + near * 0.05,
    skew * 0.42 + (r() - 0.5) * 0.06,
  ];
}

const VERT = /* glsl */ `
  attribute vec3 position;
  attribute vec3 aB;
  attribute vec3 aC;
  attribute vec3 cA;
  attribute vec3 cB;
  attribute vec3 cC;
  attribute float aRnd;
  attribute float aSize;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uT1;
  uniform float uT2;
  uniform float uTime;
  uniform float uScale;
  uniform float uReveal;

  varying vec3 vCol;
  varying float vAlpha;

  float ease(float t) { return t * t * (3.0 - 2.0 * t); }

  /* Each particle starts its move at its own moment inside the transition, so
     the cloud swirls through the change instead of translating as one body. */
  float staged(float t, float d) {
    return ease(clamp((t - d * 0.34) / 0.66, 0.0, 1.0));
  }

  void main() {
    float s1 = staged(uT1, aRnd);
    float s2 = staged(uT2, 1.0 - aRnd);

    vec3 p = mix(position, aB, s1);
    p = mix(p, aC, s2);
    vec3 col = mix(cA, cB, s1);
    col = mix(col, cC, s2);

    /* Push outward at the midpoint of each transition: the structure comes
       apart and reassembles rather than sliding between two poses. */
    float burst = sin(3.14159265 * s1) * (1.0 - uT2) + sin(3.14159265 * s2);
    p += normalize(p + vec3(0.0001)) * burst * (0.26 + aRnd * 0.6);

    p += vec3(
      sin(uTime * 0.61 + aRnd * 31.0),
      cos(uTime * 0.47 + aRnd * 22.0),
      sin(uTime * 0.39 + aRnd * 17.0)
    ) * 0.013;

    vec4 mv = modelViewMatrix * vec4(p * uScale, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * 40.0 / max(0.35, -mv.z);

    vCol = col;
    vAlpha = uReveal * (0.40 + 0.38 * aRnd) * (1.0 - burst * 0.3);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vCol;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float a = smoothstep(0.25, 0.015, r2);
    gl_FragColor = vec4(vCol, a * vAlpha);
  }
`;

/** Where in the scrub each morph happens, with a hold on either side so each
    panel gets a settled structure to be read against. */
function stops(p: number) {
  return {
    t1: Math.min(1, Math.max(0, (p - 0.27) / 0.19)),
    t2: Math.min(1, Math.max(0, (p - 0.64) / 0.19)),
  };
}

export default function MoleculeCanvas({ count = 9000 }: { count?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
      if (!gl) return;
      (gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
      setOk(true);
    } catch {
      /* no WebGL — the section falls back to its static composition */
    }
  }, []);

  useEffect(() => {
    if (!ok || !host.current) return;
    const el = host.current;

    const n = count;
    const posA = new Float32Array(n * 3);
    const posB = new Float32Array(n * 3);
    const posC = new Float32Array(n * 3);
    const colA = new Float32Array(n * 3);
    const colB = new Float32Array(n * 3);
    const colC = new Float32Array(n * 3);
    const rnd = new Float32Array(n);
    const size = new Float32Array(n);

    const r = rng(20260824);
    for (let i = 0; i < n; i++) {
      const f = i / n;
      let band = 0;
      while (band < 3 && f >= BANDS[band + 1]) band++;
      // Position inside the band, so each band's parametric path is traced
      // evenly regardless of how many particles it was given.
      const u = (f - BANDS[band]) / (BANDS[band + 1] - BANDS[band]);

      const a = lipidNanoparticle(band, u, i, r);
      const b = chelate(band, u, i, r);
      const c = targeted(band, u, i, r);
      for (let k = 0; k < 3; k++) {
        posA[i * 3 + k] = a[k];
        posB[i * 3 + k] = b[k];
        posC[i * 3 + k] = c[k];
        colA[i * 3 + k] = PALETTE.a[band][k];
        colB[i * 3 + k] = PALETTE.b[band][k];
        colC[i * 3 + k] = PALETTE.c[band][k];
      }
      rnd[i] = r();
      size[i] = SIZES[band] * (0.7 + r() * 0.6);
    }

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio || 1, 1.75),
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: 'high-performance',
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    el.appendChild(gl.canvas);
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.display = 'block';

    const camera = new Camera(gl, { fov: 34, near: 0.1, far: 60 });
    camera.position.set(0, 0, 5.1);

    const geometry = new Geometry(gl, {
      position: { size: 3, data: posA },
      aB: { size: 3, data: posB },
      aC: { size: 3, data: posC },
      cA: { size: 3, data: colA },
      cB: { size: 3, data: colB },
      cC: { size: 3, data: colC },
      aRnd: { size: 1, data: rnd },
      aSize: { size: 1, data: size },
    });

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uT1: { value: 0 },
        uT2: { value: 0 },
        uTime: { value: 0 },
        uScale: { value: 1 },
        uReveal: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    // Additive, so overlapping points build light rather than muddying. On the
    // deep blue ground of this section that is what makes it read as luminous.
    program.setBlendFunc(gl.SRC_ALPHA, gl.ONE);

    const scene = new Transform();
    const mesh = new Mesh(gl, { mode: gl.POINTS, geometry, program });
    mesh.setParent(scene);

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h);
      camera.perspective({ aspect: w / h });
      // Keep the structure inside the frame on shorter viewports.
      program.uniforms.uScale.value = Math.min(1, Math.max(0.62, h / 760));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    /* The scroll driver writes here; the render loop eases toward it, which is
       what gives the motion the same lag as ScrollTrigger's scrub. */
    let want = 0;
    let have = 0;
    window.__molecule = {
      set(p: number) {
        want = Math.min(1, Math.max(0, p));
      },
    };

    let raf = 0;
    let t0 = 0;
    let reveal = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!t0) t0 = t;
      const time = (t - t0) / 1000;

      have += (want - have) * 0.12;
      reveal += (1 - reveal) * 0.035;

      const { t1, t2 } = stops(have);
      program.uniforms.uT1.value = t1;
      program.uniforms.uT2.value = t2;
      program.uniforms.uTime.value = time;
      program.uniforms.uReveal.value = reveal;

      // A single continuous turn across the whole section, plus a slow idle
      // drift so the structure is never completely still.
      scene.rotation.y = -0.3 + have * 0.82 + time * 0.03;
      scene.rotation.x = 0.14 - have * 0.26 + Math.sin(time * 0.3) * 0.05;

      renderer.render({ scene, camera });
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      if (window.__molecule) delete window.__molecule;
      gl.canvas.remove();
      (gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
    };
  }, [ok, count]);

  if (!ok) return null;
  return <div ref={host} className="absolute inset-0" aria-hidden="true" />;
}
