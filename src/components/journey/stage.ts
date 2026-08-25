/**
 * The stage: everything that is not WebGL.
 *
 * Owns the ground, the camera transform on the SVG, the curve, the body and
 * the pulse. It exposes `measure()`, which does all the reading, and
 * `apply(frame)`, which does all the writing. The controller never calls them
 * in the same breath, so a scrubbed frame is write-only and cannot thrash
 * layout.
 *
 * It also owns the curve geometry, because the curve is the one thing both
 * renderers need: the SVG draws it, and the WebGL particle rides it. The
 * lookup table built here is what the controller uses to tell the particle
 * where it is.
 *
 * Nothing here reads scroll position, and nothing here holds a clock.
 */
import {
  TUNING,
  clamp01,
  easeOutQuart,
  type Camera,
  type JourneyFrame,
  type Tuning,
} from '../../lib/journey';

export interface Point {
  x: number;
  y: number;
}

/** Blend two #rrggbb colours. Cheap, and only ever called once per frame. */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

export interface Stage {
  /** Reads geometry. Called at init and on every ScrollTrigger refresh. */
  measure(): void;
  apply(frame: JourneyFrame): void;
  /** A point along the curve, in scene units. */
  pointAt(t: number): Point;
  /**
   * Turn a scene point and a scene length into pixels relative to `host`,
   * under the given camera. This is how the WebGL particle is placed: it is
   * the same camera the SVG uses, so the two cannot drift apart.
   */
  project(scene: Point, cam: Camera, host: Element): { x: number; y: number; scale: number } | null;
}

export function createStage(root: HTMLElement, cfg: Tuning = TUNING): Stage | null {
  const svg = root.querySelector<SVGSVGElement>('[data-journey-svg]');
  const ground = root.querySelector<HTMLElement>('[data-journey-ground]');
  if (!svg || !ground) return null;

  const cameraGroup = svg.querySelector<SVGGElement>('[data-journey-camera]');
  const bodyGroup = svg.querySelector<SVGGElement>('[data-journey-body]');
  const body = svg.querySelector<SVGPathElement>('#body-outline');
  const limbs = svg.querySelector<SVGPathElement>('#limb-outline');
  const curve = svg.querySelector<SVGPathElement>('[data-journey-curve]');
  const trailGroup = svg.querySelector<SVGGElement>('[data-journey-trail]');
  const pulse = svg.querySelector<SVGCircleElement>('[data-journey-pulse]');
  const target = svg.querySelector<SVGGElement>('[data-journey-target]');
  if (!cameraGroup || !bodyGroup || !body || !limbs || !curve || !trailGroup || !pulse || !target) {
    return null;
  }

  const [vw, vh] = cfg.geometry.viewBox;

  /* ---- Geometry, sampled once -----------------------------------------
     getPointAtLength is a geometry call, not a layout read, but it is still
     work for something that never changes. The viewBox is fixed, so the table
     is built once and the hot path only interpolates it. */
  const segCount = Math.max(8, Math.round(cfg.trail.segments));
  const perSeg = 4;
  const sampleCount = segCount * perSeg;
  const table: Point[] = [];
  const segments: SVGPathElement[] = [];

  const buildTable = () => {
    const len = curve.getTotalLength();
    table.length = 0;
    for (let i = 0; i <= sampleCount; i++) {
      const pt = curve.getPointAtLength((i / sampleCount) * len);
      table.push({ x: pt.x, y: pt.y });
    }
  };

  const buildSegments = () => {
    trailGroup.replaceChildren();
    segments.length = 0;
    for (let s = 0; s < segCount; s++) {
      const from = s * perSeg;
      // Overlap by one sample so the joins do not read as gaps.
      const to = Math.min(sampleCount, from + perSeg + 1);
      let d = `M ${table[from].x.toFixed(2)} ${table[from].y.toFixed(2)}`;
      for (let i = from + 1; i <= to; i++) {
        d += ` L ${table[i].x.toFixed(2)} ${table[i].y.toFixed(2)}`;
      }
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', d);
      el.setAttribute('opacity', String(cfg.trail.ahead));
      trailGroup.appendChild(el);
      segments.push(el);
    }
  };

  const setDash = (path: SVGPathElement) => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    return len;
  };

  let bodyLen = 0;
  let limbLen = 0;

  const measure = () => {
    bodyLen = setDash(body);
    limbLen = setDash(limbs);
    buildTable();
    buildSegments();
  };

  const pointAt = (t: number): Point => {
    const f = clamp01(t) * sampleCount;
    const i = Math.min(sampleCount - 1, Math.floor(f));
    const k = f - i;
    const a = table[i];
    const b = table[i + 1];
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };

  /** The camera as an SVG transform: hold `cam` at the centre of the viewBox. */
  const transformFor = (cam: Camera) =>
    `translate(${(vw / 2 - cam.x * cam.zoom).toFixed(3)} ${(vh / 2 - cam.y * cam.zoom).toFixed(3)}) scale(${cam.zoom.toFixed(5)})`;

  /**
   * Scene units to host pixels. The SVG uses `xMidYMid slice`, so it covers
   * the box and the scale is whichever axis has to stretch further — the same
   * rule the browser applies, computed here so the particle lands on the
   * curve at every aspect ratio rather than only at the one it was authored
   * for.
   */
  const project = (scene: Point, cam: Camera, host: Element) => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const cover = Math.max(r.width / vw, r.height / vh);
    // Scene point under the camera, in viewBox units.
    const vx = (scene.x - cam.x) * cam.zoom + vw / 2;
    const vy = (scene.y - cam.y) * cam.zoom + vh / 2;
    // viewBox units to pixels, centred.
    return {
      x: r.width / 2 + (vx - vw / 2) * cover,
      y: r.height / 2 + (vy - vh / 2) * cover,
      scale: cam.zoom * cover,
    };
  };

  const apply = (frame: JourneyFrame) => {
    const C = cfg.colors;
    const T = cfg.trail;

    ground.style.backgroundColor = mixHex(C.navy, C.navyLift, frame.groundMix);
    cameraGroup.setAttribute('transform', transformFor(frame.svgCamera));

    // Draw-in. One dash the length of the whole stroke, pulled back into view.
    body.style.strokeDashoffset = String(bodyLen * (1 - frame.bodyDraw));
    limbs.style.strokeDashoffset = String(limbLen * (1 - frame.limbDraw));
    bodyGroup.style.opacity = String(frame.bodyOpacity);

    // The curve is the progress bar. Ahead of the particle it sits dim; behind
    // it, it lights and settles back — by distance behind, not elapsed time,
    // so it is reversible and holds still when the scroll does. `curveDraw`
    // gates how much of it exists at all, so it can draw in ahead of the
    // particle rather than being there from the first frame.
    const head = frame.lnpDistance;
    const drawn = frame.curveDraw;
    for (let s = 0; s < segCount; s++) {
      const centre = (s + 0.5) / segCount;
      let op: number;
      if (centre > drawn) {
        op = 0;
      } else if (centre > head) {
        op = T.ahead;
      } else {
        const k = easeOutQuart(clamp01((head - centre) / Math.max(1e-4, T.length)));
        op = T.lit + (T.settled - T.lit) * k;
      }
      const el = segments[s];
      el.setAttribute('opacity', (op * frame.sceneOpacity).toFixed(3));
      // Lit sections take the warm colour; the unfilled bar stays cool, so the
      // two halves of the progress bar are told apart by hue as well as value.
      el.setAttribute('stroke', centre > head ? C.line : C.amber);
      el.setAttribute('stroke-width', centre > head ? '2.4' : '3.4');
    }

    // The target should not be glowing before anything is on its way to it.
    target.style.opacity = String(frame.sceneOpacity * frame.lnpDistance * frame.bodyOpacity);

    // One pulse, once. `frame.pulse` rises and falls across its range and is
    // zero everywhere else, so there is nothing to reset and nothing to repeat.
    const grow = 1 + (cfg.pulse.scale - 1) * (1 - Math.pow(1 - frame.pulse, 2));
    pulse.style.transform = `scale(${grow.toFixed(3)})`;
    pulse.style.opacity = (frame.pulse * cfg.pulse.opacity * frame.sceneOpacity).toFixed(3);
  };

  measure();
  return { measure, apply, pointAt, project };
}
