// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://lu-lab.pages.dev',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    // The stylesheet is ~9KB, over Astro's auto-inline threshold, so it shipped
    // as a separate render-blocking request costing ~300ms of First Contentful
    // Paint on every route. Inlined it gzips to a couple of KB inside the HTML
    // and blocks nothing.
    inlineStylesheets: 'always',
  },

  integrations: [react()],

  // Fonts are downloaded at build time and self-hosted. Astro generates
  // metric-matched fallback @font-face rules (size-adjust, ascent-override) so
  // nothing reflows when the real face arrives.
  //
  // The greek subset is required on the serif and the sans — β3 integrin and
  // HIF-1α appear in research and publication titles. Literata was chosen over
  // Newsreader/Crimson/Fraunces specifically because it covers Greek; the others
  // would drop a mismatched fallback glyph into the middle of a heading.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Literata',
      cssVariable: '--font-literata',
      weights: ['200 900'],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'greek'],
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Sans',
      cssVariable: '--font-plex-sans',
      // Variable: one file per subset covers every weight the site uses.
      // Listing static weights instead produced four files per subset.
      weights: ['100 700'],
      styles: ['normal'],
      subsets: ['latin', 'greek'],
      fallbacks: ['Helvetica Neue', 'Helvetica', 'sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      // Not a variable family, so every weight is another file. The label
      // utility is the only thing that uses mono, and it only ever asks for
      // 500 — one weight, one subset, one file.
      weights: [500],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
  ],

  vite: { plugins: [tailwindcss()] },
});
