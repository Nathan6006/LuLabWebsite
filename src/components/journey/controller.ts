/**
 * The scroll controller: the only thing in the section that knows what
 * scrolling is.
 *
 * It owns one ScrollTrigger, turns its progress into a frame with
 * `computeFrame`, and hands that frame to the two renderers. Neither the stage
 * nor the WebGL island reads scroll position, and neither holds a clock that
 * decides anything structural.
 *
 * All reading happens at refresh — path length, the sample table, the injection
 * site's screen position. The update path is write-only.
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

  // Flips the SVG out of its shipped final-frame state and into the animated
  // one. Only ever set once everything above has been confirmed.
  section.classList.add('is-animated');

  /** Debug override, set by the panel's progress slider. */
  let override: number | null = null;
  let lastP = 0;

  const render = (p: number) => {
    lastP = p;
    const frame: JourneyFrame = computeFrame(p, cfg);
    stage.apply(frame);
    getParticle()?.set(frame);
  };

  /** Everything that reads geometry. Never called from an update. */
  const remeasure = () => {
    stage.measure();
    const pt = stage.injectionPoint(canvasHost);
    if (pt) getParticle()?.aim(pt.x, pt.y);
  };

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * cfg.pinVh,
    pin: stagePin,
    // Pin by moving the element, not by taking it out of flow. A `fixed` pin
    // switches a full-viewport element from static to fixed at the moment it
    // reaches the top, and the browser books that as a layout shift the size
    // of the element — measured at CLS ~2.0 per pass through the section, on
    // every trial. A transform pin leaves the box where it is and translates
    // it, which cannot shift layout at all.
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
  // it may register long after this runs. Hand it the aim point and the
  // current frame the moment it does.
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
