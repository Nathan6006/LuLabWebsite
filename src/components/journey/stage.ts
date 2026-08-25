/**
 * The stage: everything that is not WebGL.
 *
 * Owns the ground colour and every element inside the scaffold SVG. It exposes
 * two methods — `measure()`, which does all the reading, and `apply(frame)`,
 * which does all the writing. The controller never calls them in the same
 * breath, so a scrubbed frame is write-only and cannot thrash layout.
 *
 * Nothing here reads scroll position, and nothing here holds a clock.
 */
import {
  TUNING,
  clamp01,
  easeOutQuart,
  type JourneyFrame,
  type Tuning,
} from '../../lib/journey';

interface Sample {
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
  /** Where the injection site currently sits, in pixels relative to `host`. */
  injectionPoint(host: Element): { x: number; y: number } | null;
}

export function createStage(root: HTMLElement, cfg: Tuning = TUNING): Stage | null {
  const svg = root.querySelector<SVGSVGElement>('[data-journey-svg]');
  const ground = root.querySelector<HTMLElement>('[data-journey-ground]');
  if (!svg || !ground) return null;

  const body = svg.querySelector<SVGPathElement>('#body-outline');
  const limbs = svg.querySelector<SVGPathElement>('#limb-outline');
  const vessel = svg.querySelector<SVGPathElement>('#vessel-path');
  const figure = svg.querySelector<SVGGElement>('[data-journey-figure]');
  const trailGroup = svg.querySelector<SVGGElement>('[data-journey-trail]');
  const dot = svg.querySelector<SVGGElement>('[data-journey-dot]');
  const pulse = svg.querySelector<SVGCircleElement>('[data-journey-pulse]');
  const target = svg.querySelector<SVGGElement>('[data-journey-target]');
  const injection = svg.querySelector<SVGCircleElement>('[data-journey-injection]');
  if (!body || !limbs || !vessel || !figure || !trailGroup || !dot || !pulse || !target || !injection) {
    return null;
  }

  /* ---- Geometry, sampled once -----------------------------------------
     getPointAtLength is a geometry call, not a layout read, but it is still
     work: 48 segments times a handful of samples each, every frame, for
     something that never changes. The viewBox is fixed, so the table is
     computed once and the hot path only interpolates it. */
  const segCount = Math.max(4, Math.round(cfg.trail.segments));
  const perSeg = 4;
  const sampleCount = segCount * perSeg;
  const table: Sample[] = [];
  const segments: SVGPathElement[] = [];
  let vesselLength = 0;

  const buildTable = () => {
    vesselLength = vessel.getTotalLength();
    table.length = 0;
    for (let i = 0; i <= sampleCount; i++) {
      const pt = vessel.getPointAtLength((i / sampleCount) * vesselLength);
      table.push({ x: pt.x, y: pt.y });
    }
  };

  const buildSegments = () => {
    trailGroup.replaceChildren();
    segments.length = 0;
    for (let s = 0; s < segCount; s++) {
      const from = s * perSeg;
      // Overlap by one sample so the joins do not show as gaps.
      const to = Math.min(sampleCount, from + perSeg + 1);
      let d = `M ${table[from].x.toFixed(2)} ${table[from].y.toFixed(2)}`;
      for (let i = from + 1; i <= to; i++) d += ` L ${table[i].x.toFixed(2)} ${table[i].y.toFixed(2)}`;
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

  /** Position along the path from the lookup table, linearly interpolated. */
  const pointAt = (t: number): Sample => {
    const f = clamp01(t) * sampleCount;
    const i = Math.min(sampleCount - 1, Math.floor(f));
    const k = f - i;
    const a = table[i];
    const b = table[i + 1];
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };

  const apply = (frame: JourneyFrame) => {
    const C = cfg.colors;
    const T = cfg.trail;

    // Two-leg blend through the waypoint, so the inversion never goes grey.
    const gm = frame.groundMix;
    ground.style.backgroundColor =
      gm < 0.5 ? mixHex(C.navy, C.mid, gm * 2) : mixHex(C.mid, C.warm, (gm - 0.5) * 2);

    // Draw-in. One dash the length of the whole stroke, pulled back into view.
    body.style.strokeDashoffset = String(bodyLen * (1 - frame.bodyDraw));
    limbs.style.strokeDashoffset = String(limbLen * (1 - frame.limbDraw));
    figure.style.opacity = String(frame.bodyOpacity);

    // Trail. Ahead of the point the route sits at a low opacity; behind it the
    // segment lights and then settles back — by distance behind the point, so
    // it is reversible and holds still when the scroll does.
    const head = frame.dotDistance;
    for (let s = 0; s < segCount; s++) {
      const centre = (s + 0.5) / segCount;
      let op: number;
      if (centre > head) {
        op = T.ahead;
      } else {
        const behind = head - centre;
        const k = easeOutQuart(clamp01(behind / Math.max(1e-4, T.length)));
        op = T.lit + (T.settled - T.lit) * k;
      }
      segments[s].setAttribute('opacity', (op * frame.bodyOpacity).toFixed(3));
    }

    const at = pointAt(head);
    dot.style.transform = `translate(${at.x.toFixed(2)}px, ${at.y.toFixed(2)}px) scale(${frame.dotScale.toFixed(3)})`;
    dot.style.opacity = String(frame.dotOpacity);

    injection.style.opacity = String(frame.bodyOpacity * (1 - frame.dotDistance * 0.6));
    target.style.opacity = String(frame.bodyOpacity * (0.35 + 0.65 * frame.dotDistance));

    // One pulse, once. `frame.pulse` rises and falls across its range and is
    // zero everywhere else, so there is nothing to reset and nothing to repeat.
    const grow = 1 + (cfg.pulse.scale - 1) * (1 - Math.pow(1 - frame.pulse, 2));
    pulse.style.transform = `scale(${grow.toFixed(3)})`;
    pulse.style.opacity = (frame.pulse * cfg.pulse.opacity * frame.bodyOpacity).toFixed(3);
  };

  const injectionPoint = (host: Element) => {
    const rect = injection.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    return {
      x: rect.left + rect.width / 2 - hostRect.left,
      y: rect.top + rect.height / 2 - hostRect.top,
    };
  };

  measure();
  return { measure, apply, injectionPoint };
}
