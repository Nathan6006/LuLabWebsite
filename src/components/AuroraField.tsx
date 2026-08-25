import { useEffect, useRef, useState } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';

/**
 * Atmosphere behind the mission statement: one full-width fragment shader in
 * the CWRU blues, with light moving slowly through it.
 *
 * This is the cheapest thing on the site by a wide margin — no geometry beyond
 * a single covering triangle, no physics, no per-particle work. It is one pass
 * of domain-warped value noise, which is what makes it read as silk rather than
 * as clouds, and it runs at frame rate on a phone.
 *
 * Three things keep it honest:
 *  - It renders at device pixel ratio 1.25 at most. A smooth gradient has no
 *    detail to resolve, and the dither below removes the banding that would
 *    otherwise be the only reason to want more pixels.
 *  - It stops entirely when it is off screen or the tab is hidden.
 *  - Under reduced motion it draws exactly one frame and stops, so the field is
 *    still there but nothing moves.
 *
 * Without WebGL it renders nothing at all and the CSS gradient underneath is
 * what ships.
 */

const VERT = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform vec2 uRes;
  uniform float uTime;
  uniform float uHold;
  /* The block of text, in this canvas's own normalised coordinates:
     centre.xy, half-extent.xy. Measured from the paragraph itself. */
  uniform vec4 uBox;
  /* How far the section has travelled through the viewport, 0 to 1. */
  uniform float uProgress;
  varying vec2 vUv;

  /* No sin() here. The usual fract(sin(dot(...))) hash costs a transcendental
     per corner — 80 of them per pixel through the octaves below — and on mobile
     GPUs, where sin() is evaluated at lower precision, it also repeats visibly.
     This is six cheap ops and better distributed. */
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(17.3, 9.1);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    /* Aspect-corrected, and squashed vertically so the bands run across the
       band rather than piling up in it. */
    vec2 p = vec2(vUv.x * (uRes.x / max(1.0, uRes.y)), vUv.y * 2.2) * 1.15;
    float t = uTime * 0.058;

    /* Domain warp. Two rounds: the first bends the field, the second bends the
       bend. This is the whole effect. */
    vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t * 0.8)));
    vec2 r = vec2(
      fbm(p + 3.2 * q + vec2(1.7, 9.2) + t * 0.6),
      fbm(p + 3.2 * q + vec2(8.3, 2.8) - t * 0.5)
    );
    float f = fbm(p + 2.7 * r);

    vec3 deep  = vec3(0.024, 0.055, 0.157);  /* below cwru-dark, for the troughs */
    vec3 navy  = vec3(0.035, 0.078, 0.227);  /* #09143a */
    vec3 blue  = vec3(0.000, 0.188, 0.443);  /* #003071 */
    vec3 truec = vec3(0.000, 0.478, 0.722);  /* #007ab8 */
    vec3 light = vec3(0.651, 0.824, 0.902);  /* #a6d2e6 */

    vec3 col = mix(deep, navy, smoothstep(0.18, 0.58, f));
    col = mix(col, blue, smoothstep(0.42, 0.82, f));
    col = mix(col, truec, smoothstep(0.58, 0.96, f + 0.08 * r.y) * 0.85);

    /* Two ribbons rather than one: a broad glow, and a narrow filament riding
       its crest. The filament is what reads as aurora — a single soft gradient
       reads as fog. */
    float glow = smoothstep(0.70, 1.02, f + 0.12 * r.x);
    float filament = pow(smoothstep(0.85, 1.03, f + 0.16 * r.x), 3.0);
    col = mix(col, light, glow * 0.36);
    col += light * filament * 0.5;

    /* ---- The text's pocket, and the line that bends around it -----------
       Distance to the block of type, so the field can be told to leave it
       alone and the rings below can be sized and centred on it. */
    float aspect = uRes.x / max(1.0, uRes.y);
    vec2 ap = vec2((vUv.x - uBox.x) * aspect, vUv.y - uBox.y);
    vec2 bh = vec2(uBox.z * aspect, uBox.w);
    float d = sdRoundBox(ap, bh, min(0.09, min(bh.x, bh.y) * 0.5));

    /* Hold the left side down: the mission statement reads across it, and this
       is cheaper and steadier than trying to scrim a field that moves.

       On a narrow viewport the type spans the whole width, so there is no
       quiet side to put it on and the whole field comes down instead. Measured,
       not guessed: at full brightness the crest of the filament put white text
       at 3.6:1 on a 390px screen. */
    col *= mix(0.36, 1.16, smoothstep(0.04, 0.94, vUv.x));
    col *= mix(1.0, 0.55, uHold);

    /* Quieten the field inside the block. The type then has a steady ground
       whatever the noise happens to be doing above it, and the light reads as
       parting around the words rather than passing under them. */
    /* Narrow viewports get a deeper, wider pocket: the block spans the full
       width there, so the contour runs closer to the glyphs and there is no
       margin of dark field either side of them to fall back on. */
    float inside = 1.0 - smoothstep(-0.03, mix(0.11, 0.17, uHold), d);
    col *= mix(1.0, mix(0.42, 0.30, uHold), inside);

    /* ---- Rings around the block of type ---------------------------------
       Concentric arcs that begin at the paragraph's own edge and expand
       outward, cut away toward their ends so they read as open arcs rather
       than as a box drawn round the text. Scroll drives the cycle, so the
       rings travel outward as you read and run back in when you scroll up.

       The technique is React Bits' MagicRings — ring distance, an angular
       cutaway raised to a power, and an exponential glow falloff — folded into
       this shader rather than mounted as a second WebGL context. It needed
       three.js and its own canvas; this needed twenty lines and no new bytes.

       Distances are normalised by the block's own half-extent, so the rings
       take the paragraph's proportions instead of being circles laid over it. */
    vec2 sB = max(bh + 0.16, vec2(0.10));
    float rot = -0.13;
    vec2 apr = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * ap;
    /* Warped by the same field, so the arcs bend with the silk. */
    vec2 ep = apr / sB + 0.05 * vec2(r.x - 0.5, r.y - 0.5);
    float er = length(ep);

    /* The angle and the line width are the same for every ring, so they are
       computed once here rather than five times inside the loop. */
    float aa = atan(abs(ep.y), abs(ep.x)) * 0.63661977;   /* / (pi / 2) */
    float pxE = 1.0 / (max(1.0, uRes.y) * (sB.x + sB.y) * 0.5);
    float th = max(1.0 - aa, 0.42) * pxE * 2.6;

    vec3 rings = vec3(0.0);
    float cut = 1.0;
    float clock = uProgress * 2.4 + uTime * 0.045;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float tr = fract(clock + fi * 0.2);
      float rr = 0.94 + fi * 0.17 + tr * 0.36;
      float dd = abs(er - rr);
      /* A hard core for the line, then the cutaway, then the glow. */
      float core = (1.0 - smoothstep(th, th * 1.7, dd)) + 1.0;
      float ca = cut * aa;
      dd += ca * ca * ca * rr;
      float life = smoothstep(0.0, 0.22, tr) * (1.0 - smoothstep(0.5, 1.0, tr));
      /* Additive over an already-blue field, so the amplitude has to stay low:
         push it and green and blue saturate together while red does not, and
         the arcs turn mint. */
      rings += mix(light, truec, fi * 0.25) * core * exp(-15.0 * dd) * life;
      cut *= 1.3;
    }

    /* The rings keep more of themselves on the held-down side than the field
       does; otherwise the half of them that brackets the text is not there. */
    float lineHold = mix(0.72, 1.0, smoothstep(0.02, 0.90, vUv.x)) * mix(1.0, 0.5, uHold);
    col += rings * 0.32 * lineHold;

    /* Settle both edges onto the sections above and below, so the band has no
       seam at either end. */
    float edge = smoothstep(0.0, 0.16, vUv.y) * smoothstep(0.0, 0.16, 1.0 - vUv.y);
    col = mix(navy, col, 0.18 + 0.82 * edge);

    /* Ordered-ish dither. A gradient this smooth bands visibly in 8 bits, and a
       fraction of a level of noise costs nothing and removes it entirely —
       which is what lets this render at dpr 1.25 instead of 2. */
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function AuroraField() {
  const host = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
      if (!gl) return;
      (gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
      setOk(true);
    } catch {
      /* no WebGL — the CSS gradient underneath is the field */
    }
  }, []);

  useEffect(() => {
    if (!ok || !host.current) return;
    const el = host.current;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio || 1, 1.25),
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    const gl = renderer.gl;
    el.appendChild(gl.canvas);
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.display = 'block';

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uRes: { value: [1, 1] },
        uTime: { value: 0 },
        uHold: { value: 0 },
        uBox: { value: [0.5, 0.5, 0.22, 0.2] },
        uProgress: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    let raf = 0;
    let t0 = 0;
    let running = false;

    const draw = (time: number) => {
      program.uniforms.uTime.value = time;
      renderer.render({ scene: mesh });
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!t0) t0 = t;
      program.uniforms.uProgress.value = readProgress();
      draw((t - t0) / 1000);
    };

    const start = () => {
      if (running || still) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    /* Where the block of type actually is. Measured rather than hard-coded,
       because the paragraph's height depends on the face that ends up loading
       and on the viewport it wraps into. */
    const focus = document.querySelector<HTMLElement>('[data-aurora-focus]');
    const measureBox = () => {
      if (!focus) return;
      const hr = el.getBoundingClientRect();
      if (hr.width < 1 || hr.height < 1) return;
      const tr = focus.getBoundingClientRect();
      program.uniforms.uBox.value = [
        (tr.left + tr.width / 2 - hr.left) / hr.width,
        (tr.top + tr.height / 2 - hr.top) / hr.height,
        tr.width / 2 / hr.width,
        tr.height / 2 / hr.height,
      ];
      if (!running) draw(program.uniforms.uTime.value);
    };

    /* Section position, mapped to the same window the reading highlight uses,
       so the line draws itself around the paragraph while the words brighten.
       A pure function of scroll position, so scrolling back undraws it. */
    const readProgress = () => {
      if (still) return 1;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const from = vh * 0.76;
      const to = vh * 0.55 - r.height;
      return Math.min(1, Math.max(0, (from - r.top) / Math.max(1, from - to)));
    };

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h);
      program.uniforms.uRes.value = [w, h];
      // Below this the type has no quiet side of the frame to sit on.
      program.uniforms.uHold.value = w < 760 ? 1 : 0;
      measureBox();
      program.uniforms.uProgress.value = readProgress();
      // A paused field still has to be correct at its new size.
      if (!running) draw(program.uniforms.uTime.value);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    // The paragraph's own box, which changes when the real face swaps in and
    // when the text is split into words. A ResizeObserver on it catches both
    // without having to guess at timings.
    const roText = focus ? new ResizeObserver(measureBox) : null;
    if (focus && roText) roText.observe(focus);

    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) (e.isIntersecting ? start : stop)(); },
      { rootMargin: '120px 0px' },
    );
    io.observe(el);

    const onVis = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      roText?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      gl.canvas.remove();
      (gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
    };
  }, [ok]);

  if (!ok) return null;
  return <div ref={host} className="absolute inset-0" aria-hidden="true" />;
}
