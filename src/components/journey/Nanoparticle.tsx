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
  release: { count: number };
  ext: string;
  base: string;
}

const MANIFEST: Manifest = {
  section: { count: 22 },
  release: { count: 30 },
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
    const release: (ImageBitmap | null)[] = new Array(MANIFEST.release.count).fill(null);

    const load = async (shot: 'section' | 'release', i: number, into: (ImageBitmap | null)[]) => {
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
      for (let i = 0; i < MANIFEST.release.count; i++) rest.push(load('release', i, release));
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

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const f = want;
      const k = TUNING.particle.lag;
      have.x += (place.x - have.x) * k;
      have.y += (place.y - have.y) * k;
      have.r += (place.r - have.r) * k;

      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!f || have.r <= 0.5) return;

      // The release takes over exactly where the shell starts to part. Before
      // that, the section sequence closes across the pull-back and then holds
      // on its last frame — the closed particle — for the whole journey. Both
      // sequences are the same object at the same framing, so the swap is
      // invisible.
      const open = f.lnpOpen;
      let bmp: ImageBitmap | null;
      if (open > 0.001) {
        bmp = pick(release, Math.round(open * (MANIFEST.release.count - 1)));
      } else {
        const close = Math.min(1, f.p / Math.max(1e-6, TUNING.shots.pullBack[1]));
        bmp = pick(section, Math.round(close * (MANIFEST.section.count - 1)));
      }
      if (!bmp) return;

      // A glow behind the particle, weighted toward small sizes. Through the
      // journey the particle is only about 30px across, and an 800px render of
      // several thousand lipids downsampled that far is unreadable noise — at
      // that size what should read is a warm bead moving through the body, so
      // the glow carries it and the detail carries the two ends.
      const small = 1 - Math.min(1, (have.r - 22) / 150);
      if (small > 0.01) {
        const gr = have.r * (2.6 + small * 3.2);
        const g = ctx.createRadialGradient(
          have.x * dpr, have.y * dpr, 0,
          have.x * dpr, have.y * dpr, gr * dpr,
        );
        g.addColorStop(0, `rgba(255,205,140,${(0.34 * small).toFixed(3)})`);
        g.addColorStop(0.45, `rgba(242,160,61,${(0.16 * small).toFixed(3)})`);
        g.addColorStop(1, 'rgba(242,160,61,0)');
        ctx.fillStyle = g;
        ctx.fillRect(
          (have.x - gr) * dpr, (have.y - gr) * dpr, gr * 2 * dpr, gr * 2 * dpr,
        );
      }

      // The rendered sphere occupies a known fraction of its frame, so the
      // page's radius maps onto the image rather than onto its padding.
      const box = have.r * 2 * (1 / 0.78);
      ctx.drawImage(
        bmp,
        (have.x - box / 2) * dpr,
        (have.y - box / 2) * dpr,
        box * dpr,
        box * dpr,
      );
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
      for (const b of release) b?.close();
      canvas.remove();
    };
  }, [ok, near]);

  if (!ok) return null;
  return <div ref={host} className="absolute inset-0" aria-hidden="true" />;
}
