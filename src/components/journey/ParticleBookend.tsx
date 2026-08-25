import { useEffect, useRef, useState } from 'react';
import { TUNING, type JourneyFrame } from '../../lib/journey';
import { registerParticle } from '../../lib/journey-bridge';

/**
 * The 3D bookends: the ECO lipid nanoparticle at the head of the section, and
 * the same particle opened with its cargo unspooled at the tail.
 *
 * Forked from MoleculeCanvas, which morphed through three structures for the
 * platform section. Here there are only two states — closed, and open with the
 * strand out — and the second is only ever reached in the closing shot.
 *
 * The structures are SCHEMATIC. They are built from parametric primitives to
 * read as the right class of object at a glance; they are not derived from any
 * structure file and no claim is made about bond lengths, conformation or
 * stoichiometry. Nothing in this section is labelled.
 *
 * Every particle exists in both states at the same array index, so the opening
 * is a per-particle interpolation in the vertex shader — one draw call, no
 * geometry rebuilt, and scrubbing backwards reverses it exactly.
 *
 * ogl is imported dynamically INSIDE the capability gate. Under reduced motion,
 * below the width gate, or with no WebGL context, the library is never fetched.
 *
 * The FETCH and the BUILD are deliberately split. Building 9000 particles in
 * two states is a few hundred milliseconds of straight-line arithmetic, and
 * this section sits two viewports below the fold — doing it during page load
 * cost a 1.5s long task on the main thread for something nobody could see yet.
 * But deferring the whole thing to the moment the section arrives means the
 * network fetch lands on the critical path instead, and the particle shows up
 * a beat late.
 *
 * So: the module is fetched on idle, which is nearly free and gets 47KB off
 * the arrival path, and the expensive buffer build waits until the section is
 * within about a screen and a half. The host box is rendered as soon as the
 * gate passes, which is what gives the IntersectionObserver something to
 * watch.
 */

/* ---- Structure builders --------------------------------------------------
   Deterministic PRNG so the cloud is identical on every load. */
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
 * Evenly spaced directions on a sphere. `u` runs 0..1 across the band being
 * placed, not across the whole buffer — feeding a global index in here gives a
 * band only the slice of latitudes it happens to occupy, and the shell comes
 * out as a bowl.
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
 * Four index bands. A particle keeps its band through the opening, so the
 * condensed cargo is what becomes the strand and the shell is what parts.
 */
const BANDS = [0, 0.12, 0.48, 0.76, 1] as const;
const SIZES = [1.0, 0.95, 1.15, 0.85];

const PALETTE = {
  closed: ['#e0703f', '#1e6ba8', '#a6d2e6', '#7fb0d4'].map(hex),
  open: ['#ffd9a0', '#2f7fbe', '#a6d2e6', '#6ea6cc'].map(hex),
};

/** State A — the ECO lipid nanoparticle, condensed. */
function closedParticle(band: number, u: number, i: number, r: () => number): Vec3 {
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
    // Oleic acid tails: short chains running inward from each head group.
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

/**
 * State B — the particle open, cargo released.
 *
 * The shell parts into two halves along Y and swings back; the condensed coil
 * becomes a single strand running out of the gap with a gentle sine waviness.
 * The strand does not writhe: its shape is fixed and only how much of it has
 * emerged changes.
 */
function openParticle(band: number, u: number, i: number, r: () => number): Vec3 {
  if (band === 0) {
    // The strand. `u` is distance along it, which is also what gates the
    // unspool in the shader.
    const t = u;
    const ax: Vec3 = [
      -0.15 + t * 2.75,
      Math.sin(t * Math.PI * 3.1) * 0.26 + t * 0.42,
      Math.sin(t * Math.PI * 2.05) * 0.15,
    ];
    // A little thickness, so it reads as a strand rather than a wire.
    const th = 0.055;
    return [
      ax[0] + (r() - 0.5) * th,
      ax[1] + (r() - 0.5) * th,
      ax[2] + (r() - 0.5) * th * 1.6,
    ];
  }

  // Both shell bands part the same way: the half a particle belongs to is
  // decided by the sign of its Y on the closed sphere, so the shell splits
  // rather than scrambling.
  const d = band === 1 ? fibDir((i % 520) / 519, i) : fibDir(u, i);
  const half = d[1] >= 0 ? 1 : -1;
  const rad = band === 1 ? 0.94 - (i % 5) * 0.062 : 0.99 + (r() - 0.5) * 0.035;

  if (band === 3) {
    // Corona, dispersed outward as the particle comes apart.
    const dd = fibDir(u, i * 7);
    const rr = 1.28 + r() * 0.62;
    return [dd[0] * rr - 0.35, dd[1] * rr, dd[2] * rr];
  }

  // Swing each half open about the X axis and slide it back along -X, so the
  // gap faces the direction the strand runs.
  const ang = half * 0.62;
  const y = d[1] * rad;
  const z = d[2] * rad;
  return [
    d[0] * rad - 0.5,
    y * Math.cos(ang) - z * Math.sin(ang) + half * 0.34,
    y * Math.sin(ang) + z * Math.cos(ang),
  ];
}

const VERT = /* glsl */ `
  attribute vec3 position;
  attribute vec3 aB;
  attribute vec3 cA;
  attribute vec3 cB;
  attribute float aRnd;
  attribute float aSize;
  attribute float aBand;
  attribute float aU;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uOpen;
  uniform float uStrand;
  uniform float uTime;
  uniform float uScale;
  uniform float uShrink;
  uniform float uAlpha;
  uniform vec2  uAim;

  varying vec3 vCol;
  varying float vAlpha;

  float ease(float t) { return t * t * (3.0 - 2.0 * t); }

  /* Each particle starts its move at its own moment, so the shell comes apart
     rather than hinging as one rigid body. */
  float staged(float t, float d) {
    return ease(clamp((t - d * 0.34) / 0.66, 0.0, 1.0));
  }

  void main() {
    float s = staged(uOpen, aRnd);

    /* Cargo particles only exist once the strand has unspooled past them.
       Everything else is always present. */
    float isCargo = step(aBand, 0.5);
    float gate = step(aU, uStrand);
    float keep = max(1.0 - isCargo, gate);

    vec3 p = mix(position, aB * keep, s);
    vec3 col = mix(cA, cB, s);

    /* Push outward through the middle of the transition: the particle comes
       apart rather than sliding between two poses. */
    float burst = sin(3.14159265 * s);
    p += normalize(p + vec3(0.0001)) * burst * (0.18 + aRnd * 0.34);

    /* The only time term in the geometry: a small idle drift so a parked
       particle is not completely dead. Bounded, and it moves nothing
       structural. */
    p += vec3(
      sin(uTime * 0.61 + aRnd * 31.0),
      cos(uTime * 0.47 + aRnd * 22.0),
      sin(uTime * 0.39 + aRnd * 17.0)
    ) * 0.013;

    vec4 mv = modelViewMatrix * vec4(p * uScale, 1.0);
    /* Aim: the shrinking particle converges on the injection site, in view
       space, so the handoff to the SVG lands on the same pixel. */
    mv.xy += uAim;

    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * 40.0 * (0.30 + 0.70 * uShrink) / max(0.35, -mv.z);

    vCol = col;
    vAlpha = uAlpha * (0.40 + 0.38 * aRnd) * (1.0 - burst * 0.3) * mix(1.0, keep, s);
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

export default function ParticleBookend() {
  const host = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(false);
  const [near, setNear] = useState(false);

  /* Gate first, import second. Nothing below the gate ever fetches ogl. */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia(`(min-width: ${TUNING.gatePx}px)`).matches) return;
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
      if (!gl) return;
      (gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
      setOk(true);
    } catch {
      /* no WebGL — the section runs its SVG layer alone */
    }
  }, []);

  /* Warm the module on idle: a network fetch and some class definitions, so
     none of that is happening at the moment the reader arrives. */
  useEffect(() => {
    if (!ok) return;
    const warm = () => { void import('ogl'); };
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) { ric(warm, { timeout: 4000 }); return; }
    const t = window.setTimeout(warm, 1200);
    return () => window.clearTimeout(t);
  }, [ok]);

  /* The expensive part waits until the section is within about four fifths of
     a screen — roughly a second of scrolling ahead of arrival, against a build
     that measures ~380ms. A more generous margin than this is not a deferral
     at all on this page: the section starts about 1000px below the fold, so
     anything over ~120% fires at scroll zero.
     The host box exists from the moment the gate passes, which is what gives
     this observer something to watch. */
  useEffect(() => {
    if (!ok || !host.current) return;
    const el = host.current;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setNear(true);
      },
      { rootMargin: '80% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ok]);

  useEffect(() => {
    if (!ok || !near || !host.current) return;
    const el = host.current;
    let disposed = false;
    let teardown: (() => void) | null = null;

    (async () => {
      const { Renderer, Camera, Transform, Geometry, Program, Mesh } = await import('ogl');
      if (disposed) return;

      const cfg = TUNING;
      const n = Math.round(cfg.particle.count);
      const posA = new Float32Array(n * 3);
      const posB = new Float32Array(n * 3);
      const colA = new Float32Array(n * 3);
      const colB = new Float32Array(n * 3);
      const rnd = new Float32Array(n);
      const size = new Float32Array(n);
      const bandAttr = new Float32Array(n);
      const uAttr = new Float32Array(n);

      const r = rng(20260825);
      for (let i = 0; i < n; i++) {
        const f = i / n;
        let band = 0;
        while (band < 3 && f >= BANDS[band + 1]) band++;
        const u = (f - BANDS[band]) / (BANDS[band + 1] - BANDS[band]);

        const a = closedParticle(band, u, i, r);
        const b = openParticle(band, u, i, r);
        for (let k = 0; k < 3; k++) {
          posA[i * 3 + k] = a[k];
          posB[i * 3 + k] = b[k];
          colA[i * 3 + k] = PALETTE.closed[band][k];
          colB[i * 3 + k] = PALETTE.open[band][k];
        }
        rnd[i] = r();
        size[i] = SIZES[band] * (0.7 + r() * 0.6);
        bandAttr[i] = band;
        uAttr[i] = u;
      }

      const renderer = new Renderer({
        // Capped at 2 per the spec; 1.75 is where this stops being visible.
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
        cA: { size: 3, data: colA },
        cB: { size: 3, data: colB },
        aRnd: { size: 1, data: rnd },
        aSize: { size: 1, data: size },
        aBand: { size: 1, data: bandAttr },
        aU: { size: 1, data: uAttr },
      });

      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uOpen: { value: 0 },
          uStrand: { value: 0 },
          uTime: { value: 0 },
          uScale: { value: 1 },
          uShrink: { value: 1 },
          uAlpha: { value: 0 },
          uAim: { value: [0, 0] },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      // Additive, so overlapping points build light rather than muddying. This
      // is also why the particle must be gone before the ground lifts: additive
      // blending has nothing to add on off-white.
      program.setBlendFunc(gl.SRC_ALPHA, gl.ONE);

      const scene = new Transform();
      const mesh = new Mesh(gl, { mode: gl.POINTS, geometry, program });
      mesh.setParent(scene);

      /* View-space height at the subject plane, used to turn the controller's
         pixel aim into world units. */
      const VIEW_H = 2 * 5.1 * Math.tan((34 * Math.PI) / 180 / 2);
      let fit = 1;
      let hostW = 1;
      let hostH = 1;
      let aimPx: [number, number] | null = null;

      const resize = () => {
        hostW = el.clientWidth || 1;
        hostH = el.clientHeight || 1;
        renderer.setSize(hostW, hostH);
        camera.perspective({ aspect: hostW / hostH });
        fit = cfg.particle.frameFill * Math.min(1, Math.max(0.62, hostH / 760));
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(el);

      /* The controller writes here; the loop eases toward it, which is what
         gives the cloud the same weighted lag as the scrub. */
      let want: JourneyFrame | null = null;
      let have = 0;
      const unregister = registerParticle({
        set(frame) {
          want = frame;
        },
        aim(x, y) {
          aimPx = [x, y];
        },
      });

      let raf = 0;
      let t0 = 0;
      let running = true;

      const draw = (t: number) => {
        raf = requestAnimationFrame(draw);
        if (!t0) t0 = t;
        const time = (t - t0) / 1000;
        const f = want;

        const targetScale = f ? f.particleScale : 1;
        have += (targetScale - have) * cfg.particle.lag;

        program.uniforms.uScale.value = fit * have;
        program.uniforms.uShrink.value = have;
        program.uniforms.uOpen.value = f ? f.particleOpen : 0;
        program.uniforms.uStrand.value = f ? f.particleStrand : 0;
        program.uniforms.uAlpha.value = f ? f.particleOpacity : 0;
        program.uniforms.uTime.value = time;

        if (aimPx) {
          const k = f ? f.particleAim : 0;
          const perPx = VIEW_H / hostH;
          program.uniforms.uAim.value = [
            (aimPx[0] - hostW / 2) * perPx * k,
            -(aimPx[1] - hostH / 2) * perPx * k,
          ];
        }

        // Turn is driven by scroll, plus a small bounded idle drift.
        scene.rotation.y = -0.3 + (f ? f.particleSpin : 0) + time * cfg.particle.idleSpin;
        scene.rotation.x = 0.14 + Math.sin(time * 0.3) * 0.05;

        renderer.render({ scene, camera });
      };

      const start = () => {
        if (running) return;
        running = true;
        t0 = 0;
        raf = requestAnimationFrame(draw);
      };
      const stop = () => {
        if (!running) return;
        running = false;
        cancelAnimationFrame(raf);
      };
      raf = requestAnimationFrame(draw);

      // Nothing renders while the section is off screen or the tab is hidden.
      const io = new IntersectionObserver(
        ([e]) => (e.isIntersecting && !document.hidden ? start() : stop()),
        { rootMargin: '10% 0px' },
      );
      io.observe(el);
      const onVis = () => (document.hidden ? stop() : start());
      document.addEventListener('visibilitychange', onVis);

      teardown = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        ro.disconnect();
        unregister();
        gl.canvas.remove();
        (gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
      };
    })();

    return () => {
      disposed = true;
      teardown?.();
    };
  }, [ok, near]);

  if (!ok) return null;
  return <div ref={host} className="absolute inset-0" aria-hidden="true" />;
}
