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

    /* Hold the left side down: the mission statement reads across it, and this
       is cheaper and steadier than trying to scrim a field that moves.

       On a narrow viewport the type spans the whole width, so there is no
       quiet side to put it on and the whole field comes down instead. Measured,
       not guessed: at full brightness the crest of the filament put white text
       at 3.6:1 on a 390px screen. */
    col *= mix(0.36, 1.16, smoothstep(0.04, 0.94, vUv.x));
    col *= mix(1.0, 0.55, uHold);

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

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h);
      program.uniforms.uRes.value = [w, h];
      // Below this the type has no quiet side of the frame to sit on.
      program.uniforms.uHold.value = w < 760 ? 1 : 0;
      // A paused field still has to be correct at its new size.
      if (!running) draw(program.uniforms.uTime.value);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

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
      document.removeEventListener('visibilitychange', onVis);
      gl.canvas.remove();
      (gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
    };
  }, [ok]);

  if (!ok) return null;
  return <div ref={host} className="absolute inset-0" aria-hidden="true" />;
}
