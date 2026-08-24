import { useEffect, useState } from 'react';
import Particles from './reactbits/Particles';

/**
 * A drift of particles behind the masthead — tuned far down from the React Bits
 * defaults so it reads as suspension rather than as a screensaver. On a lab that
 * formulates nanoparticles it is at least on-subject.
 *
 * Only mounted when the device is worth spending a WebGL context on: a wide
 * viewport, no reduced-motion preference, and a context that actually creates.
 * Everything below that gets the graded photograph on its own, which is the
 * point of the hero anyway.
 */
export default function ParticleField() {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(min-width: 768px)').matches) return;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') ?? c.getContext('webgl');
      if (!gl) return;
      // Release the probe context so it does not count against the browser's
      // limit on live contexts.
      (gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
      setOk(true);
    } catch {
      /* no WebGL — the hero stands on its own */
    }
  }, []);

  if (!ok) return null;

  return (
    <Particles
      particleCount={140}
      particleSpread={11}
      speed={0.055}
      particleColors={['#a6d2e6', '#7fb6d8', '#ffffff']}
      alphaParticles
      particleBaseSize={62}
      sizeRandomness={0.85}
      cameraDistance={19}
      moveParticlesOnHover
      particleHoverFactor={0.45}
      className="h-full w-full"
    />
  );
}
