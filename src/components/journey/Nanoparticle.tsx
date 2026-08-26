import { useEffect, useRef, useState } from 'react';
import { TUNING, type JourneyFrame } from '../../lib/journey';
import { registerParticle } from '../../lib/journey-bridge';

/**
 * The lipid nanoparticle: a scrubbed image sequence, rendered in Blender.
 *
 * This replaces a real-time WebGL version. The membrane is transmissive and
 * the cargo scatters light through it, and those are the two things a
 * rasteriser approximates rather than computes — no amount of fresnel maths
 * was going to make the shader version read as a real object. The scene that
 * produces these frames is `blender/scene.py`, which is procedural, so the
 * particle is still defined by numbers in a file rather than by hand-modelling.
 *
 * TWO SEQUENCES:
 *   section — the cross-section closing into a whole sphere. Frame 0 is the
 *             cutaway with the individual lipids on show; the last frame is
 *             the closed particle, which is also what is held through the
 *             travel, so no third sequence is needed for the journey.
 *   release — the shell parting again and the mRNA helix emerging.
 *
 * Both are square, centred and transparent, so placement stays the
 * controller's job exactly as it was with WebGL: it says "be this big, be
 * here", having projected the curve through the same camera the SVG uses. That
 * is what keeps the particle on the line it is travelling.
 *
 * Frames are decoded once into ImageBitmaps and blitted to a canvas. Decoding
 * per frame during a scrub drops frames; holding 70 decoded 800px bitmaps is
 * about 180MB, which is why the sequences are small and why nothing is fetched
 * until the section is near.
 */

interface Manifest {
  section: { count: number };
  ext: string;
  base: string;
}

const MANIFEST: Manifest = {
  section: { count: 22 },
  ext: 'webp',
  base: '/journey',
};

const pad = (n: number) => String(n).padStart(3, '0');

export default function Nanoparticle() {
  const host = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(false);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia(`(min-width: ${TUNING.gatePx}px)`).matches) return;
    setOk(true);
  }, []);

  useEffect(() => {
    if (!ok || !host.current) return;
    const el = host.current;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setNear(true);
      },
      { rootMargin: '120% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ok]);

  useEffect(() => {
    if (!ok || !near || !host.current) return;
    const el = host.current;
    let disposed = false;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    el.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: true });

    const section: (ImageBitmap | null)[] = new Array(MANIFEST.section.count).fill(null);

    const load = async (shot: 'section', i: number, into: (ImageBitmap | null)[]) => {
      try {
        const res = await fetch(`${MANIFEST.base}/${shot}_${pad(i)}.${MANIFEST.ext}`);
        if (!res.ok) return;
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        if (disposed) { bmp.close(); return; }
        into[i] = bmp;
      } catch {
        /* a missing frame is survivable: the nearest loaded one is drawn */
      }
    };

    // The opening frame first, then the rest, so something is on screen as
    // early as possible rather than after the whole sequence has landed.
    (async () => {
      await load('section', 0, section);
      const rest: Promise<void>[] = [];
      for (let i = 1; i < MANIFEST.section.count; i++) rest.push(load('section', i, section));
      await Promise.all(rest);
    })();

    let want: JourneyFrame | null = null;
    let place = { x: 0, y: 0, r: 0 };
    const have = { x: 0, y: 0, r: 0 };
    let first = true;

    const unregister = registerParticle({
      set(frame) { want = frame; },
      place(x, y, radius) {
        place = { x, y, r: radius };
        if (first) { have.x = x; have.y = y; have.r = radius; first = false; }
      },
    });

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round((el.clientWidth || 1) * dpr);
      canvas.height = Math.round((el.clientHeight || 1) * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    /** Nearest loaded frame at or before `i`, so a gap never blanks the frame. */
    const pick = (arr: (ImageBitmap | null)[], i: number) => {
      const n = arr.length;
      const k = Math.max(0, Math.min(n - 1, i));
      if (arr[k]) return arr[k];
      for (let d = 1; d < n; d++) {
        if (arr[k - d]) return arr[k - d];
        if (arr[k + d]) return arr[k + d];
      }
      return null;
    };

    let raf = 0;
    let running = true;
    let last = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const f = want;
      // POSITION IS NOT SMOOTHED HERE, and must not be.
      //
      // It was, with the same exponential filter the radius still uses, and
      // that filter runs in screen space: it walks the dot in a straight line
      // toward wherever the curve currently says it is. Scrolled slowly the
      // step is a pixel or two and the straight line is indistinguishable from
      // the arc. Scrolled fast the target jumps most of the way along a bend
      // and the dot chords across it — measured at 13px inside the top of the
      // curve on a single jump through the travel, against 0.5px at rest.
      //
      // The inertia the filter was there for belongs to progress, not to
      // pixels: ScrollTrigger's `scrub` already eases the progress value, and
      // easing progress moves the dot ALONG the curve rather than across it.
      // So the position is taken exactly as projected, and the trailing weight
      // comes from the one smoother that cannot leave the path.
      have.x = place.x;
      have.y = place.y;

      // The radius keeps its filter — it is a scalar with no path to leave,
      // and it is what stops a resize or a camera step popping the dot's size.
      // Frame-rate independent: `lag` is a per-frame fraction, so taken
      // literally it converges twice as fast on a 120Hz display as on a 60Hz
      // one. The delta is clamped so a backgrounded tab does not come back and
      // snap in one step.
      const dt = last ? Math.min(0.05, Math.max(0.001, (now - last) / 1000)) : 1 / 60;
      last = now;
      const tau = -(1 / 60) / Math.log(1 - TUNING.particle.lag);
      have.r += (place.r - have.r) * (1 - Math.exp(-dt / tau));

      if (!ctx) return;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!f || have.r <= 0.5 || f.lnpOpacity <= 0.002) return;
      ctx.globalAlpha = f.lnpOpacity;

      // The whole sequence maps onto one number: how far the cut has closed.
      // It holds on the last frame for the rest of the journey.
      //
      // Two frames, cross-dissolved by the fraction between them, rather than
      // the nearest one. There are 22 renders of the closing shell and no
      // budget for more — they are 1.7MB as it is — so snapping to the nearest
      // meant the close played back as 22 discrete states no matter how
      // smoothly it was scrubbed. Blending costs one extra drawImage and turns
      // the same 22 frames into a continuous move.
      const at = f.lnpClose * (MANIFEST.section.count - 1);
      const i = Math.floor(at);
      const frac = at - i;
      const bmp = pick(section, i);
      if (!bmp) return;
      // The exact next frame, not `pick`'s nearest-loaded fallback: blending
      // toward a frame two or three along would be worse than not blending.
      const next = frac > 0.001 ? section[i + 1] ?? null : null;

      // A glow behind the particle, weighted toward small sizes. Through the
      // journey the particle is only about 30px across, and an 800px render of
      // several thousand lipids downsampled that far is unreadable noise — at
      // that size what should read is a warm bead moving through the body, so
      // the glow carries it and the detail carries the two ends.
      // Out entirely by the time the particle is ~100px across. The detailed
      // render does not need a halo, and at the opening size the glow was
      // still at 23% — a 460px radius inside a 652px canvas, which the canvas
      // edge then cut off as a straight vertical line down the left.
      const small = 1 - Math.min(1, Math.max(0, (have.r - 18) / 70));
      if (small > 0.01) {
        // Never wider than the room it has. The gradient reaches zero at `gr`,
        // so keeping gr inside the nearest edge means there is nothing left to
        // clip; letting it overhang is what produces a boxed-off glow.
        const fit = Math.min(have.x, have.y, W - have.x, H - have.y);
        const gr = Math.min(have.r * (2.6 + small * 3.2), Math.max(1, fit));
        const g = ctx.createRadialGradient(
          have.x * dpr, have.y * dpr, 0,
          have.x * dpr, have.y * dpr, gr * dpr,
        );
        g.addColorStop(0, `rgba(255,205,140,${(0.34 * small).toFixed(3)})`);
        g.addColorStop(0.4, `rgba(242,160,61,${(0.14 * small).toFixed(3)})`);
        // Out well before the edge of the gradient, so if the glow ever does
        // reach the edge of the canvas there is nothing left to clip.
        g.addColorStop(0.78, 'rgba(242,160,61,0.01)');
        g.addColorStop(1, 'rgba(242,160,61,0)');
        ctx.fillStyle = g;
        ctx.fillRect(
          (have.x - gr) * dpr, (have.y - gr) * dpr, gr * 2 * dpr, gr * 2 * dpr,
        );
      }

      // The rendered sphere occupies a known fraction of its frame, so the
      // page's radius maps onto the image rather than onto its padding.
      const box = have.r * 2 * (1 / 0.78);
      const put = (img: ImageBitmap) => ctx.drawImage(
        img,
        (have.x - box / 2) * dpr,
        (have.y - box / 2) * dpr,
        box * dpr,
        box * dpr,
      );
      put(bmp);
      // Source-over at `frac` on top of the frame below is a cross-dissolve:
      // the pair reads as the state between them.
      if (next && next !== bmp) {
        ctx.globalAlpha = f.lnpOpacity * frac;
        put(next);
      }
      ctx.globalAlpha = 1;
    };

    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(draw); } };
    const stop = () => { if (running) { running = false; cancelAnimationFrame(raf); } };
    raf = requestAnimationFrame(draw);

    const vis = new IntersectionObserver(
      ([e]) => (e.isIntersecting && !document.hidden ? start() : stop()),
      { rootMargin: '10% 0px' },
    );
    vis.observe(el);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      vis.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      unregister();
      for (const b of section) b?.close();
      canvas.remove();
    };
  }, [ok, near]);

  if (!ok) return null;
  return <div ref={host} className="absolute inset-0" aria-hidden="true" />;
}
