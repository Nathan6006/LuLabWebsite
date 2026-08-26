import type { ImageMetadata } from 'astro';

/**
 * Portraits of lab members, and the group photograph.
 *
 * A person's markdown names the file in `photo:`; anyone without one falls
 * back to a placeholder block, which is the honest state — the site does not
 * substitute a stock face for a member whose photograph has not been supplied.
 */
const files = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/people/*.{png,jpg,jpeg,webp}',
  { eager: true },
);

export function portrait(file?: string): ImageMetadata | null {
  if (!file) return null;
  return files[`../assets/people/${file}`]?.default ?? null;
}
