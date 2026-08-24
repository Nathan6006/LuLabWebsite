import type { ImageMetadata } from 'astro';
import manifest from '../data/unsplash.json';

export interface PhotoCredit {
  file: string;
  /** 'atmosphere' = texture only; 'illustrative' = shows the kind of thing, not ours. */
  role: 'atmosphere' | 'illustrative';
  note: string;
  alt: string;
  color?: string;
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
  unsplashUrl: string;
}

const credits = manifest as Record<string, PhotoCredit>;

// Eagerly resolved so Astro can optimise each file at build time.
const files = import.meta.glob<{ default: ImageMetadata }>('../assets/unsplash/*.{jpg,jpeg,png,webp}', {
  eager: true,
});

export interface ResolvedPhoto {
  src: ImageMetadata;
  credit: PhotoCredit;
}

/**
 * Look up a slot from the Unsplash manifest. Returns null when the image has
 * not been fetched yet, so every caller can fall back to its placeholder and
 * the site builds fine with no images at all.
 */
export function photo(id: string): ResolvedPhoto | null {
  const credit = credits[id];
  if (!credit) return null;
  const mod = files[`../assets/unsplash/${credit.file}`];
  if (!mod) return null;
  return { src: mod.default, credit };
}

/** Every credit currently in use, for the site-wide attribution list. */
export function allCredits(): PhotoCredit[] {
  return Object.values(credits).filter((c) => files[`../assets/unsplash/${c.file}`]);
}
