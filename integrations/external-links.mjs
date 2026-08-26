import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Open off-site links in a new tab, everywhere, in one place.
 *
 * This runs over the built HTML rather than in the components because links
 * come from too many directions to catch by hand: the footer list, a person's
 * `links:`, a publication's `url:`, the photo credits, and prose inside
 * markdown bodies, which no component touches at all. Anything that ships an
 * `<a>` pointing at another host is covered, including files added later.
 *
 * Same-host absolute links, relative links, anchors, `mailto:` and `tel:` are
 * left exactly as they are — a new tab is for leaving the site, not for
 * jumping around inside it.
 */
const ANCHOR = /<a\s([^>]*?)>/gi;
const HREF = /\bhref\s*=\s*"([^"]*)"/i;
const REL = /\brel\s*=\s*"([^"]*)"/i;

function isExternal(href, host) {
  const v = href.trim();
  if (!/^(https?:)?\/\//i.test(v)) return false;
  try {
    return new URL(v, `https://${host}`).host !== host;
  } catch {
    return false;
  }
}

/** Adds `target` and the rel tokens a new tab needs, keeping any already set. */
function rewrite(attrs) {
  if (/\btarget\s*=/i.test(attrs)) return attrs;
  const rel = REL.exec(attrs);
  const tokens = new Set((rel?.[1] ?? '').split(/\s+/).filter(Boolean));
  tokens.add('noopener');
  tokens.add('noreferrer');
  const relAttr = `rel="${[...tokens].join(' ')}"`;
  const withRel = rel ? attrs.replace(REL, relAttr) : `${attrs} ${relAttr}`;
  return `${withRel} target="_blank"`;
}

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

export default function externalLinks() {
  return {
    name: 'external-links',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const host = new URL(import.meta.env?.SITE ?? 'https://lu-lab.pages.dev').host;
        const root = fileURLToPath(dir);
        let changed = 0;
        for await (const file of htmlFiles(root)) {
          const html = await readFile(file, 'utf8');
          let hits = 0;
          const out = html.replace(ANCHOR, (whole, attrs) => {
            const href = HREF.exec(attrs);
            if (!href || !isExternal(href[1], host)) return whole;
            hits++;
            return `<a ${rewrite(attrs)}>`;
          });
          if (hits) {
            await writeFile(file, out);
            changed += hits;
          }
        }
        logger.info(`opened ${changed} off-site links in a new tab`);
      },
    },
  };
}
