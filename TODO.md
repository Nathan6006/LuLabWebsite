# TODO — content to confirm, correct, and supply

This first pass carried over the content of the old Drupal site as-is and built
the structure and visual design around it. **Nothing factual was invented.**
Where the old site had no content, the page exists but says `TODO: content
pending` rather than guessing.

Everything below needs a decision from Dr. Lu or someone in the lab.

---

## 1. Blocking — conflicting facts in the sources

These four items had **different values on different official CWRU pages**. A
choice was made so the site could be built; each needs confirming.

### 1.1 Dr. Lu's professorship title — two different wordings

| Source | Wording |
|---|---|
| CCIR faculty page (used on this site) | M. Frank **and** Margaret Domiter Rudy Professor of Biomedical Engineering |
| Old lab site, members & positions pages | M. Frank **Rudy** and Margaret Domiter Rudy Professor of Biomedical Engineering |

The site currently uses the **CCIR faculty page** wording on `/people`, and the
**old lab site** wording on `/join` (where it appears inside a verbatim quote of
the job advert). These should be made consistent once the correct form is known.

- `src/content/people/zheng-rong-lu.md` → `titles:`
- `src/pages/join.astro` → the address block

### 1.2 Three different addresses for the same lab

| Source | Address |
|---|---|
| Old contact page (**used on this site**) | Wickenden 427, Mail Stop 7207, 10900 Euclid Avenue, Cleveland, OH 44106 |
| Old members page | 2071 Martin Luther King Jr. Drive, Room 340 Wickenden Building, Cleveland, OH 44106-7207 |
| Old site footer | Nord Hall, Room 500, 2095 Martin Luther King Jr Dr, Cleveland, OH 44106 |
| CCIR faculty page | 10900 Euclid Avenue, Cleveland, OH 44106-**7207** |

Note the members page gives **Room 340**, everything else gives **Room 427**. The
Nord Hall address appears to be the Engineering school's, not the lab's. Confirm
which is correct, including the ZIP suffix (`44106` vs `44106-7207`).

- `src/lib/site.ts` → `CONTACT.mailing`

### 1.3 Two email addresses for Dr. Lu

`zxl125@case.edu` (old lab site) and `zheng-rong.lu@case.edu` (CCIR page). The
site uses **`zxl125@case.edu`** everywhere. Confirm which is preferred.

- `src/lib/site.ts` → `CONTACT.email`

### 1.4 Phone number formatting

`216-368-0187` appears throughout; the old site's footer also listed
`216.368.4436`, which appears to be a different (school-level) number. Only
`216-368-0187` is used on this site. Confirm the fax number `216-368-4969`
(from the old members page) is still current.

---

## 2. The content is stale — everything stops in 2023

The old site had not been updated in roughly three years. Every one of these is
carried over exactly as found and is very likely out of date:

- **Publications end at 2023.** 65 papers, none newer. Anything from 2024, 2025,
  or 2026 is missing entirely.
- **Announcements end at 2023.** The most recent is Ryan Hall's thesis defence.
- **The member roster is from ~2023.** People listed may have left; people who
  have since joined are absent. Specifically worth checking: Da Sun, Ryan Hall,
  Yanqing Wang, Hong Wang, Yue Jiang, Evan Dubrunfaut, Mark Choi, Rachel Boyette,
  Nikila Swaminathan, Jamal Kelani.
- **The group photo was taken 09/22/23.**
- **MT218 clinical trial status.** The old site says phase I for prostate cancer
  detection "now". That was written in 2021 — the trial has likely progressed.
- **Two high school students are listed by name.** Confirm they are still with
  the lab and consent to being named publicly.

---

## 3. Photographs — the lab's own images are still needed

Every photograph *of this laboratory* is still a correctly-proportioned
placeholder with a caption naming what belongs there. Nothing was scraped from
the old site.

Stock imagery from Unsplash **is** now used — treated atmospheric panels beside
five page headers, two abstract images on the home page research cards, and one
full-bleed band on the research page. The `/credits` page states outright that
none of it shows this laboratory.

The two research-card images were picked to be unmistakably abstract (an ink
cloud, a water ripple) rather than anything that could be read as one of the
lab's own micrographs, scans, or figures. It was deliberately kept out of every slot
that stands for something specific.

Unsplash was also tried for the four instrument photographs and abandoned: the
library has no Olympus FV1000, Agilent 5800, ChemiDoc XRS+ or Litesizer 500, and
the closest matches it returned — an industrial laser engraver, a rack of blood
collection tubes, an abstract white wall — would have been actively misleading
under a heading naming a specific instrument. Those four remain placeholders.

| Where | Aspect ratio | What's needed |
|---|---|---|
| `/people` — Dr. Lu | 4:5 portrait | Portrait of Dr. Lu |
| `/people` — 10 members | 4:5 portrait | One portrait per member |
| `/people` — group photo | 3:1 panorama | Current group photo |
| `/research` — Molecular Imaging | 16:9 | Diagram: fibronectin-targeted probe in the tumour microenvironment |
| `/research` — Gene Therapy | 16:9 | Diagram: ECO lipid structure and the PERC delivery mechanism |
| `/instruments` — 4 instruments | 3:2 | One photo per instrument |
| `/contact` | 4:3 | Static campus map showing the Wickenden Building |

Placeholder captions are set per person in `photoNote:` and per research area in
`figureNote:`.

**Also needed:** if the lab supplies its own instrument and laboratory
photographs, the Unsplash banners should be replaced with them and the
`/credits` page trimmed accordingly.

---

## 4. Pages with missing or incomplete content

### 4.1 `/join` — nothing for prospective students
The old site's positions page advertised **only** a postdoctoral position. There
was no guidance for prospective PhD applicants or undergraduate researchers. That
section of `/join` is marked **`TODO: content pending`** and needs text written.

### 4.2 `/news` — the old "In the News" page returned 404
`https://engineering.case.edu/.../in-the-news` was linked from the old homepage
but **does not exist** (HTTP 404). Its content, if any, is lost. The `/news` page
is instead built from the old `/media` page (13 press items) and the old
`/updates` page (21 announcements).

### 4.3 Press items mostly have no dates
Only **three** press items had a real date, taken from the dated "In the News"
block on the old homepage:

- Dr. Lu elected fellow of the National Academy of Inventors — 22 Dec 2021
- First clinical trials set for MRI cancer detection — 5 May 2021
- Novel Molecular MRI Imaging Technique... (Targeted Oncology) — 18 Aug 2019

The other ten show **only a year**, inferred from the article URL or the paper it
covers. No date was invented. Add real dates to the `date:` field where known.

### 4.4 Some press links are old `http://` URLs that may be dead
Carried over verbatim from the old site. Several point to sites that have since
been restructured (`genengnews.com`, `indiamedicaltimes.com`,
`medicaldevice-network.com`, `thehill.com`, `blog.case.edu`). **These should be
checked and either updated or removed.**

### 4.5 Two press items have the same headline
"siRNA-toting nanoparticles inhibit breast cancer metastasis" appears twice on
the old media page, once linking to Think Magazine and once to The Daily. Both
were kept, distinguished by outlet. Confirm whether both should stay.

---

## 5. Publication data quality

- **15 of 65 citations are not split into fields.** The old site marked the
  journal in italics for 48 papers and one other, but for these 15 it did not.
  Rather than guess where the author list ended, the whole citation is stored
  verbatim in one field and displayed as one line. It reads correctly. See the
  note in `README.md` if you want to split them.
- **One paper is filed under the wrong year.** "A neutral polydisulfide
  containing Gd(III) DOTA monoamide..." is listed under the **2015** heading on
  the old site but its own citation says **2016** (*Contrast Media and Molecular
  Imaging*, 11(1):32-40). The old site's grouping was preserved rather than
  silently corrected.
- **Typos carried over verbatim** (deliberately — correct these at the source):
  - "microenviornment" → microenvironment (appears in 3 publication titles)
  - "trail" → trial (2021 announcement about MT218)
  - "GABA moculators" → modulators (2018 paper title)
  - "Scheimann" → Schiemann (2019 paper author list)
  - "Opththal" → Ophthalmol (2015 paper)
  - "aide" → aid (research page, eIF4E section)
- **No DOIs are recorded.** The old site linked to abstracts (mostly PubMed) but
  never listed DOIs. Consider adding them. All 65 papers do have an abstract
  link, but 15 use plain `http://` rather than `https://` — worth
  refreshing to `https://` PubMed or DOI links.

---

## 6. Branding and legal

- **No CWRU logo, wordmark, or sunburst is used anywhere**, per instruction —
  university brand rules restrict them and this site is not on a `case.edu`
  domain. The footer uses plain text attribution only. **If this site moves to a
  case.edu domain, contact University Marketing and Communications about proper
  logo use.**
- **The favicon is a generic placeholder** (a blue tile with an abstract mark). It
  is not a CWRU asset. Replace or remove it.
- **Stock imagery is credited as Unsplash requires**, on `/credits` and linked
  from the footer. The fetch script also calls each photo's download endpoint,
  which the Unsplash API terms require. If banners are swapped out by hand,
  keep `src/data/unsplash.json` in step or the credits will be wrong.
- **Typefaces are Literata and IBM Plex Sans/Mono**, all open licence
  (SIL OFL), self-hosted. No licensing action needed.
- **Colours are the current CWRU brand palette** fetched from
  `case.edu/brand/visual-identity/color` on 24 Aug 2026: CWRU Blue `#003071`,
  CWRU Dark Blue `#09143A`, CWRU Light Blue `#A6D2E6`.
  - **One deliberate deviation:** CWRU Copper Red `#D63D1F` measures 4.32:1
    against the warm off-white background, just below the WCAG AA minimum of
    4.5:1 for small text. The accent used for the small uppercase labels is
    `#C4381C` — the same hue and saturation, darkened to 5.00:1. The unmodified
    brand value is kept in the stylesheet as `--color-copper-brand`.
- **The site is not on a case.edu domain.** Confirm whether it should be, and
  whether the department requires the standard CWRU header/footer.
- **No privacy policy, accessibility statement, or Title IX notice.** The old
  Drupal site inherited these from the university template. Confirm whether this
  site needs them.

---

## 7. Things deliberately not carried over

- **The old site's left-hand "Menu" navigation block** was replaced by a proper
  top navigation.
- **"Stay Up-Dated! Click here for..." banner**, repeated on every old page,
  was dropped — `/news` is in the main navigation instead.
- **Social media links and the CWRU Engineering mega-menu** in the old footer
  were dropped; they belonged to the school, not the lab.
- **The old homepage's Nord Hall address** was dropped in favour of the lab's own
  Wickenden address. See §1.2.

---

## 8. Suggested content that does not exist yet

Not built, because there was nothing to build from. Flagging as opportunities:

- **Funding and acknowledgements** — no grant or sponsor information anywhere on
  the old site.
- **Patents** — Dr. Lu is a National Academy of Inventors fellow, which implies a
  substantial patent portfolio that is not listed.
- **Individual member bios and research interests** — the old site gave only a
  name and title for everyone except Dr. Lu.
- **Alumni current positions** — the alumni list gives degree and year, but not
  where people went afterwards, which is the single most persuasive thing a
  prospective PhD student looks for.
- **Teaching** — Dr. Lu's CCIR page lists teaching interests (drug delivery,
  molecular imaging, nanomedicine, biomolecular engineering) but no courses.
