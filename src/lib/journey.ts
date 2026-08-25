/**
 * The LNP journey — every tunable value, and the pure function that turns one
 * scroll progress value into a frame.
 *
 * Nothing in this file touches the DOM, GSAP, WebGL or `window`. That is the
 * point: the whole shot list is a pure function of `p`, so scrolling backwards
 * reverses the animation exactly by construction rather than by care, and the
 * mapping can be exercised without a browser.
 *
 * `JOURNEY` is deliberately mutable. The debug panel (`?debug`) writes into it
 * live and `computeFrame` reads it on every call, so the section can be tuned
 * in the browser and the result copied back out as JSON.
 *
 * See ANIMATION_SPEC.md for what each range is meant to look like.
 */

/* ---- Tunables ------------------------------------------------------------
   Ranges are [start, end] in progress through the pinned section. They are
   allowed to overlap; each one is normalised independently. */
export const JOURNEY = {
  /** Pinned distance, in viewport heights. */
  pinVh: 2.4,
  /** ScrollTrigger scrub lag, in seconds. */
  scrub: 0.6,
  /** Below this width there is no pin, no canvas and no scrub — static frame. */
  gatePx: 1024,

  shots: {
    /** Particle holds, filling the frame and turning. */
    particleHold: [0.0, 0.2],
    /** Camera pulls back; the particle shrinks toward the injection site. */
    pullBack: [0.2, 0.35],
    /** The particle fades out. Ends before the ground has finished lifting —
        the point cloud is additively blended and would vanish on off-white. */
    particleFade: [0.22, 0.32],
    /** Ground inverts, dark navy to warm off-white. */
    groundLift: [0.25, 0.4],
    /** The silhouette draws itself, head and torso first. */
    bodyDraw: [0.35, 0.43],
    /** Limbs follow. */
    limbDraw: [0.39, 0.47],
    /** The point travels the vessel path. */
    travel: [0.45, 0.75],
    /** Arrival: the point settles. */
    arrival: [0.75, 0.85],
    /** One pulse at the target. Not repeated. */
    pulse: [0.78, 0.88],
    /** Camera pushes back in; the point resolves into the particle. */
    pushIn: [0.85, 1.0],
    /** The particle opens and the strand unspools. */
    unspool: [0.9, 1.0],
    /** Ground returns to navy. */
    groundFall: [0.86, 0.95],
    /** The silhouette recedes as the camera comes back in. */
    bodyFade: [0.85, 0.95],
  },

  /** Camera scale of the particle. `in` is the opening and closing frame — the
      two are the same value, which is what makes the bookends symmetrical. */
  particle: {
    scaleIn: 1.0,
    scaleOut: 0.06,
    /** Idle turn, radians per second. The only time-based term in the system. */
    idleSpin: 0.05,
    /** Turn across the opening shot, radians. */
    spinIn: 0.9,
    /** Fraction of frame height the particle fills in the opening shot. */
    frameFill: 0.72,
    /** Points in the cloud. */
    count: 9000,
    /** Easing toward the scrubbed value, per frame. */
    lag: 0.12,
  },

  travel: {
    /** Fraction of the path covered by the fast trunk section. */
    trunkEnd: 0.55,
    /** Progress spent on the trunk. Below trunkEnd this is faster than linear. */
    trunkTime: 0.42,
    /** How much the approach decelerates. 1 is linear, higher is slower. */
    approachPower: 2.4,
  },

  trail: {
    /** Segments the vessel path is cut into for the comet tail. */
    segments: 48,
    /** Tail length as a fraction of total path length. ~60px at this viewBox. */
    length: 0.14,
    /** Opacity of the path ahead of the point. */
    ahead: 0.1,
    /** Opacity immediately behind the point. */
    lit: 1.0,
    /** Opacity the lit path settles back to, far behind the point. */
    settled: 0.26,
  },

  pulse: {
    /** Radial glow scales from 1 to this. */
    scale: 2.5,
    /** Peak opacity. */
    opacity: 0.55,
  },

  colors: {
    navy: '#09143a',
    warm: '#f6f1e7',
    /** Waypoint for the ground blend. Without it navy to off-white crosses
        through a dead grey; this keeps the inversion blue the whole way. */
    mid: '#3f5580',
    /** Silhouette and vessel. CWRU blue; this recedes. */
    line: '#003071',
    lineOpacity: 0.34,
    /** The travelling point. The only warm colour in the section. */
    amber: '#f2a03d',
    amberBright: '#ffd9a0',
  },

  /** Where the SVG's injection site sits, in viewBox units. The canvas aims the
      shrinking particle at this point so the handoff lands on the same pixel. */
  geometry: {
    viewBox: [400, 640],
    injection: [288, 224],
    target: [168, 196],
  },
};

/** The mutable view the debug panel writes to and computeFrame reads. It is
    the same object — there is only ever one set of values in play. */
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

/**
 * Distance along the vessel path for a given travel fraction.
 *
 * Fast through the trunk, decelerating hard on the approach — constant
 * velocity is the single thing that makes this kind of animation read as
 * cheap. Piecewise so the two halves can be tuned independently.
 */
export function travelCurve(t: number, cfg: Tuning = TUNING): number {
  const { trunkEnd, trunkTime, approachPower } = cfg.travel;
  const tt = clamp01(t);
  if (tt <= trunkTime) {
    // Trunk: accelerate away from the injection site and hold speed. An
    // ease-out here would put half the path behind the point in the first few
    // percent of the range, which is the opposite of what the shot asks for.
    const k = tt / Math.max(1e-6, trunkTime);
    return smoothstep(k) * trunkEnd;
  }
  const k = (tt - trunkTime) / Math.max(1e-6, 1 - trunkTime);
  return trunkEnd + (1 - Math.pow(1 - k, approachPower)) * (1 - trunkEnd);
}

/* ---- The frame -----------------------------------------------------------
   One flat record of already-eased numbers. Nothing downstream knows what
   percentage it is, what range it came from, or what easing it got. */
export interface JourneyFrame {
  p: number;
  /** 0 navy, 1 warm off-white. */
  groundMix: number;
  particleOpacity: number;
  /** 1 fills the frame, 0 is a point. */
  particleScale: number;
  /** 0 closed, 1 open with the strand out. */
  particleOpen: number;
  /** How much of the strand has unspooled. */
  particleStrand: number;
  /** 0 centred, 1 sitting on the injection site. */
  particleAim: number;
  /** Turn applied to the cloud, radians, from scroll alone. */
  particleSpin: number;
  bodyDraw: number;
  limbDraw: number;
  bodyOpacity: number;
  /** 0..1 along the vessel path. */
  dotDistance: number;
  dotOpacity: number;
  dotScale: number;
  pulse: number;
  /** The static composition's open particle. Only used off the animated path. */
  finalGlow: number;
}

export function computeFrame(p: number, cfg: Tuning = TUNING): JourneyFrame {
  const s = cfg.shots;
  const q = clamp01(p);

  const pull = easeOutExpo(span(q, s.pullBack));
  const fade = span(q, s.particleFade);
  const pushIn = span(q, s.pushIn);
  const travel = travelCurve(span(q, s.travel), cfg);
  const arrive = span(q, s.arrival);
  const bodyFade = span(q, s.bodyFade);

  // The point exists from the moment the particle has finished fading until
  // the camera starts coming back in. Outside that the canvas owns the frame.
  const dotIn = clamp01((q - s.particleFade[0]) / Math.max(1e-6, s.particleFade[1] - s.particleFade[0]));
  const dotOut = 1 - easeInQuad(pushIn);

  // Opening and closing camera scale are the same constant, reached from
  // opposite directions.
  const { scaleIn, scaleOut } = cfg.particle;
  const shrink = scaleIn + (scaleOut - scaleIn) * pull;
  const grow = scaleOut + (scaleIn - scaleOut) * easeOutExpo(pushIn);
  const inBookendOut = q >= s.pushIn[0];

  return {
    p: q,
    groundMix: easeInOut(span(q, s.groundLift)) * (1 - easeInOut(span(q, s.groundFall))),
    particleOpacity: inBookendOut
      ? easeOutQuart(clamp01(pushIn / 0.35))
      : 1 - easeInQuad(fade),
    particleScale: inBookendOut ? grow : shrink,
    particleOpen: inBookendOut ? easeOutQuart(span(q, s.unspool)) : 0,
    particleStrand: inBookendOut ? easeOutQuart(span(q, s.unspool)) : 0,
    particleAim: inBookendOut ? 1 - easeOutExpo(pushIn) : pull,
    particleSpin: cfg.particle.spinIn * easeOutQuart(span(q, [0, s.pullBack[1]])),
    bodyDraw: easeOutQuart(span(q, s.bodyDraw)),
    limbDraw: easeOutQuart(span(q, s.limbDraw)),
    bodyOpacity: 1 - easeInOut(bodyFade),
    dotDistance: travel,
    dotOpacity: dotIn * dotOut,
    // Settles on arrival rather than stopping dead.
    dotScale: 1 + 0.35 * bell(arrive) * (1 - arrive * 0.4),
    pulse: bell(span(q, s.pulse)),
    finalGlow: 0,
  };
}

/** The composition shown with no script, under reduced motion, and below the
    gate: the arrival frame, on the warm ground, with the cargo released. */
export const STATIC_FRAME: JourneyFrame = {
  ...computeFrame(0.84),
  groundMix: 1,
  bodyOpacity: 1,
  bodyDraw: 1,
  limbDraw: 1,
  dotDistance: 1,
  dotOpacity: 1,
  dotScale: 1,
  particleOpacity: 0,
  pulse: 0,
  finalGlow: 1,
};
