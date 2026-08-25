# Center for Biomolecular Engineering — website

The website for Dr. Zheng-Rong Lu's group in the Department of Biomedical
Engineering at Case Western Reserve University.

**This guide is written for someone who is not a programmer.** Everything on the
site — every person, publication, news item, and research description — lives in
a plain text file. To change the site, you edit or add one of those files. You do
not need to understand the code.

---

## The one thing to know

All content lives in the folder `src/content/`, which has five subfolders:

| Folder | What's in it |
|---|---|
| `src/content/people/` | Current lab members — one file per person |
| `src/content/alumni/` | Past members and visiting scholars — one file per person |
| `src/content/publications/` | Papers — one file per paper |
| `src/content/news/` | Press coverage and lab announcements — one file per item |
| `src/content/research/` | Research areas — one file per area |

Every file follows the same shape. It starts and ends the top section with three
dashes (`---`). Between the dashes are labelled fields. Below the dashes is
free-form text, which is optional.

```
---
name: Jane Doe
role: PhD Student
---

Any paragraphs written down here show up as body text.
```

**To add something, copy an existing file in the right folder, rename it, and
change the values.** The file name becomes part of the web address, so use
lowercase letters with dashes instead of spaces — `jane-doe.md`, not
`Jane Doe.md`.

**To remove something, delete its file.** **To edit something, change its file.**

> ⚠️ If a value contains a colon (`:`), a `#`, or starts with a quotation mark,
> wrap the whole value in double quotes: `title: "Imaging: a review"`.

---

## Worked example 1 — adding a lab member

Say a new postdoc, **Maria Alvarez, PhD**, is joining.

**Step 1.** Go to `src/content/people/`. Open `ryan-hall.md` — he's already a
postdoc, so his file is the closest match. It looks like this:

```
---
name: Ryan Hall
credentials: PhD
email: rch87@case.edu
role: Postdoctoral Scholar
group: Postdoctoral Scholars
groupOrder: 3
order: 1
photoNote: Portrait of Ryan Hall — 4:5 portrait
---
```

**Step 2.** Create a new file in the same folder called `maria-alvarez.md` and
paste in a copy, with her details:

```
---
name: Maria Alvarez
credentials: PhD
email: mxa999@case.edu
role: Postdoctoral Scholar
group: Postdoctoral Scholars
groupOrder: 3
order: 3
photoNote: Portrait of Maria Alvarez — 4:5 portrait
---
```

**Step 3.** Save. She now appears on the People page under "Postdoctoral
Scholars".

### What each field does

| Field | Required? | What it does |
|---|---|---|
| `name` | yes | The person's name, as displayed |
| `role` | yes | Their job title, shown under the name |
| `group` | yes | The heading they appear under on the People page |
| `groupOrder` | yes | Which heading comes first. **Use the same number as everyone else in that group** (see table below) |
| `order` | yes | Position within their group. Lower numbers appear first |
| `credentials` | no | Letters after the name, e.g. `PhD`, `MD` |
| `email` | no | Shown as a clickable link. Leave it out if they'd rather not list it |
| `photoNote` | no | The caption on the grey placeholder box where their photo will go |
| `featured` | no | Only Dr. Lu uses this. Don't set it on anyone else |

The groups currently in use, and their `groupOrder` numbers:

| `group` | `groupOrder` |
|---|---|
| Director | 1 |
| Senior Research Associates | 2 |
| Postdoctoral Scholars | 3 |
| PhD Students | 4 |
| Research Assistance | 5 |
| High School Students | 6 |

To create a brand-new group, invent a new name and give it a `groupOrder` number
that puts it where you want — e.g. `Master's Students` with `groupOrder: 5` would
slot in before Research Assistance. Use that same pair on everyone in that group.

### When someone leaves

Move their file from `src/content/people/` to `src/content/alumni/`, then replace
its fields with the alumni ones:

```
---
name: Maria Alvarez
category: postdoc
degree: "Ph.D."
order: 28
---
```

`category` must be exactly one of `graduate`, `postdoc`, or `undergraduate`.
Graduate entries also take `institution`, `field`, `degree`, and `year`, which
fill in the columns of the table on the Alumni page.

---

## Worked example 2 — adding a publication

Say the lab publishes a new paper in 2026.

**Step 1.** Go to `src/content/publications/`. Every file is named
`YEAR-some-words-from-the-title.md`.

**Step 2.** Create `2026-targeted-nanoparticles-for-pancreatic-cancer.md`:

```
---
title: "Targeted Nanoparticles for Pancreatic Cancer Therapy"
authors: "Maria Alvarez, Da Sun, Zheng-Rong Lu"
journal: "Journal of Controlled Release"
year: 2026
citation: "2026, 380:112-125"
url: "https://pubmed.ncbi.nlm.nih.gov/12345678/"
order: 1
---
```

**Step 3.** Save. It appears on the Publications page at the top, under a new
**2026** heading. The year heading is created automatically — you don't have to
add it anywhere.

### What each field does

| Field | Required? | What it does |
|---|---|---|
| `title` | yes | The paper title. It becomes the clickable link |
| `year` | yes | Groups the paper under a year heading. Newest year first |
| `order` | yes | Position within that year. `1` puts it at the top |
| `authors` | no | The author list. Dr. Lu's name is **bolded automatically** wherever it appears — type it normally |
| `journal` | no | Shown in italics |
| `citation` | no | Volume, issue, and pages — whatever you'd normally write after the journal name |
| `url` | no | Link to the paper. Without it, the title is plain text instead of a link |

> **A note on the older entries.** Fifteen publications carried over from the old
> site list their authors and journal together in the `citation` field, because
> the old site never separated them. They display correctly. If you ever want to
> tidy one up, split it into `authors`, `journal`, and `citation` as above.

---

## Worked example 3 — adding a news item

There are two kinds of news, and they appear in two different sections of the
News page.

### A press article about the lab (`kind: press`)

Say *The Daily* writes about the lab on 3 March 2026.

Create `src/content/news/press-2026-the-daily-new-imaging-grant.md`:

```
---
title: "Lu lab receives NIH grant for pancreatic cancer imaging"
kind: press
outlet: "The Daily"
date: 2026-03-03
year: 2026
url: "https://thedaily.case.edu/example-article/"
featured: true
order: 1
---
```

### An internal lab announcement (`kind: announcement`)

Create `src/content/news/note-2026-1-welcome-new-student.md`:

```
---
title: "A warm welcome to our new graduate student, Sam Rivera."
kind: announcement
year: 2026
order: 1
---
```

For announcements the `title` **is** the whole message — write it as a full
sentence, the way the old announcements page did.

### What each field does

| Field | Required? | What it does |
|---|---|---|
| `title` | yes | The headline, or the full announcement sentence |
| `kind` | yes | Either `press` or `announcement`. Nothing else |
| `year` | yes | Groups the item under a year heading |
| `order` | yes | Position within the year. `1` is at the top |
| `date` | no | Exact date, written `YYYY-MM-DD`. **Only add this if you know the real date** — otherwise leave it out and just the year shows |
| `outlet` | no | Publication name, for press items |
| `url` | no | Link to the article |
| `featured` | no | Set `featured: true` to make an item eligible for the three slots on the home page |

> The home page shows the three most recent items marked `featured: true`. If you
> want a new item on the home page, add `featured: true` to it — and consider
> removing it from an older one so the list stays at three.

---

## Editing the research pages

`src/content/research/` works slightly differently: the paragraphs go **below**
the dashes, not in the fields.

```
---
title: Molecular Imaging
summary: One or two sentences, used on the home page card.
order: 1
figureNote: Diagram — what the picture should show (16:9)
figureRatio: "16 / 9"
---

Everything down here is the body text. Leave a blank line between paragraphs
and they become separate paragraphs on the page.
```

A file with a `parent:` field becomes a numbered sub-project nested under that
research area. The value is the parent's file name without `.md` — for example
`parent: 01-nucleic-acid-therapies`.

## Editing contact details, the menu, and the instruments list

These are not in `src/content/`:

- **Contact details, phone, email, addresses** — `src/lib/site.ts`
- **The navigation menu** — also `src/lib/site.ts`, in the `NAV` list
- **The instruments list** — `src/pages/instruments.astro`, near the top
- **The open position advert** — `src/pages/join.astro`

They are still plain text between quotation marks. Change what's inside the
quotes and leave the punctuation around it alone.

---

## Photographs

There are two kinds of imagery on this site, and they work differently.

### Placeholders — waiting for the lab's own photos

Every box with a dashed border and corner marks is a placeholder. Each is
already the correct shape and captioned with what belongs there: the 11 member
portraits, the group photo, the four instruments, and the campus map. **None of
these can be filled with stock photography** — they stand for specific real
people and specific equipment in Wickenden. See `TODO.md`.

To add a real photo later, drop the file in `src/assets/` and swap the
`<Placeholder ... />` tag for an `<Image ... />` in the relevant page.

### Atmospheric banners — stock imagery from Unsplash

The treated images beside the page headers on the home, research, instruments,
news and join pages are stock photographs. They are texture, not documentation,
and the `/credits` page says so plainly.

To re-fetch or change them you need a free Unsplash API key:

1. Register an application at <https://unsplash.com/developers>.
2. Copy `.env.example` to `.env` and paste your Access Key into it.
3. Run:

```bash
UNSPLASH_ACCESS_KEY=your_key node scripts/fetch-unsplash.mjs
```

The images land in `src/assets/unsplash/` and the photographer credits in
`src/data/unsplash.json`, which feeds the `/credits` page automatically. Pass
`--force` to replace images that are already downloaded. To change *what* is
searched for, edit the `SLOTS` list at the top of the script.

**Never commit the key.** `.env` is gitignored.

---

## Running and publishing the site

You need [Node.js](https://nodejs.org) installed. Open a terminal in this folder.

```bash
npm install     # once, the first time
npm run dev     # preview at http://localhost:4321 — updates as you type
npm run build   # produce the final site in dist/
```

While `npm run dev` is running, save any content file and the browser updates
immediately. Press `Ctrl+C` to stop it.

To publish changes:

```bash
npm run build
npx wrangler pages deploy dist --project-name lu-lab
```

### If something breaks

The most common mistake is a punctuation error in the fields at the top of a
file. `npm run dev` will print the name of the file it couldn't read. Check that:

- the file starts with `---` on its very first line, and has a second `---` below the fields
- every field is `name: value` — a colon **and a space**
- any value containing `:` or `#` is wrapped in double quotes
- indentation uses spaces, never tabs

Undo your last change and the error will go away.

---

## For developers

Astro 7, TypeScript (strict), Tailwind CSS v4, static output, no client-side
JavaScript. Content is managed through Astro content collections; the schemas in
`src/content.config.ts` are the source of truth for every field above and will
fail the build if a required field is missing or misspelt.

Fonts are downloaded at build time by Astro's font pipeline and self-hosted,
with metric-matched fallbacks so no text reflows on load: **Literata** for
headings (chosen over Newsreader and Crimson because it covers Greek — β3 and
HIF-1α appear in titles), **IBM Plex Sans** for body, **IBM Plex Mono** for the
tracked metadata labels that run through the whole design. Colours are defined
once as design tokens in `src/styles/global.css` and taken from the current CWRU
brand palette.

Motion is GSAP, and it all lives in one file: `src/components/Motion.astro`.
Every page gets scroll reveals, image wipes and the progress bar from it with no
React at all. The home page additionally gets, from the same file, the masthead
that assembles and hands the site name to the header, the pinned platform
section, the word-by-word reading highlight, and the hero slideshow's
tilt-away.
GSAP's ScrollTrigger and SplitText are loaded only on the home page, so no other
route pays for them.

The home page has two WebGL islands, both of which check for a working WebGL
context first and render nothing at all if there isn't one:

- **`src/components/ParticleField.tsx`** — the drift behind the hero, using the
  React Bits `Particles` component vendored into `src/components/reactbits/`.
- **`src/components/AuroraField.tsx`** — the field behind the mission
  statement. One fragment shader, one covering triangle, no geometry and no
  per-object work, so it is by far the cheapest animation on the site. It caps
  itself at device pixel ratio 1.25, stops when it is off screen or the tab is
  hidden, and draws a single frame and stops under reduced motion. The CSS
  gradient behind it in `index.astro` is not a placeholder — it is what ships
  without WebGL.
- **`src/components/MoleculeCanvas.tsx`** — the point cloud in the pinned
  platform section, which morphs through three schematic structures as you
  scroll. It publishes `window.__molecule`; `Motion.astro` drives it from the
  section's scroll progress. **The structures it draws are schematic, not real
  structure data** — see TODO.md §4.0 before treating them as depictions of a
  specific compound.

Below 1024px, and for anyone whose system asks for reduced motion, neither
pinned section exists: both ship a plain stacked fallback that is also what a
reader with no JavaScript gets.

Icons are `lucide-react`, rendered inside `.astro` files so they compile to
static SVG and ship no JavaScript.

```
src/
├── content/          content collections (see above)
├── content.config.ts collection schemas
├── components/       Header, Footer, PageHeader, PersonCard, PublicationItem,
│                     NewsItem, Placeholder
├── layouts/Base.astro shared page shell
├── lib/site.ts       site constants, contact details, navigation
├── lib/images.ts     resolves Unsplash slots, falls back to placeholders
├── data/unsplash.json photographer credits (generated by the fetch script)
├── assets/unsplash/  downloaded stock imagery (generated)
├── pages/            one file per route
└── styles/global.css design tokens and prose styles

scripts/
└── fetch-unsplash.mjs  downloads banner imagery + records attribution
```
