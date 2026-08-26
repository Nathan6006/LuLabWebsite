# TODO — content to confirm, correct, and supply

This first pass carried over the content of the old Drupal site as-is and built
the structure and visual design around it. **Nothing factual was invented.**
Where the old site had no content, the page exists but says `TODO: content
pending` rather than guessing.

Everything below needs a decision from Dr. Lu or someone in the lab.

---

## 0. Newest — the roster and the lab photographs

### 0.1 Seven former members were removed from /people

The lab supplied a current roster of seven, and `/people` now lists exactly
that, in the order given:

| # | Name | Title as given |
|---|---|---|
| 1 | Ryan Hall | postdoc |
| 2 | Songqi Gao | research assistant |
| 3 | Yue Jiang | PhD |
| 4 | Evan Dubrunfaut | PhD |
| 5 | Victory Stewart | masters |
| 6 | Abdullah Khan | research assistant |
| 7 | Nathan Liu | high school |

Removed from the site: **Da Sun, Hong Wang, Jamal Kelani, Mark Choi, Nikila
Swaminathan, Rachel Boyette, Yanqing Wang**. They were deleted, not moved —
whether any of them belong on `/people/alumni` is not something the roster
said, and adding them there would be inventing a fact. Da Sun already has an
alumni entry (`grad-da-sun.md`) from the old site; the other six do not.

**Needed:** confirm which of the six should appear as alumni, with degree and
year.

### 0.2 The four new members have nothing but a name and a title

Songqi Gao, Victory Stewart, Abdullah Khan and Nathan Liu have no credentials,
no email, and no portrait — their cards show a placeholder block rather than a
substituted face. The shorthand titles were expanded to the wording
the site already used ("postdoc" → Postdoctoral Scholar, "research assistance"
→ Research Assistant, "masters" → Master's Student), which is a guess at
house style, not at fact — correct any that are wrong.

- `src/content/people/*.md`

### 0.3 /people is one grid now, not a section per position

Each person's title prints under their name instead of being a heading above
them. Seven people split across six position headings read as a much emptier
lab than it is. `group` and `groupOrder` are gone from the schema.

### 0.3a Portraits, and the group photograph's date

Portraits supplied for **Dr. Lu, Ryan Hall, Yue Jiang and Evan Dubrunfaut**;
the other four members show a placeholder. Alt text is `Portrait of {name}` —
plain and true, rather than describing a person's appearance.

The group photograph is the one the old site used, **taken 22 September 2023**,
and the caption prints that date. It does not name anyone: nine people are in
the picture and nobody has confirmed who they are, so the caption says the
photograph predates the current roster and stops there.

**Needed:** a current group photograph, and portraits for the remaining four.

### 0.4 The lab photographs were renamed and de-duplicated

They existed twice: once in `public/`, shipped verbatim and referenced by
nothing, and once in `src/assets/lab/`, which is what the pages actually use.
Only the second set is kept, under the names the lab gave them
(`form_nanoparticle`, `cell_culture`, `sample_prep`, `lab_work`). That also
takes ~12MB of unreferenced originals out of the deploy.

The alt text and captions were written from what is visible in each photograph
and still need checking against what is actually going on in them —
`src/data/lab-photos.json`.

### 0.5 The Google Scholar import — what went in, and what did not

`/publications` now carries **278** entries: the 65 from the previous site plus
**213** pulled from Dr. Lu's Scholar profile
(`user=hO6xhakAAAAJ`, sorted by date), read in four pages on 26 August 2026.

Scholar lists **334** records. They account for as follows:

| | Count |
|---|---|
| Imported | 213, of which 6 correction and retraction notices were later removed |
| Already on the site | 58 |
| Duplicate rows within Scholar itself | 18 |
| No year given by Scholar — see below | 36 |
| Not attributable to Dr. Lu — see below | 4 |
| Broken records — see below | 5 |
| **Total** | **334** |

**Three things need a decision.**

**(a) Author lists are Scholar's, not the journals'.** Scholar prints initials
rather than full names (`ZR Lu`, not `Zheng-Rong Lu`) and cuts long lists off
after six or seven names with an ellipsis. Those entries therefore have shorter,
less precise citations than the 65 carried over from the old site, which have
full names. Every imported citation ends in `…` where Scholar truncated it. The
full author lists exist only on each work's own Scholar page or at the
publisher, and pulling 213 of those is a separate job — say the word.

**(b) Corrections and retraction notices are out; patents and abstracts stay.**
The lab asked for papers and patents only, so six records were deleted: four
correction notices, one retraction notice, and one duplicate of a paper filed
under the Web-of-Science `(vol 8, 2017)` correction form. The papers each of
them referred to are all still on the site.

**One retracted paper is still listed** and needs a decision:
*RETRACTED ARTICLE: Albumin pre-coating enhances intracellular siRNA delivery of
multifunctional amphiphile/siRNA nanoparticles* (2012). This is the paper
itself, carrying the publisher's own retracted-article marking, not a retraction
notice — which is why it was kept when the notices went. Removing it is an
editorial call about the publication record, not a tidy-up. Say if it should go.

US patents and patent applications remain, as do conference abstracts and
posters; Scholar does not separate those from papers and neither does the page.
Abstracts are identifiable by their venue text (`Cancer Research 77
(2_Supplement)`, `MOLECULAR THERAPY 26 (5)`) if they should come out too.

**(c) No links.** Scholar's list view gives no DOI or PubMed link, so the
imported entries have no `url:` and render as plain text. The 65 older entries
mostly link to PubMed.

**36 records carry no year on Scholar** and were not imported, because the
publications page groups by year and a year would have had to be invented.
They look like conference abstracts and posters:


- Molecular MR Imaging for Immunosurveillance and Therapeutic Monitoring of Pancreatic Cancer during Neoantigen Vaccine Therapy
- Magnetic Resonance Molecular Imaging of Patient-Derived Xenografts with MT218
- MR Molecular Imaging of Pancreatic Ductal Adenocarcinoma during a Therapeutic Vaccine Regimen
- Targeting Extradomain-B Fibronectin to Monitor Immune Checkpoint Therapy with MRI in Head and Neck Squamous Cell Carcinoma
- Monitoring triple negative breast cancer therapy against lncRNA MANCR with MT218, a targeted MRMI contrast agent
- Materials for biology and medicine
- MR Molecular Imaging of EDB-Fibronectin for Non-Invasive Monitoring of miR-200c Therapy in Pancreatic Cancer
- MR Molecular Imaging of Extradomain-B Fibronectin for Non-invasive Active Surveillance of Prostate Cancer
- Synthesis and Evaluation of CREKA-Tris (Gd-DOTA) 3 for MR Molecular Imaging of Breast Cancer
- Rapid Multislice T1 Mapping of Contrast-Enhanced Mouse Tumor Using Saturation Recovery Look-Locker Method with Spiral Readout
- Detection and Risk-stratification of Prostate Cancer with MR Molecular Imaging using Extradomain-B Fibronectin as a Biomarker
- Effective MR Molecular Imaging of Prostate Cancer with an EDB-Fibronectin-Specific Contrast Agent at Reduced Doses
- Non-invasive assessment of hyperthermic ultrasound enhanced tumor drug delivery with CE-MRI
- MRMI of Extradomain-B Fibronectin for Assessing Drug Resistance in Colon Cancer
- Magnetic resonance molecular imaging of EDB fibronectin with a ZD2 peptide Gd (HP-DO3A) conjugate for detecting pancreatic cancer
- MR Molecular Imaging of Breast Cancer Metastases with Peptide Targeted Tripod Macrocyclic Gd (III) Chelates
- Manganese-Enhanced MRI for Preclinical Evaluation of Therapeutic Efficacy of Retinal Degeneration Treatment
- Assessment of anti-angiogenic efficacy of targeted ECO/siHIF-1α nanoparticles with DCE-MRI and a biodegradable macromolecular contrast agent
- Detection of Aggressive Prostate Cancer Using Extradomain-B Fibronectin Targeted MRI Contrast Agent
- A CLT1 Peptide Targeted Nanoglobular Contrast Agent for Cancer Molecular Imaging with MRI
- MR Molecular Imaging of EDB-Fibronectin for Precision Imaging of Oral Squamous Cell Carcinoma
- MR molecular imaging of extradomain-B fibronectin for characterizing prostate cancer aggressiveness
- Molecular MR imaging of micrometastasis of breast cancer
- Clinical Translation of MR Molecular Imaging
- THERANOSTIC NANOAGENTS
- A Targeted Host-Guest MRI Contrast Agent for Breast Cancer Molecular Imaging
- Multifunctional ECO nanoparticles delivering β3 integrin siRNA for the treatment of metastatic breast cancer
- Application of a biodegradable, macrocyclic, polydisulfide-based contrast agent for monitoring tumor angiogenesis using dynamic contrast enhanced MRI
- Multifunctional ECO-mediated delivery of miR-200b for metastatic breast cancer therapy
- Development of a novel multifunctional pH-sensitive carrier for effective siRNA delivery
- Retinylamine Modified Multifunctional Lipid DNA Delivery System for the Treatment of LCA2
- Synthesis and characterization of a nanoglobular dendrimer 5-aminosalicylic acid conjugate with a Schiff base spacer for treating retinal diseases
- A Targeted Nanoglobular Manganese (II) Chelate Conjugate for Magnetic Resonance Cancer Molecular Imaging
- Assessment of the antiangiogenic therapy of avastin in an animal colon cancer model with DCE-MRI and a biodegradable macromolecular contrast agent
- β3 Integrin siRNA-Loaded Multifunctional Nanoparticle Therapy for Metastatic Breast Cancer
- NANOGLOBULAR MACROCYCLIC Gd (III) CHELATE CONJUGATES AS MAGNETIC RESONANCE IMAGING CONTRAST AGENTS

**4 records list no author named Lu** and appear to be mis-attributions on the
profile rather than the lab's work. Adding them would have claimed authorship
of somebody else's paper:


- Solid lipid nanoparticles for anti-tumor drug delivery — *HL Wong, Y Li, R Bendayan, MA Rauth, XY Wu*, Nanotechnology for cancer therapy, 741-776, 2006
- Specific heat of single-crystal NdMnO3 — *JG Cheng, Y Sui, ZN Qian, ZG Liu, XQ Huang, JP Miao, Z Lu, XJ Wang, ...*, Wuli Xuebao/Acta Physica Sinica 54 (9), 4359-4364, 2005
- Materials for biology and medicine — *X Huang, X Sun, W Wang, Q Shen, Q Shen, X Tang, J Shao, J Moreira, ...*, (no venue), 2003
- Performance of tolerance to photooxidation and kernel quality of rice and their correlation — *C Dongmei, L Kangjing, L Wenxiong, C Zhixiong, G Yuchun, L Yiyuan*, Fujian Journal of Agricultural Sciences 17 (1), 1-5, 2002

**5 records are broken** — a year of 1910, a year of 0, a title that is a
fragment of an article's body, a title that is a stray author name, and one with
markup mangled into the title:


- Noninvasive Visualization of Pharmacokinetics, Biodistribution and Tumor Targeting of Poly (Emphasis Type=" Bo — mangled markup in title; duplicate of the same paper listed cleanly
- An EDB fibronectin specific contrast agent for molecular imaging of cancer metastasis — year recorded as 1910
- Organometallics1996, 15, 1651 — not a publication record; year 0
- Results and Discussion: The fibronectin immunostain of tumor slice was shown in Fig. 1. Fluorescence from intr — title is a fragment of an article body, not a title
- and David H. Thompson — title is a parsing artifact

**Two duplicate pairs already in the old data were removed**, found while
de-duplicating against Scholar. Both were the same record entered twice:

- *Molecular imaging of the tumor microenviornment* — filed under both 2016 and
  2017 with the same PubMed ID. The 2016 copy was deleted: the paper is
  Advanced Drug Delivery Reviews **113**, 24–48, which is 2017, and that is what
  Scholar gives.
- *Preclinical Assessment of the Effectiveness of Magnetic Resonance Molecular
  Imaging of Extradomain-B Fibronectin for Detection and Characterization of
  Oral Cancer* — two identical 2020 files. One was deleted.

Both pairs also carry the misspelling `microenviornment` in their titles, which
is still there and still needs correcting, and which is why an exact-title match
did not catch them.

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

## 3. Photographs — partly supplied

**Four real photographs of the lab were supplied** and are now used across the
site: all four are the home page hero, which cycles through them, and they also
carry the page banners on research, instruments and join. They live in
`src/assets/lab/` with their alt text and captions in
`src/data/lab-photos.json`. The hero captions are those captions — they are the
most prominent text on the site after the masthead, so they are worth a read.

A lipid nanoparticle render was also supplied. It now illustrates the Nucleic
Acid Therapies card on the home page and the fallback for the platform section.
It is labelled "illustrative render" wherever it appears, because it is an
illustration of the ECO platform rather than a micrograph of a particle the lab
made. **Confirm that framing.**

The render is tinted into the site's blue by a masked blend in
`Nanoparticle.astro` — the source is violet on a pale shell, which read badly on
a dark ground. The underlying image is unmodified except for a radial trim that
removed backdrop glow spilling past the particle.

Still placeholders, because they stand for specific things no photograph
supplied so far shows: the 11 member portraits, the group photograph, the four
instruments, the campus map, and the two research diagrams.

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
| `/research` — Nucleic Acid Therapies | 16:9 | Diagram: ECO lipid structure and the PERC delivery mechanism |
| `/instruments` — 4 instruments | 3:2 | One photo per instrument |
| Captions for the four supplied photos | — | Confirm the captions in `src/data/lab-photos.json` describe what is actually happening in each shot |
| `/contact` | 4:3 | Static campus map showing the Wickenden Building |

Placeholder captions are set per person in `photoNote:` and per research area in
`figureNote:`.

**Also needed:** if the lab supplies its own instrument and laboratory
photographs, the Unsplash banners should be replaced with them and the
`/credits` page trimmed accordingly.

---

## 4. Pages with missing or incomplete content

### 4.0 The platform copy moved to `/research`, and it overlaps
The home page used to pin a section in which a WebGL point cloud morphed
through three structures while three panels explained them. That section has
been replaced by a decorative animation which carries no copy at all, so the
three panels were moved to `/research` under the heading "The platform",
**verbatim** — nothing was rewritten, merged or summarised.

**Two of the three now say the same thing twice on one page.** This is
deliberate and is for you to resolve, not for the site to decide:

- "A carrier built to come apart" restates the ECO description that already
  appears a few sections below it in Thrust 01, Nucleic Acid Therapies — the
  head group, the cysteine linkers, the oleic acid tails, the electrostatic
  condensation, the reversible disulfides.
- "Docking onto the remodelled matrix" restates the fibronectin paragraphs in
  Thrust 02, Molecular Imaging.
- Panel 02, "Probes that report the microenvironment", is the only one with no
  counterpart on the page.

Three honest options: delete the two duplicates and keep only panel 02; keep
all three and cut the overlapping paragraphs from the thrust bodies; or keep
the duplication as a deliberate summary-then-detail structure. Say which.

**Panel 02 also still needs a read on its own terms.** "Contrast agents are
built around a chelated metal centre" is a general statement about how contrast
agents work, not a description of any specific agent this lab has published. It
was written that way deliberately, because the source pages say the probes are
used "with both MRI and PET" and do not name a chelate.

**Terminology check:** the panels say the probes target *fibronectin*, matching
the Center's own Molecular Imaging page. Confirm that is still the right word
for the current work.

### 4.0a-0 The mission statement lost a sentence
Dr. Lu's paragraph on the home page now reads:

> Our goal is to design and develop simple and smart biomolecules to target
> specific biological signatures for accurate detection and effective treatment
> of diseases.

The original was:

> To accomplish this, we aim to mine signatures that are reflections of the
> tumor microenvironment, cellular or subcellular processes in the diseases.
> Further, our goal is to design and develop simple and smart biomolecules to
> target specific biological signatures for accurate detection and effective
> treatment of diseases.

The first sentence was cut so the statement sits alongside the animation.
"Further," was left dangling by that cut and was dropped with it. **Both are
edits to Dr. Lu's own words** — restoring either is a one-line change to
`SITE.missionExtended`.

### 4.0a The home page animation beside the mission statement
A scroll-driven, pinned sequence: a lipid nanoparticle fills the frame, the
camera pulls back until it is a point of light inside a human figure, the point
travels to a target site, and the camera pushes back in as the cargo is
released. See ANIMATION_SPEC.md for the full build.

It is **decorative**, and it has been kept decorative on purpose: no labels, no
organ names, no arrows, no callouts, nothing named anywhere in it. It is hidden
from screen readers and carries only an off-screen heading. Three things follow
that you may still want to change:

- **The figure is human, front view.** That implicitly frames the work as
  clinical rather than preclinical. It is defensible — MT218 is in trials — but
  if the site should read as preclinical, the silhouette should be a mouse and
  the injection should move to the tail vein. It is one file
  (`src/components/journey/BodyScaffold.astro`) and no other code changes.
- **The target site is unlabelled on purpose.** It is a glow in the upper
  torso with no organ under it and no caption. Nothing identifies it, so
  nothing is claimed. If you would rather it were specifically the liver, or a
  tumour site, that becomes a factual statement and needs your say-so.
- **The animation no longer shows the cargo.** It used to end by zooming back
  into the particle so the shell could part and an mRNA strand emerge. It now
  ends on a glow spreading over the figure, which reads as an effect on the
  patient rather than an event inside a molecule. The consequence: on a page
  about nucleic acid delivery, the animation never depicts nucleic acid. That
  was a deliberate call, and it is reversible — the Blender scene still builds
  the strand, it is simply not rendered into a sequence any more.

- **The particle is schematic.** It is now rendered in Blender rather than
  drawn in the browser, which makes it look considerably more like a real
  electron-microscope-style depiction — and that raises the stakes. It shows a
  lipid shell of individual molecules, four inverted micelles each holding a
  condensed nucleic acid blob, and interstitial ionizable lipids. That
  architecture follows the reference render on the Nucleic Acid Therapies card,
  but **it is generated from parametric primitives, not from structure data**:
  no claim is made about lipid counts, micelle number, packing, bond lengths or
  stoichiometry.

  The more convincing it looks, the more a reader may take it as a measurement.
  There is **no visible caption** saying otherwise, because the animation
  carries no text at all — the disclaimer lives only in the source. **This is
  the one thing here I would most want your ruling on.** The section can take a
  caption below it without disturbing the animation.

- **One colour is off-palette on purpose.** The inverted micelles are violet.
  With them in the same blue family as the shell the interior read as an
  undifferentiated mass and the structure was invisible; the reference render
  uses purple for the same reason. Say the word and they go back to blue.

### 4.0b Ordering of the two research areas
Nucleic acid therapeutics now leads molecular imaging everywhere the site sets
that order itself: the research thrusts, the home page cards, the platform
panels on `/research`, and the `/join` lede.

**Two places were deliberately left alone**, because they are verbatim
transcriptions of Dr. Lu's own text rather than the site's own wording:

- the bio on `/people` ("His laboratory concentrates on molecular imaging and
  drug delivery ..."), taken from his faculty page;
- his research-interests list on the same page, which starts "Novel MRI
  contrast agents · Molecular imaging ...".

Reordering either would be editing a quoted record. **Say the word and both can
be re-ordered to match**, or better, replaced with wording Dr. Lu confirms.

### 4.0c The mission statement now reads on a moving ground
The mission statement sits on a shader field rather than on paper. It is
atmosphere only — no meaning is carried by it — but two things follow:

- The paragraph is white on deep blue, and it brightens a word at a time as you
  scroll. The un-read words sit at 50% opacity. Measured against the brightest
  frame of the moving field over six samples, that floor holds 3.4:1 at 1440px
  and 3.5:1 at 390px. **The bar is 3:1, not 4.5:1**, because the paragraph is
  set at 27px and up and therefore counts as large text. If the copy is ever
  set smaller, that floor has to be raised or the effect dropped.
- Below 760px the field dims itself and the rings around the paragraph pull
  back, because the type spans the whole width and there is no quiet side of
  the frame to put it on.

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
