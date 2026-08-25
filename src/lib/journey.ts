/**
 * The LNP journey — every tunable value, and the pure functions that turn one
 * scroll progress value into a camera and a frame.
 *
 * Nothing in this file touches the DOM, GSAP, WebGL or `window`. That is the
 * point: the whole shot list is a pure function of `p`, so scrolling backwards
 * reverses the animation exactly by construction rather than by care, and the
 * mapping can be exercised without a browser.
 *
 * `JOURNEY` is deliberately mutable. The debug panel (`?debug`) writes into it
 * live and the functions below read it on every call, so the section can be
 * tuned in the browser and the result copied back out as JSON.
 *
 * THE CAMERA IS THE WHOLE DESIGN. There is one continuous move from the
 * nanoparticle on the left to the target site inside the body on the right,
 * and every layer derives its transform from `cameraAt` and nothing else. An
 * earlier version crossfaded a WebGL layer against an SVG layer; because the
 * two shared no camera there was nothing for the eye to follow across the cut,
 * and it read as a teleport. Nothing here crossfades.
 *
 * See ANIMATION_SPEC.md for what each range is meant to look like.
 */

/* ---- Tunables ------------------------------------------------------------
   Ranges are [start, end] in progress through the pinned section. They are
   allowed to overlap; each one is normalised independently. */
export const JOURNEY = {
  /** Pinned distance, in viewport heights. Kept short on purpose: a longer
      pin makes readers feel stuck, and this is decoration, not an explainer. */
  pinVh: 1.8,
  /** ScrollTrigger scrub lag, in seconds. */
  scrub: 0.6,
  /** Below this width there is no pin, no canvas and no scrub — static frame. */
  gatePx: 1024,

  shots: {
    /** Camera holds tight on the particle while it turns. */
    hold: [0.0, 0.2],
    /** Camera pulls back and pans right. */
    pullBack: [0.2, 0.44],
    /** The curve draws itself in ahead of the particle. */
    curveDraw: [0.0, 0.38],
    /** The body appears from nothing. */
    bodyFade: [0.3, 0.44],
    /** The silhouette draws itself once it is there. */
    bodyDraw: [0.33, 0.47],
    /** Limbs follow. */
    limbDraw: [0.37, 0.51],
    /** The particle travels the curve. */
    travel: [0.46, 0.76],
    /** Arrival: it settles rather than stopping dead. */
    arrival: [0.76, 0.84],
    /** One pulse at the target. Never repeated. */
    pulse: [0.78, 0.88],
    /** Camera pushes all the way back in. */
    pushIn: [0.84, 1.0],
    /** The shell opens. */
    open: [0.88, 1.0],
    /** The strand unspools. */
    unspool: [0.9, 1.0],
    /** Body and curve recede as the camera comes in. */
    sceneOut: [0.86, 0.98],
    /** Ground lifts, very slightly. Not an inversion — see the spec. */
    groundLift: [0.24, 0.44],
  },

  camera: {
    /** Zoom on the opening frame. 1 is the whole scene in view. */
    zoomIn: 5.8,
    /** Zoom on the closing frame. The two are deliberately close. */
    zoomOut: 5.8,
    /** Zoom while the particle is travelling. */
    zoomWide: 1.0,
    /**
     * How much of the camera the SVG layer takes. Left at 1 — one camera for
     * every layer.
     *
     * This started at 0.16, on the theory that damping the SVG would keep the
     * curve on screen as a progress indicator while the camera was inside the
     * particle. It cannot: the particle rides the curve, so if the curve is
     * damped and the camera is not, the particle is no longer where the curve
     * says it is. It ended up pinned to the left edge at a fraction of its
     * intended size. Kept as a knob, but anything below 1 pulls the particle
     * off its own path.
     */
    svgParallax: 1.0,
    /** How much the camera drifts toward the particle during the travel. */
    follow: 0.22,
  },

  particle: {
    /** Radius in scene units at zoom 1. */
    radius: 46,
    /** Extra shrink applied across the pull-back, on top of the camera. */
    shrink: 0.62,
    /** Idle turn, radians per second. The only time term in the system. */
    idleSpin: 0.06,
    /** Turn driven by scroll, radians across the whole section. */
    spin: 1.5,
    /** Angle the particle settles to for the closing frame, radians. The turn
        is eased into this as the shell opens, so the release is composed
        rather than landing wherever the scroll happened to leave it. */
    heroAngle: -0.35,
    /** Easing toward the scrubbed value, per frame. */
    lag: 0.12,
  },

  travel: {
    /** Fraction of the curve covered by the fast section. */
    trunkEnd: 0.55,
    /** Progress spent on it. */
    trunkTime: 0.42,
    /** How hard the approach decelerates. 1 is linear. */
    approachPower: 2.4,
  },

  trail: {
    /** Segments the curve is cut into for the comet tail. */
    segments: 56,
    /** Tail length as a fraction of total curve length. */
    length: 0.16,
    /** Opacity of the curve ahead of the particle — the unfilled bar. */
    ahead: 0.13,
    /** Opacity immediately behind it. */
    lit: 1.0,
    /** What the lit curve settles back to — the filled bar. */
    settled: 0.34,
  },

  pulse: {
    scale: 2.6,
    opacity: 0.5,
  },

  colors: {
    /** The ground barely moves. A full inversion mid-animation is exactly the
        kind of hard cut this rebuild exists to remove. */
    navy: '#09143a',
    navyLift: '#0e2149',
    /** Silhouette and curve: light on dark, so the figure reads on navy. */
    line: '#a6d2e6',
    lineOpacity: 0.3,
    /** The particle, its trail and its glow. The only warm colour here. */
    amber: '#f2a03d',
    amberBright: '#ffd9a0',
  },

  /** The scene, in viewBox units. Everything is authored in this space. */
  geometry: {
    viewBox: [1600, 900],
    /** Where the particle starts, and where it ends up. */
    start: [200, 500],
    target: [1140, 320],
  },
};

/** The mutable view the debug panel writes to and the functions below read. */
export type Tuning = typeof JOURNEY;
export const TUNING: Tuning = JOURNEY;

/* ---- Easing --------------------------------------------------------------
   Nothing linear anywhere in the shot list. */
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Normalise `p` inside a range, clamped. */
export const span = (p: number, r: number[]) =>
  clamp01((p - r[0]) / Math.max(1e-6, r[1] - r[0]));

export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -9 * t));
export const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
export const easeInQuad = (t: number) => t * t;
export const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const smoothstep = (t: number) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};
/** Rises and falls once over 0..1. Used for the pulse. */
export const bell = (t: number) => Math.sin(clamp01(t) * Math.PI);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Distance along the curve for a given travel fraction.
 *
 * Fast through the middle, decelerating hard on the approach — constant
 * velocity is the single thing that makes this kind of animation read as
 * cheap. The first leg accelerates away rather than easing out: an ease-out
 * here puts half the curve behind the particle in the first few percent.
 */
export function travelCurve(t: number, cfg: Tuning = TUNING): number {
  const { trunkEnd, trunkTime, approachPower } = cfg.travel;
  const tt = clamp01(t);
  if (tt <= trunkTime) {
    const k = tt / Math.max(1e-6, trunkTime);
    return smoothstep(k) * trunkEnd;
  }
  const k = (tt - trunkTime) / Math.max(1e-6, 1 - trunkTime);
  return trunkEnd + (1 - Math.pow(1 - k, approachPower)) * (1 - trunkEnd);
}

/* ---- The camera ----------------------------------------------------------
   One focus point and one zoom for every progress value. Every layer in the
   section derives its transform from this. */
export interface Camera {
  /** Scene point held at the centre of the frame. */
  x: number;
  y: number;
  zoom: number;
}

export function cameraAt(
  p: number,
  cfg: Tuning = TUNING,
  onCurve?: { x: number; y: number },
): Camera {
  const s = cfg.shots;
  const c = cfg.camera;
  const [vw, vh] = cfg.geometry.viewBox;
  const [sx, sy] = cfg.geometry.start;
  const [tx, ty] = cfg.geometry.target;
  const q = clamp01(p);

  const cx = vw / 2;
  const cy = vh / 2;

  // Leg 1 — tight on the particle, pulling back to the whole scene.
  const out = easeInOut(span(q, s.pullBack));
  let x = mix(sx, cx, out);
  let y = mix(sy, cy, out);
  let zoom = mix(c.zoomIn, c.zoomWide, out);

  // Leg 2 — a little drift toward the particle while it travels, so the frame
  // is not dead still through the middle.
  //
  // Ramped by `out` rather than switched on at out >= 1. Gating it meant the
  // follow appeared in a single frame, moving the camera ~130 scene units
  // between two adjacent progress values — a visible jolt exactly where the
  // pull-back was supposed to be settling.
  if (onCurve) {
    const k = c.follow * out;
    x = mix(x, onCurve.x, k);
    y = mix(y, onCurve.y, k);
  }

  // Leg 3 — push back in, onto the target.
  const back = easeInOut(span(q, s.pushIn));
  if (back > 0) {
    x = mix(x, tx, back);
    y = mix(y, ty, back);
    zoom = mix(zoom, c.zoomOut, back);
  }

  return { x, y, zoom };
}

/* ---- The frame -----------------------------------------------------------
   One flat record of already-eased numbers. Nothing downstream knows what
   percentage it is, what range it came from, or what easing it got. */
export interface JourneyFrame {
  p: number;
  camera: Camera;
  /** The same camera, damped, for the SVG layer. */
  svgCamera: Camera;
  groundMix: number;
  /** 0..1 along the curve. */
  lnpDistance: number;
  /** Multiplier on the particle's scene radius. */
  lnpScale: number;
  lnpOpacity: number;
  lnpOpen: number;
  lnpStrand: number;
  /** Turn from scroll alone, radians. */
  lnpSpin: number;
  /** How much of the curve exists yet. */
  curveDraw: number;
  bodyOpacity: number;
  bodyDraw: number;
  limbDraw: number;
  sceneOpacity: number;
  pulse: number;
}

/** Damped copy of the camera, for layers that must stay legible when the
    camera is inside the particle. At zoom 1 this is the identity. */
function damp(cam: Camera, cfg: Tuning): Camera {
  const [vw, vh] = cfg.geometry.viewBox;
  const k = cfg.camera.svgParallax;
  return {
    x: mix(vw / 2, cam.x, k),
    y: mix(vh / 2, cam.y, k),
    zoom: 1 + (cam.zoom - 1) * k,
  };
}

export function computeFrame(
  p: number,
  cfg: Tuning = TUNING,
  curvePoint?: (t: number) => { x: number; y: number },
): JourneyFrame {
  const s = cfg.shots;
  const q = clamp01(p);

  const travel = travelCurve(span(q, s.travel), cfg);
  const push = easeInOut(span(q, s.pushIn));
  const out = easeInOut(span(q, s.pullBack));

  const camera = cameraAt(q, cfg, curvePoint?.(travel));

  // The particle shrinks a little further than the camera alone would take it,
  // and comes back exactly as far on the way in, so both bookends land on the
  // same apparent size.
  const shrink = Math.max(0.01, cfg.particle.shrink);

  return {
    p: q,
    camera,
    svgCamera: damp(camera, cfg),
    groundMix: easeInOut(span(q, s.groundLift)) * (1 - easeInOut(span(q, s.sceneOut))),
    lnpDistance: travel,
    lnpScale: mix(1, shrink, out) * mix(1, 1 / shrink, push),
    lnpOpacity: 1,
    lnpOpen: easeOutQuart(span(q, s.open)),
    lnpStrand: easeOutQuart(span(q, s.unspool)),
    lnpSpin: cfg.particle.spin * easeOutQuart(q),
    curveDraw: easeOutQuart(span(q, s.curveDraw)),
    bodyOpacity: easeOutQuart(span(q, s.bodyFade)) * (1 - easeInOut(span(q, s.sceneOut))),
    bodyDraw: easeOutQuart(span(q, s.bodyDraw)),
    limbDraw: easeOutQuart(span(q, s.limbDraw)),
    sceneOpacity: 1 - easeInOut(span(q, s.sceneOut)),
    pulse: bell(span(q, s.pulse)),
  };
}

/** The composition shown with no script, under reduced motion, and below the
    gate: the whole scene at rest, curve filled, particle at the target. */
export const STATIC_FRAME: JourneyFrame = {
  ...computeFrame(0.8),
  camera: { x: 800, y: 450, zoom: 1 },
  svgCamera: { x: 800, y: 450, zoom: 1 },
  groundMix: 1,
  lnpDistance: 1,
  lnpScale: 1,
  bodyOpacity: 1,
  bodyDraw: 1,
  limbDraw: 1,
  sceneOpacity: 1,
  pulse: 0,
};
