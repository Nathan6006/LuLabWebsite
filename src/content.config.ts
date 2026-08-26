import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * Every collection below is a folder of markdown files under src/content/.
 * To add a record, copy an existing file in that folder and edit it.
 * See README.md for worked examples.
 */

const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/people' }),
  schema: z.object({
    name: z.string(),
    credentials: z.string().optional(),
    role: z.string(),
    // Position in the grid on /people. Lower numbers come first; the role
    // itself is printed under the name rather than used to group anybody.
    order: z.number().default(100),
    featured: z.boolean().default(false),
    email: z.string().optional(),
    phone: z.string().optional(),
    fax: z.string().optional(),
    office: z.string().optional(),
    titles: z.array(z.string()).default([]),
    education: z.array(z.string()).default([]),
    interests: z.array(z.string()).default([]),
    links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
    photo: z.string().optional(),
    photoNote: z.string().optional(),
  }),
});

const alumni = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/alumni' }),
  schema: z.object({
    name: z.string(),
    category: z.enum(['graduate', 'postdoc', 'undergraduate']),
    institution: z.string().optional(),
    field: z.string().optional(),
    degree: z.string().optional(),
    year: z.number().optional(),
    note: z.string().optional(),
    order: z.number().default(100),
  }),
});

const publications = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/publications' }),
  schema: z.object({
    title: z.string(),
    // Optional: a few source citations did not mark the journal separately, so
    // their authors and journal are preserved together in `citation`.
    authors: z.string().optional(),
    journal: z.string().optional(),
    year: z.number(),
    citation: z.string().optional(),
    url: z.string().optional(),
    note: z.string().optional(),
    order: z.number().default(100),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    // 'press' shows on /news under coverage; 'announcement' under lab news.
    kind: z.enum(['press', 'announcement']),
    outlet: z.string().optional(),
    // Real, verified date. Leave out when the source page gave no date.
    date: z.coerce.date().optional(),
    // Used to group and sort items that have no exact date.
    year: z.number(),
    url: z.string().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(100),
  }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/research' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    order: z.number(),
    // Optional parent thrust slug — makes this a sub-project of that thrust.
    parent: z.string().optional(),
    figureNote: z.string().optional(),
    figureRatio: z.string().default('16 / 9'),
  }),
});

export const collections = { people, alumni, publications, news, research };
