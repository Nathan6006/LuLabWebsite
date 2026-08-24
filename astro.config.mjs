// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://lu-lab.pages.dev',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },

  // Fonts are downloaded at build time and served from this origin. Astro
  // generates metric-matched fallback @font-face rules (size-adjust,
  // ascent-override) so nothing reflows when the real face arrives.
  // The greek subset is required — β and α appear in research copy.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Source Serif 4',
      cssVariable: '--font-source-serif',
      weights: ['200 900'],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'greek'],
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Public Sans',
      cssVariable: '--font-public-sans',
      weights: ['100 900'],
      styles: ['normal'],
      subsets: ['latin', 'greek'],
      fallbacks: ['Helvetica Neue', 'Helvetica', 'sans-serif'],
    },
  ],

  vite: { plugins: [tailwindcss()] },
});
