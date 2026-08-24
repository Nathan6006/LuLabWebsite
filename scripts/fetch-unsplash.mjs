#!/usr/bin/env node
/**
 * Fetch the site's atmospheric and instrument imagery from Unsplash.
 *
 *   UNSPLASH_ACCESS_KEY=xxx node scripts/fetch-unsplash.mjs
 *
 * Downloads each photo into src/assets/unsplash/ and writes the attribution
 * manifest to src/data/unsplash.json. Re-running is safe: photos already on
 * disk are skipped unless --force is passed.
 *
 * Unsplash's API terms require two things and this script does both:
 *   1. Credit the photographer and Unsplash, with links carrying our UTM tags.
 *   2. Call the photo's `links.download_location` endpoint when we take a copy.
 *      That is what registers the download against the photographer; hotlinking
 *      the image without it is a licence violation.
 */

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

const KEY = process.env.UNSPLASH_ACCESS_KEY;
const FORCE = process.argv.includes('--force');
const APP = 'lu_lab_cbe';
const OUT_DIR = 'src/assets/unsplash';
const MANIFEST = 'src/data/unsplash.json';

if (!KEY) {
  console.error(
    'Missing UNSPLASH_ACCESS_KEY.\n' +
      'Register an application at https://unsplash.com/developers, then:\n' +
      '  UNSPLASH_ACCESS_KEY=your_access_key node scripts/fetch-unsplash.mjs',
  );
  process.exit(1);
}

/**
 * Each slot names where the picture goes and what it has to look like.
 * `query` drives the search; `orientation` and `filter` narrow it.
 * Nothing here claims to depict this laboratory — see the `role` field.
 */
const SLOTS = [
  {
    id: 'hero-texture',
    role: 'atmosphere',
    query: 'abstract microscopy blue tissue texture',
    orientation: 'landscape',
    note: 'Home page masthead ground',
  },
  {
    id: 'research-banner',
    role: 'atmosphere',
    query: 'fluorescence microscope optics lens',
    orientation: 'landscape',
    note: 'Research page banner',
  },
  {
    id: 'instruments-banner',
    role: 'atmosphere',
    query: 'mass spectrometry analytical chemistry machine',
    orientation: 'landscape',
    note: 'Instruments page banner',
  },
  {
    id: 'news-banner',
    role: 'atmosphere',
    query: 'library archive shelves books research',
    orientation: 'landscape',
    note: 'News page banner',
  },
  {
    id: 'join-lab',
    role: 'atmosphere',
    query: 'research laboratory bench glassware quiet',
    orientation: 'landscape',
    note: 'Open positions page banner',
  },
  {
    id: 'card-imaging',
    role: 'atmosphere',
    // Chosen by eye from a survey: an abstract blue ink cloud. Deliberately not
    // anything that could be mistaken for a micrograph or a scan of theirs.
    // An actual grid of MRI slices, from the National Cancer Institute. The
    // lab's imaging work is MRI contrast agents, so this is on-subject rather
    // than decorative — and it is credited, because it is not their scan.
    exact: 'BDKid0yJcAk',
    query: 'mri scan brain medical imaging',
    orientation: 'landscape',
    note: 'Molecular Imaging card',
  },
  {
    id: 'card-gene',
    role: 'atmosphere',
    // A dark sphere in a wire lattice — reads as a nanoparticle without
    // pretending to be a micrograph of one of theirs.
    exact: 'MrWOCGKFVDg',
    query: 'nanoparticle sphere abstract render',
    orientation: 'landscape',
    note: 'Gene Therapy card',
  },
  {
    id: 'band-research',
    role: 'atmosphere',
    // Chosen by eye: a clean contemporary lab interior. The search kept
    // returning industrial and nuclear plant, which is the wrong register.
    exact: 'oCLuFi9GYNA',
    query: 'science laboratory research facility',
    orientation: 'landscape',
    note: 'Research page full-bleed band',
  },
];

// Note on the instrument photographs: an earlier pass tried to fill the four
// instrument slots from Unsplash. It cannot be done honestly. The library has
// no Olympus FV1000, Agilent 5800, ChemiDoc XRS+ or Litesizer 500, and what the
// searches return instead — a laser engraver, a rack of blood tubes, an
// abstract wall — says nothing true under a heading naming a specific
// instrument. Those four stay as placeholders until the lab photographs its own.


const api = async (url) => {
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${KEY}`, 'Accept-Version': 'v1' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
};

const exists = async (p) => access(p).then(() => true).catch(() => false);

await mkdir(OUT_DIR, { recursive: true });
await mkdir(path.dirname(MANIFEST), { recursive: true });

let manifest = {};
if (await exists(MANIFEST)) manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

for (const slot of SLOTS) {
  const file = path.join(OUT_DIR, `${slot.id}.jpg`);

  if (!FORCE && (await exists(file)) && manifest[slot.id]) {
    console.log(`· ${slot.id} — already present, skipping`);
    continue;
  }

  let photo;
  if (slot.exact) {
    photo = await api(`https://api.unsplash.com/photos/${slot.exact}`);
  } else {
  const search = new URL('https://api.unsplash.com/search/photos');
  search.searchParams.set('query', slot.query);
  search.searchParams.set('orientation', slot.orientation);
  search.searchParams.set('content_filter', 'high');
  search.searchParams.set('per_page', '10');

  const { results } = await api(search);
  // Skip anything already claimed by another slot — two instruments sharing one
  // photograph is worse than no photograph.
  const taken = new Set(Object.values(manifest).map((m) => m.photoId).filter(Boolean));
  photo = (results ?? []).filter((r) => !taken.has(r.id))[slot.pick ?? 0];
  }
  if (!photo) {
    console.warn(`! ${slot.id} — no result for "${slot.query}"`);
    continue;
  }

  // Required by the API terms: register the download before using the file.
  await api(photo.links.download_location);

  const raw = new URL(photo.urls.raw);
  raw.searchParams.set('w', '2000');
  raw.searchParams.set('q', '82');
  raw.searchParams.set('fm', 'jpg');
  raw.searchParams.set('fit', 'max');

  const img = await fetch(raw);
  if (!img.ok) throw new Error(`download failed for ${slot.id}: ${img.status}`);
  await pipeline(Readable.fromWeb(img.body), createWriteStream(file));

  manifest[slot.id] = {
    file: `${slot.id}.jpg`,
    photoId: photo.id,
    role: slot.role,
    note: slot.note,
    alt: photo.alt_description ?? slot.note,
    width: photo.width,
    height: photo.height,
    color: photo.color,
    photographer: photo.user.name,
    photographerUrl: `${photo.user.links.html}?utm_source=${APP}&utm_medium=referral`,
    photoUrl: `${photo.links.html}?utm_source=${APP}&utm_medium=referral`,
    unsplashUrl: `https://unsplash.com/?utm_source=${APP}&utm_medium=referral`,
  };

  console.log(`✓ ${slot.id} — ${photo.user.name}`);
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nWrote ${MANIFEST} (${Object.keys(manifest).length} photos)`);
