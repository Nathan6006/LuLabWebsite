/**
 * The typed channel between the scroll controller and the WebGL island.
 *
 * The two live in different bundles — one is an Astro page script, the other a
 * React island — so a module-scope singleton would not be shared between them
 * and `window` is the only reliable meeting point. This module is what makes
 * that a typed, namespaced contract instead of a bare global: everything is
 * under one `__luLab` key, and neither side reaches for a property name
 * directly.
 *
 * The controller must work whether or not the island ever registers — WebGL
 * may be unavailable, the island may still be idle, or the gate may have kept
 * it from loading at all. `getParticle()` returning undefined is a normal
 * state, not an error.
 */
import type { JourneyFrame } from './journey';

export interface ParticleBridge {
  /** Called once per scrubbed frame with the whole frame record. */
  set(frame: JourneyFrame): void;
  /**
   * Where the particle sits and how big it is, in pixels relative to the
   * island's own host box. The controller computes this by projecting the
   * particle's position on the curve through the same camera the SVG uses, so
   * the two cannot drift apart.
   */
  place(x: number, y: number, radius: number): void;
}

type Listener = (bridge: ParticleBridge) => void;

interface LuLabNamespace {
  journeyParticle?: ParticleBridge;
  /** Callbacks queued before the island registered. */
  journeyWaiting?: Listener[];
}

declare global {
  interface Window {
    __luLab?: LuLabNamespace;
  }
}

function ns(): LuLabNamespace {
  return (window.__luLab ??= {});
}

/** Publish the bridge. Returns the teardown, for the island's cleanup. */
export function registerParticle(bridge: ParticleBridge): () => void {
  const n = ns();
  n.journeyParticle = bridge;
  for (const fn of n.journeyWaiting ?? []) fn(bridge);
  n.journeyWaiting = [];
  return () => {
    if (ns().journeyParticle === bridge) delete ns().journeyParticle;
  };
}

/**
 * Run `fn` once the island has registered — immediately if it already has.
 *
 * The island defers its own setup until the section is near the viewport, so
 * on a page loaded at the top it may not register for a long time, or ever.
 * Polling for it with a deadline meant the placement was silently never
 * delivered on a slow load; this cannot miss.
 */
export function onParticle(fn: Listener): void {
  const n = ns();
  if (n.journeyParticle) {
    fn(n.journeyParticle);
    return;
  }
  (n.journeyWaiting ??= []).push(fn);
}

export function getParticle(): ParticleBridge | undefined {
  return window.__luLab?.journeyParticle;
}
