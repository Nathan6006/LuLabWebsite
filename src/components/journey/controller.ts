/**
 * The scroll controller: the only thing in the section that knows what
 * scrolling is.
 *
 * It owns one ScrollTrigger, turns its progress into a frame with
 * `computeFrame`, and hands that frame to the two renderers. Neither the stage
 * nor the WebGL island reads scroll position, and neither holds a clock that
 * decides anything structural.
 *
 * It is also what keeps the two renderers in the same scene: the particle's
 * position on the curve is projected through the same camera the SVG is given,
 * so the object cannot drift off the line it is supposed to be travelling.
 *
 * All reading happens at refresh — path length, the sample table, the host
 * box. The update path is write-only apart from one rect read per frame,
 * which is needed to project into pixels and is taken once, before any write.
 */
import { TUNING, computeFrame, type JourneyFrame } from '../../lib/journey';
import { getParticle, onParticle } from '../../lib/journey-bridge';
import { createStage } from './stage';

export interface JourneyHandles {
  refresh(): void;
}

export function initJourney(ScrollTrigger: any): JourneyHandles | null {
  const section = document.querySelector<HTMLElement>('[data-journey]');
  if (!section) return null;

  const cfg = TUNING;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = window.matchMedia(`(min-width: ${cfg.gatePx}px)`).matches;

  // Below the gate and under reduced motion the section keeps the static
  // composition it shipped with. No pin, no scrub, no canvas, no ogl.
  if (reduced || !wide) return null;

  const stagePin = section.querySelector<HTMLElement>('[data-journey-stage]');
  const canvasHost = section.querySelector<HTMLElement>('[data-journey-canvas]');
  if (!stagePin || !canvasHost) return null;

  const stage = createStage(section, cfg);
  if (!stage) return null;

  // The mission statement shares this section, so the word-by-word highlight
  // is inside the pinned element: its own ScrollTrigger would stop advancing
  // the moment the pin engaged. It runs off the pinned progress instead, over
  // the opening beats, so it is read before the journey gets going.
  const words = Array.from(section.querySelectorAll<HTMLElement>('.hl-word'));
  // Fast: the statement comes up to white well inside the opening resistance
  // beat, so it is done and read before the cross-section starts to close and
  // the two never pull at each other.
  const readWindow = [0.01, 0.13];

  // Flips the SVG out of its shipped final-frame state and into the animated
  // one. Only ever set once everything above has been confirmed.
  section.classList.add('is-animated');

  /** Debug override, set by the panel's progress slider. */
  let override: number | null = null;
  let lastP = 0;

  const render = (p: number) => {
    lastP = p;
    const frame: JourneyFrame = computeFrame(p, cfg, (t) => stage.pointAt(t));
    stage.apply(frame);

    if (words.length) {
      const t = Math.min(1, Math.max(0, (p - readWindow[0]) / (readWindow[1] - readWindow[0])));
      const head = t * words.length;
      for (let i = 0; i < words.length; i++) {
        // 0.5, not lower: white dimmed on a dark field loses contrast far
        // faster than dark ink on paper, and the tail still has to clear 3:1.
        words[i].style.opacity = String(0.5 + 0.5 * Math.min(1, Math.max(0, head - i)));
      }
    }

    const particle = getParticle();
    if (particle) {
      // The particle sits on the curve, seen through the camera the SVG is
      // using — one projection, so there is no second source of truth about
      // where "on the curve" is on screen.
      const scene = stage.pointAt(frame.lnpDistance);
      const at = stage.project(scene, frame.svgCamera, canvasHost);
      if (at) {
        particle.place(at.x, at.y, cfg.particle.radius * frame.lnpScale * at.scale);
      }
      particle.set(frame);
    }
  };

  /** Everything that reads geometry. Never called from an update. */
  const remeasure = () => {
    stage.measure();
  };

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * cfg.pinVh,
    pin: stagePin,
    // Pin by moving the element, not by taking it out of flow. A `fixed` pin
    // switches a full-viewport element from static to fixed at the moment it
    // reaches the top, and the browser books that as a layout shift the size
    // of the element — measured at CLS ~4 per pass through the section. A
    // transform pin leaves the box in flow and cannot shift layout at all.
    pinType: 'transform',
    scrub: cfg.scrub,
    invalidateOnRefresh: true,
    onRefresh: remeasure,
    onUpdate(self: { progress: number }) {
      if (override !== null) return;
      render(self.progress);
    },
  });

  remeasure();
  render(0);

  // The island defers its own setup until the section is near the viewport, so
  // it may register long after this runs. Give it a frame the moment it does.
  onParticle(() => {
    remeasure();
    render(lastP);
  });

  // The section is live: the CSS pre-state that hid the shipped composition
  // can come off, and the inline failsafe knows not to fire.
  section.classList.add('is-live');

  // The panel is only ever fetched when the query string asks for it.
  if (new URLSearchParams(location.search).has('debug')) {
    void import('./debug').then(({ mountDebugPanel }) => mountDebugPanel({
      cfg,
      getProgress: () => (override !== null ? override : lastP),
      setOverride(v) {
        override = v;
        if (v !== null) render(v);
        else render(trigger.progress ?? lastP);
      },
      rerender() {
        render(override !== null ? override : lastP);
      },
      refresh: () => ScrollTrigger.refresh(),
    }));
  }

  return { refresh: () => ScrollTrigger.refresh() };
}
