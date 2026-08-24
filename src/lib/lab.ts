import type { ImageMetadata } from 'astro';
import manifest from '../data/lab-photos.json';

export interface LabPhoto {
  file: string;
  alt: string;
  caption: string;
}

const entries = manifest as Record<string, LabPhoto>;

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/lab/*.{png,jpg,jpeg,webp}', {
  eager: true,
});

export interface ResolvedLabPhoto {
  src: ImageMetadata;
  meta: LabPhoto;
  id: string;
}

/**
 * The lab's own photographs. Unlike the Unsplash slots these show this
 * laboratory, so they carry real alt text and real captions.
 */
export function labPhoto(id: string): ResolvedLabPhoto | null {
  const meta = entries[id];
  if (!meta) return null;
  const mod = files[`../assets/lab/${meta.file}`];
  if (!mod) return null;
  return { src: mod.default, meta, id };
}

export function allLabPhotos(): ResolvedLabPhoto[] {
  return Object.keys(entries)
    .map((id) => labPhoto(id))
    .filter((p): p is ResolvedLabPhoto => p !== null);
}
