# Homepage animation — LNP journey

This is the spec as built. Where it differs from the original brief, the
difference is called out in **Changed from the original spec** at the bottom
rather than quietly rewritten, so the two can still be compared.

## Purpose

A scroll-driven animation on the lab homepage, directly below the mission
statement, in the slot the pinned platform section used to occupy. Its job is
decorative and atmospheric. It is not an explainer, it carries no labels, and
it makes no scientific claims that need citing.

The sequence: a lipid nanoparticle fills the frame, the camera pulls back until
it becomes a point of light inside a body, the point travels through the
vasculature to a target site, and the camera pushes back in as the particle
releases its cargo.

## Non-goals

- No text, labels, organ names, arrows, or callouts anywhere in the animation
- No syringe, needle, plunger, or droplet
- No depiction of specific mechanism — no endosomes, no receptors, no pH transitions
- No sound
- No video, on any breakpoint
- Not a standalone page or modal; it lives inline in the homepage flow

## Placement and scroll behaviour

The section pins to the viewport and the animation is scrubbed by scroll
progress. Total pinned distance: **2.4 viewport heights**, with `scrub: 0.6`.

Scrolling backward reverses the animation exactly. There is no autoplay
anywhere, and nothing structural is on a timer: every visual property is a pure
function of a single `progress` value from 0 to 1.

## Placement

The section shares a row with the mission statement: the statement reads down
the left, the animation runs in the column beside it, and one shader field sits
behind both. They were two stacked full-height sections before, which left the
animation on its own with nothing to be about.

Dr. Lu's paragraph lost its opening sentence so it fits the column. "Further,"
was left dangling by that cut and went with it — a grammatical consequence, not
a change of meaning. The original is recorded in TODO.md.

Pinned distance: **1.8 viewport heights**, `scrub: 0.6`.

## Shot list

| Range | What happens |
|---|---|
| 0–20% | Resistance. Nothing advances; the scene tightens. The mission statement comes up to white inside this beat and is finished by 13%, so it is read before anything moves. |
| 20–30% | The cut closes. |
| 28–44% | Camera pulls back; the particle shrinks to 2% of its opening size. |
| 24–46% | The curve draws in, the body appears from nothing and draws itself. |
| 46–64% | The point travels: a short approach, in at the upper arm, through the shoulder into the chest. |
| 64–72% | Arrival: the point flares as it lands, and keeps rising into the bloom. A second beat of resistance runs under it. |
| 72–96% | The bloom spreads over the figure, which brightens under it. |
| 96–100% | Holds. |

The hold at the end is 4% of the track and no more. It exists so the finished
composition is a frame rather than an instant; anything longer is scrolling
past a picture that has already stopped, which is what the tail was before.

The opening is slow and the tail is brisk, deliberately. The cross-section is
the thing worth looking at and it earns its beat; the journey does not, and
dwelling on it only makes the section feel long.

**Why the close is short.** With a fixed 22 frames, the fewer pixels of scroll
they are spread across the more frames land per pixel — so a fast close reads
*smoother*, not rougher. Stretched over a longer window it stepped visibly.

**And the 22 frames are cross-dissolved, not snapped to.** Picking the nearest
frame meant the close played back as 22 discrete states however smoothly it was
scrubbed. The canvas draws the frame below and then the frame above it at the
fraction between them, which costs one extra `drawImage` and no bytes — and
there is no budget for more renders, since the sequence is 1.7MB as it is.

**The route is physiologically right**, which is a happy accident rather than a
compromise for the composition: an injection into an arm vein travels the
subclavian to the superior vena cava, through the right heart, and the lungs
are the first capillary bed it reaches. The previous version crossed open air
from the elbow into the torso, which was simply wrong.

**There is no mRNA reveal.** The animation used to end by pushing the camera
back into the particle so the shell could part and a strand emerge. It now ends
on the bloom, which is a wider shot and needs no particle detail — so the
release sequence was deleted, taking the payload from 3.75MB to 1.7MB. The
consequence worth knowing: the animation no longer depicts nucleic acid cargo
at all, on a page about nucleic acid delivery.

## Architecture

| File | Owns |
|---|---|
| `src/lib/journey.ts` | Every tunable, the easing curves, `cameraAt(p)` and `computeFrame(p) → JourneyFrame`. Pure — no DOM, no GSAP, no `window`. |
| `src/lib/journey-bridge.ts` | The typed, namespaced channel to the particle island. |
| `src/components/journey/JourneySection.astro` | Section wrapper, screen-reader heading, ground, inline capability gate. |
| `src/components/journey/BodyScaffold.astro` | The scene SVG: curve, body, trail. Markup and IDs only. |
| `src/components/journey/Nanoparticle.tsx` | Scrubs the rendered frame sequences onto a canvas. |
| `src/components/journey/stage.ts` | Applies a frame to the ground and the SVG; owns the curve geometry. |
| `src/components/journey/controller.ts` | The single ScrollTrigger. |
| `src/components/journey/debug.ts` | The `?debug` panel. Dynamically imported. |
| `blender/scene.py` | The particle itself, generated procedurally. |
| `blender/encode.sh` | PNG sequences → WebP. |

### How progress reaches each element

```
ScrollTrigger.onUpdate(self)
  → p = self.progress
  → frame = computeFrame(p)          // pure, in journey.ts
  → stage.apply(frame)               // ground + camera + curve + body
  → getParticle()?.place(x, y, r)    // projected through the SAME camera
  → getParticle()?.set(frame)
```

**One camera.** `cameraAt` returns a focus point and a zoom; the SVG takes it as
a transform and the particle takes it as a projected screen position and size.
Because the particle's place on the curve is projected through the camera the
SVG is already using, the two cannot drift apart — measured at **2px** across
the travel.

An earlier version damped the SVG camera to keep the curve on screen while the
camera was inside the particle. That is incoherent: the particle rides the
curve, so damping one and not the other puts the particle off its own path. It
ended up pinned to the left edge at a third of its intended size.

### The particle

Rendered in Blender, not drawn in real time. Two sequences, both square,
centred and transparent, so placement stays the controller's job:

- **`section`** (22 frames) — the cut plane retracts from a cross-section to a
  closed sphere. Frame 0 is the cutaway; the last frame is the closed particle,
  which is held through the journey, so no third sequence is needed.
- **`release`** (30 frames) — the shell parts again and the mRNA strand emerges.

`blender/scene.py` generates the whole thing from constants: ~1,500 outer and
~850 inner lipids as individual molecules sharing one mesh datablock, four
inverted micelles each holding a metaball blob of condensed cargo, interstitial
ionizable lipids, and the released strand as a backbone with nucleotides.

Frames are fetched only when the section is near, decoded once into
ImageBitmaps and blitted to a canvas. A glow is drawn behind the particle
weighted toward small sizes — through the journey it is about 30px across, and
a render of several thousand lipids downsampled that far is unreadable noise,
so the glow carries it and the detail carries the two ends.

### Things that cost a rebuild to discover

- **AgX**, Blender's default view transform, deliberately desaturates and rolls
  off highlights. On a saturated navy page it washed everything toward white.
  Standard transform instead.
- **A back light on the camera axis.** A transmissive sphere is a lens; an area
  light behind it refracted straight into the lens and the shell rendered as a
  flat white disc. Every light is now well off axis.
- **The world colour has to be the page's ground.** `film_transparent` hides the
  background from the render but transmissive surfaces still refract it, so a
  neutral studio world reads as a bright disc once composited onto navy.
- **Alpha, not colour, dominates the file size.** A near-lossless alpha channel
  over a silhouette of several thousand lipid tips cost more than the image;
  `alpha_q 28` at 640px took a frame from ~190KB to ~80KB with no visible
  change at display size.
- **Judge renders on the ground they will sit on.** Several iterations were
  spent on a problem that was invisible against white.

## The scaffold

**Subject: a human figure, front view.** (The body, not the particle.) Injection at the antecubital vein (the
inner elbow). The target is an **unlabelled glow in the upper torso** — no
organ under it, no caption, nothing named. An unlabelled dot claims nothing,
which also sidesteps the liver-vs-tumour question entirely.

A front view rather than side: a side-on human silhouette reads as a stock
pictogram, and a front view gives the vessel path somewhere to travel.

## Motion detail

**Easing.** Nothing linear, and nothing that starts or stops at speed. Every
beat runs on `softOut` — `easeOutQuart` composed with a `smoothstep` — which
keeps the weight at the front of the beat while giving both ends zero velocity.
Plain `easeOutQuart`, which this used before, goes from stationary to maximum
speed in a single frame; six channels used it and all six measured a
100%-of-peak acceleration step at their start.

**The travel is a speed profile, integrated** — not two eased distance curves
glued together. The glued version was continuous in position and not in speed:
the first piece ended with an ease-out, so its velocity reached zero exactly
where the second started at 1.9 units, and the point stopped dead in mid-flight
and re-launched. That seam measured **74% of peak speed in a single frame**,
the largest acceleration step anywhere in the section. A speed profile cannot
have that fault: position is its integral, so it is smooth by construction. It
rises over the first 16%, cruises, and falls over the last 62% to a standstill.

**The camera centre is solved from the screen offset**, not interpolated in
scene space. Screen position is `(scene − centre) × zoom`; with both terms on
the same eased parameter the product peaks two-thirds of the way through the
pull-back, so the point swung about 60px past its resting place and drifted
back into it, its speed across the frame varying four-fold on the way.

Measured after all of the above, no channel's worst single-frame acceleration
step exceeds **8.4%** of its own peak speed.

**The arrival and the bloom are one brightening.** The flare on landing only
ever rises, and holds as the hot core the bloom spreads out from. As a bell it
peaked at 67%, was gone by 70%, and left two hundredths of dead track before
the bloom began — measured on the rendered pixels, mean luminance in a box on
the target went 42.7, 42.4, then up to 50.4: brighter, dimmer, bright again,
three events where there should be one. It now climbs 48.9 to 77.1 with no
reversal anywhere.

**The point's position is never smoothed in screen space.** It was, with the
same exponential filter the radius still uses, and that filter walks the point
in a straight line toward wherever the curve currently says it is. Scrolled
slowly the step is a pixel or two and the chord is indistinguishable from the
arc; scrolled fast the target jumps most of the way along a bend and the point
cuts inside it — measured at 13.2px in from the top of the curve on a single
jump through the travel, against 0.5px at rest. The inertia belongs to
progress, where `scrub` already provides it, because easing progress moves the
point along the curve rather than across it. After: 3.2px, which is the canvas
drawing on its own frame rather than any departure from the path.

**Trail.** The path ahead of the point sits at 0.13 opacity. Behind it a
segment lights to full and settles back to 0.34 over ~16% of path length. Both
boundaries — the head of the comet and the end of the drawn-in curve — are
crossfaded over a segment and a half rather than switched at: with a hard
`centre > head` test the brightest thing on screen advanced one whole segment
at a time while everything around it moved continuously. Colour crossfades with
it, out of a 17-step ramp resolved once rather than built 56 times a frame.

**Draw-in.** The body draws over 8% of progress, limbs over the next 8%,
overlapping by half. Not a fade.

**Pulse.** One soft radial glow, scaling 1 → 2.5 and fading out, over 78–88%.
It is a `sin(πt)` bell over its own range and zero everywhere else, so there is
nothing to reset and nothing that can repeat.

**Unspool.** Cargo particles are gated by their position along the strand: a
particle appears only once the unspool has passed it. The strand's shape is
fixed — it does not writhe.

**The one time-based term.** A bounded idle drift (0.05 rad/s rotation and a
0.013-unit per-particle jitter) so a parked particle is not completely dead.
Nothing structural is on a clock, and there is no `setInterval` anywhere.

## Visual spec

- Ground: `#09143a` → `#3f5580` → `#f6f1e7` and back. The blue waypoint exists
  because a direct navy-to-cream blend passes through a dead grey.
- Silhouette and vessel: CWRU blue `#003071` at 0.34 opacity — this recedes.
- The point and its trail: amber `#f2a03d`, core `#ffd9a0`. The only warm
  colour in the section.
- Glow: SVG radial gradients, not a bloom post-process.

## Performance

- Only `transform`, `opacity` and `stroke-dashoffset` are animated
- Rendering pauses via IntersectionObserver when off screen, and on `visibilitychange`
- `devicePixelRatio` capped at 1.75
- No new page weight: `ogl` was already on the homepage, and the section it
  replaced also carried a point cloud. No video, no image sequences.
- All geometry reads happen at refresh; the update path never reads layout

**Nothing about this section runs at page load.** The module is fetched on
idle; the 9000-particle buffer build, the WebGL context and the shader compile
all wait until the section is within 80% of a viewport — about a second of
scrolling ahead of arrival, against a build that measures ~380ms. It then
appears 455ms after crossing that line.

That ordering matters and was got wrong first: building the buffers inside the
mount effect put a **1523ms long task** on the main thread during load, for a
section two viewports below the fold, and took Lighthouse from 80 to 50. The
margin also has to be tight enough to actually defer — this section starts
about 1000px below the fold, so anything over ~120% fires at scroll zero and
defers nothing.

**Measured on the production build, real GPU, desktop preset, three runs:**

| | perf | TBT | LCP | CLS |
|---|---|---|---|---|
| Before this section existed | 80 | 440ms | 0.8s | 0 |
| **Now** | **99 / 100 / 100** | **0–10ms** | **0.8s** | **0** |

Long tasks over the whole load: 667ms total, longest 177ms.

## Accessibility

- The section is `aria-hidden` in its entirety and carries one screen-reader
  heading: **"Nanoparticle delivery animation"**. No visible copy.
- Under `prefers-reduced-motion: reduce`: no pin, no scrub, and no WebGL
  context for this section.

  **Correction to an earlier claim in this file:** it previously said `ogl` is
  never fetched below the gate. That was never true, and the test that
  "proved" it was matching on the string `ogl` while the bundler had named the
  chunk `src.*` — a false pass. `ogl` ships to the home page regardless,
  because `ParticleField` (the hero drift) and `AuroraField` (the mission
  shader) both import it statically and both predate this section. What this
  section controls is whether it *builds* anything: below the gate it creates
  no context, no geometry and no render loop, and it adds nothing to the
  bundle that the page was not already loading.
- The page is readable and scrollable with JavaScript disabled.

**Ship-final, JS-rewinds.** The scaffold's default state *is* the finished
composition — strokes undashed, point at the target, cargo released, warm
ground. An inline synchronous gate swaps that for the animated pre-state before
the section is painted, and puts it straight back if the controller has not
reported in within 3 seconds. Undrawn strokes are a JavaScript state, never a
shipped one.

The static composition is the **arrival frame on the warm ground**, not the
final navy frame: on navy the blue silhouette would be nearly invisible, and a
static block should show the whole picture.

## Mobile

Below **1024px** — matching the site's existing pin gate rather than
introducing a second one at 768 — there is no pin, no canvas and no render
loop. The static composition is what ships. Pinned scroll sections are unreliable on
mobile browsers because of viewport resize on toolbar collapse.

## Tuning

`?debug` on the homepage mounts a live panel: every numeric and colour leaf of
`JOURNEY` as a control (113 of them), grouped by section, plus a slider that
scrubs progress directly without moving the page. "Copy JSON" puts the tuned
object on the clipboard in the shape `journey.ts` expects.

The module is dynamically imported and never appears in the normal bundle.

## Changed from the original spec

1. **Layer 1 is neither pre-rendered clips nor Three.js.** Both were worse than
   what the repo already had. Pre-rendered WebM would fight the weight budget
   and could never match a ground colour that shifts underneath it; Three.js is
   ~600 KB for a worse version of code already written and tuned. Forked
   `MoleculeCanvas` instead and retargeted its third morph state to
   opened-plus-strand.
2. **Pin is 2.4vh, not 1.5vh.** 1.5vh with `scrub: 1` leaves the animation ~1s
   behind when the pin releases, so the closing frame the spec says to hold on
   never renders — which breaks its own acceptance criteria 2 and 4.
3. **"No animation independent of scroll" is read as "nothing structural on a
   timer."** A particle that is a strict pure function of progress is perfectly
   still when you stop scrolling, which reads as broken. A bounded idle drift
   is allowed; nothing else is.
4. **Human figure, front view, not a mouse in side view.** With the target site
   left unlabelled, so the change frames nothing it cannot support.
5. **`#tail-outline` is `#limb-outline`.** A human has no tail.
6. **The heading is screen-reader-only:** "Nanoparticle delivery animation".
   The section carries no visible copy.
7. **The gate is 1024px, not 768px** — one gate for the whole site.
8. **No autoplaying loop on mobile.** It would be a timer, and it would be
   video weight for a decorative flourish. Static frame only.
9. **The ground blend runs through a blue waypoint** rather than straight from
   navy to off-white.
10. **The three research panels that used to occupy this slot moved to
    `/research` verbatim.** Two of them overlap substantially with the thrust
    text already on that page; nothing was merged. See TODO.md §4.0.
11. **The stage is held by CSS `position: sticky`, not by ScrollTrigger.**
    `anticipatePin` is gone for the same reason it always was. Both of
    ScrollTrigger's pin types were tried and measured, and both are worse
    here: `pinType: 'fixed'` takes a full-viewport element out of flow at the
    top of the section and the browser books that as a layout shift the size
    of the element — CLS 1.7 per pass, measured; `pinType: 'transform'` keeps
    the box in flow (CLS 0.000) but holds it still by writing a translate from
    a scroll handler, so on any compositor-scrolled surface — a trackpad — the
    stage lands a frame behind the scroll and visibly shakes. Sticky is the
    compositor's own job: there is no shift to book and no handler to lag. The
    section carries the scroll track as its own height
    (`calc(100svh * (1 + --journey-pin))`) and must not clip its overflow, or
    sticky stops working. The trigger still owns progress; it just no longer
    owns position.

## Acceptance criteria

Measured on the production build (`astro preview`), real GPU.

| # | Criterion | Result |
|---|---|---|
| 1 | Forward and backward identical | **PASS** |
| 2 | Opening and closing camera scales match | **PASS** — same constant, 0% drift |
| 3 | No timers, nothing independent of scroll | **PASS** — parked 4s unchanged |
| 4 | Unpins cleanly, no jump at either boundary | **PASS** — CLS 0.000 over four passes |
| 5 | Reduced-motion path has no pin and no WebGL | **PASS** |
| 6 | Lighthouse above 90 | **PASS** — 99 / 100 / 100 / 99 / 100, TBT 0ms, LCP 0.7–0.9s |
| 7 | All tunable values in one constants object | **PASS** — `JOURNEY`, 125 live controls under `?debug` |

Also verified: the particle sits **1px** off its own curve across the travel;
the camera is continuous (largest change-in-step 2.1% of the largest step);
frames total **1.7MB**, fetched only on approach; the page renders and scrolls
with JavaScript disabled.

### Five ways to measure the particle's position wrongly

The check that the particle sits on its own curve failed five times before it
passed, and every failure was the harness, not the animation. Recorded because
each one looked exactly like a real 100–400px positioning bug:

1. The **fixed page header** sits over the pinned stage and is the brightest
   thing in frame.
2. Puppeteer's screenshot `clip` is in PAGE coordinates, so a viewport-relative
   rect thousands of pixels down the document captures the hero instead.
3. The **aurora shader** shares this section and is far brighter than a dot.
4. The **CSS radial gradient** behind the section has its hot spot at 78%/30%,
   which produced a convincingly constant "position".
5. A **difference image fixes all of the above — but only if everything else is
   static**, and the shader animates continuously. It has to be hidden in both
   captures, not just one.

The measurement that works: hide the shader, capture with the particle canvas
hidden and then shown, and take the centroid of what changed.

**Not asserted:** that `ogl` is absent below the gate. It is not this section's
to gate — the hero particle field and the mission shader both import it
statically on this page. This section no longer uses WebGL at all.

## Tuning after the move to Blender

The `?debug` panel still drives timing, camera, the curve and the trail — the
things that live in `journey.ts`. The particle's *appearance* is now a
re-render: edit the constants at the top of `blender/scene.py`, then

```
blender -b -P blender/scene.py -- --shot section --frames 22 --res 800
blender -b -P blender/scene.py -- --shot release --frames 30 --res 800
./blender/encode.sh
```

That is the real cost of the move, and it was the right trade: a rasteriser
approximates a transmissive membrane and subsurface scattering, and no amount
of fresnel maths in a shader made the real-time version read as an object
rather than a diagram.

## Still open for Dr. Lu

Recorded in TODO.md §4.0 and §4.0a: whether the figure should be a mouse
(preclinical framing) rather than a human; whether the platform panels' overlap
with the research thrusts should be resolved by deletion, by cutting the thrust
text, or left as summary-then-detail; and whether the schematic particle needs
a visible caption now that the section carries no text.
