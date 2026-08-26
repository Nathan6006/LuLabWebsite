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
    /**
     * Resistance. Nothing advances; the scene only tightens, so there is a
     * beat to take in the cross-section before it closes. The strain is the
     * cue that scrolling is registering.
     */
    strain: [0.0, 0.11],
    /**
     * The cut closes. Deliberately short: with a fixed 22 frames, the fewer
     * pixels of scroll they are spread over the more frames land per pixel,
     * and the smoother the close reads. Stretched out it stepped visibly.
     */
    close: [0.11, 0.21],
    /** Camera pulls back; the particle shrinks toward a point of light. */
    shrink: [0.19, 0.40],
    /** The curve draws itself in ahead of the particle. */
    curveDraw: [0.16, 0.42],
    /** The body appears from nothing. */
    bodyFade: [0.24, 0.40],
    /** The silhouette draws itself once it is there. */
    bodyDraw: [0.26, 0.42],
    /** Limbs follow. */
    limbDraw: [0.30, 0.46],
    /** The point travels: a short approach, then in at the upper arm. */
    travel: [0.42, 0.74],
    /** Arrival. It settles rather than stopping dead. */
    arrival: [0.74, 0.80],
    /** A second beat of resistance, before the release. */
    settle: [0.74, 0.84],
    /** The bloom: a calm glow spreading out over the figure. */
    bloom: [0.84, 1.0],
    /** Ground lifts, very slightly. Not an inversion — see the spec. */
    groundLift: [0.20, 0.40],
  },

  camera: {
    /** Zoom on the opening frame. 1 is the whole scene in view. */
    zoomIn: 4.6,
    /** Zoom held from the travel onward. The camera no longer pushes back in
        at the end: the closing beat is a bloom over the whole figure, and it
        has to be able to see the whole figure. */
    zoomOut: 1.0,
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
    /** How small the particle gets by the time it reaches the body, on top of
        what the camera pull-back already does. It arrives as a point of
        light, not a small sphere. */
    shrink: 0.09,
    /** How far the scene compresses during a resistance beat. Small on
        purpose — it should register as tension, not as movement. */
    strain: 0.022,
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

  /** The scene, in viewBox units. Roughly square now: the section shares a
      row with the mission statement rather than running full-bleed. */
  geometry: {
    viewBox: [1000, 1000],
    /** Where the particle starts, and where it ends up. */
    start: [350, 430],
    target: [648, 348],
  },

  bloom: {
    /** Radius the glow reaches, in scene units — comfortably more than the
        height of the figure, so it washes over all of it rather than sitting
        on the chest as a patch. */
    radius: 560,
    opacity: 0.95,
    /** How much the silhouette itself brightens as the bloom passes. The
        point of the beat is an effect on the body, so the body has to be
        visibly affected. */
    bodyLift: 1.3,
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
  const q = clamp01(p);

  const cx = vw / 2;
  const cy = vh / 2;

  // One move: tight on the particle, pulling back to the whole scene, and
  // staying there. The camera does not push back in at the end any more —
  // the closing beat is a bloom across the whole figure, which it has to be
  // able to see.
  const out = easeInOut(span(q, s.shrink));
  let x = mix(sx, cx, out);
  let y = mix(sy, cy, out);
  const zoom = mix(c.zoomIn, c.zoomWide, out);

  // A little drift toward the point while it travels, so the frame is not
  // dead still through the middle. Ramped by `out`: gated at out >= 1 it
  // appeared in a single frame and jolted the camera ~130 scene units.
  if (onCurve) {
    const k = c.follow * out;
    x = mix(x, onCurve.x, k);
    y = mix(y, onCurve.y, k);
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
  /** How far the cross-section has closed. Drives the frame sequence. */
  lnpClose: number;
  /** Turn from scroll alone, radians. */
  lnpSpin: number;
  /** How much of the curve exists yet. */
  curveDraw: number;
  bodyOpacity: number;
  bodyDraw: number;
  limbDraw: number;
  sceneOpacity: number;
  /** Resistance: the scene tightens without advancing. */
  strain: number;
  /** The closing glow, spreading over the figure. */
  bloom: number;
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
  const out = easeInOut(span(q, s.shrink));
  const camera = cameraAt(q, cfg, curvePoint?.(travel));

  // Two resistance beats: before the cut closes, and before the bloom. Each
  // builds as its window fills and releases the moment the thing it was
  // holding back begins.
  const strainA = easeInQuad(span(q, s.strain)) * (1 - span(q, s.close));
  const strainB = easeInQuad(span(q, s.settle)) * (1 - span(q, s.bloom));

  return {
    p: q,
    camera,
    svgCamera: damp(camera, cfg),
    groundMix: easeInOut(span(q, s.groundLift)),
    lnpDistance: travel,
    // Shrinks to a point of light by the time it reaches the body, and stays
    // one. There is no push back in.
    lnpScale: mix(1, cfg.particle.shrink, out),
    // Gone early: the bloom is the subject of the closing beat, and a bright
    // dot still sitting at its centre reads as two things happening.
    lnpOpacity: 1 - easeOutQuart(span(q, [s.bloom[0], s.bloom[0] + 0.06])),
    lnpClose: easeOutQuart(span(q, s.close)),
    lnpSpin: cfg.particle.spin * easeOutQuart(q),
    curveDraw: easeOutQuart(span(q, s.curveDraw)),
    bodyOpacity: easeOutQuart(span(q, s.bodyFade)),
    bodyDraw: easeOutQuart(span(q, s.bodyDraw)),
    limbDraw: easeOutQuart(span(q, s.limbDraw)),
    sceneOpacity: 1,
    strain: Math.max(strainA, strainB) * cfg.particle.strain,
    bloom: easeOutQuart(span(q, s.bloom)),
    pulse: bell(span(q, s.arrival)),
  };
}

/** The composition shown with no script, under reduced motion, and below the
    gate: the whole scene at rest, curve filled, particle at the target. */
export const STATIC_FRAME: JourneyFrame = {
  ...computeFrame(0.78),
  camera: { x: 500, y: 500, zoom: 1 },
  svgCamera: { x: 500, y: 500, zoom: 1 },
  groundMix: 1,
  lnpDistance: 1,
  bodyOpacity: 1,
  bodyDraw: 1,
  limbDraw: 1,
  sceneOpacity: 1,
  strain: 0,
  bloom: 0,
  pulse: 0,
};
