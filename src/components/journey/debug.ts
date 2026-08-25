/**
 * The `?debug` panel.
 *
 * Every numeric and colour leaf of the tuning object gets a live control, plus
 * a slider that scrubs progress directly without touching the scroll position.
 * Changing a value writes straight into the tuning object and re-renders the
 * current frame, so the section can be dialled in against the real page.
 *
 * "Copy JSON" puts the whole tuned object on the clipboard in the shape
 * journey.ts expects, so a session's work can be pasted back into the source.
 *
 * Only ever loaded when the query string asks for it — the controller imports
 * this module dynamically.
 */
import type { Tuning } from '../../lib/journey';

interface PanelOptions {
  cfg: Tuning;
  getProgress(): number;
  setOverride(v: number | null): void;
  rerender(): void;
  refresh(): void;
}

interface Leaf {
  group: string;
  key: string;
  /** Index into an array leaf, or -1 for a scalar. */
  slot: number;
  kind: 'number' | 'color';
  min: number;
  max: number;
  step: number;
}

/** Sensible bounds for a value, given what it currently is. */
function bounds(v: number, isRange: boolean): [number, number, number] {
  if (isRange || (v >= 0 && v <= 1)) return [0, 1, 0.005];
  if (Number.isInteger(v) && v > 8) return [0, Math.max(8, v * 3), 1];
  return [0, Math.max(1, v * 3), 0.01];
}

function collect(cfg: Tuning): Leaf[] {
  const out: Leaf[] = [];
  for (const [group, val] of Object.entries(cfg)) {
    if (typeof val === 'number') {
      const [min, max, step] = bounds(val, false);
      out.push({ group: 'root', key: group, slot: -1, kind: 'number', min, max, step });
      continue;
    }
    if (!val || typeof val !== 'object') continue;
    for (const [key, leaf] of Object.entries(val as Record<string, unknown>)) {
      if (typeof leaf === 'number') {
        const [min, max, step] = bounds(leaf, false);
        out.push({ group, key, slot: -1, kind: 'number', min, max, step });
      } else if (typeof leaf === 'string' && /^#[0-9a-f]{6}$/i.test(leaf)) {
        out.push({ group, key, slot: -1, kind: 'color', min: 0, max: 0, step: 0 });
      } else if (Array.isArray(leaf)) {
        leaf.forEach((entry, slot) => {
          if (typeof entry !== 'number') return;
          const isRange = leaf.length === 2 && group === 'shots';
          const [min, max, step] = bounds(entry, isRange);
          out.push({ group, key, slot, kind: 'number', min, max, step });
        });
      }
    }
  }
  return out;
}

function read(cfg: Tuning, l: Leaf): number | string {
  const bag: any = l.group === 'root' ? cfg : (cfg as any)[l.group];
  const v = l.group === 'root' ? bag[l.key] : bag[l.key];
  return l.slot >= 0 ? v[l.slot] : v;
}

function write(cfg: Tuning, l: Leaf, v: number | string) {
  const bag: any = l.group === 'root' ? cfg : (cfg as any)[l.group];
  if (l.slot >= 0) bag[l.key][l.slot] = v;
  else bag[l.key] = v;
}

const CSS = `
.jrn-debug {
  position: fixed; top: 0; right: 0; z-index: 90;
  width: 21rem; max-height: 100vh; overflow: auto;
  background: rgba(6,12,30,0.94); color: #e8eef8;
  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 0.75rem 0.85rem 2rem; box-shadow: -8px 0 32px rgba(0,0,0,0.5);
  backdrop-filter: blur(6px);
}
.jrn-debug h2 { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #ffd9a0; margin: 0 0 .5rem; }
.jrn-debug h3 { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #7fb0d4; margin: .9rem 0 .35rem; border-top: 1px solid rgba(255,255,255,.12); padding-top: .5rem; }
.jrn-debug .row { display: grid; grid-template-columns: 8.5rem 1fr 3.2rem; gap: .35rem; align-items: center; margin-bottom: .18rem; }
.jrn-debug label { color: #b9c8dd; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jrn-debug input[type=range] { width: 100%; accent-color: #f2a03d; }
.jrn-debug input[type=number] { width: 100%; background: rgba(255,255,255,.08); border: 0; color: #fff; padding: .12rem .2rem; font: inherit; }
.jrn-debug input[type=color] { width: 100%; height: 1.2rem; background: none; border: 0; padding: 0; }
.jrn-debug .scrub { position: sticky; top: 0; background: rgba(6,12,30,0.98); padding-bottom: .5rem; margin: -0.75rem -0.85rem .3rem; padding: .75rem .85rem .5rem; border-bottom: 1px solid rgba(255,255,255,.14); }
.jrn-debug .scrub input[type=range] { width: 100%; }
.jrn-debug button { background: #f2a03d; color: #09143a; border: 0; padding: .3rem .6rem; font: inherit; font-weight: 700; cursor: pointer; margin-right: .3rem; }
.jrn-debug .note { color: #7f90a8; margin-top: .5rem; }
`;

export function mountDebugPanel(opts: PanelOptions) {
  const { cfg } = opts;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'jrn-debug';
  panel.setAttribute('aria-hidden', 'true');

  /* ---- Progress scrub ---- */
  const scrub = document.createElement('div');
  scrub.className = 'scrub';
  scrub.innerHTML = `
    <h2>LNP journey &middot; debug</h2>
    <div class="row" style="grid-template-columns:4.2rem 1fr 3.2rem;">
      <label>progress</label>
      <input type="range" min="0" max="1" step="0.001" data-scrub />
      <input type="number" min="0" max="1" step="0.001" data-scrub-num />
    </div>
    <div>
      <button type="button" data-release>follow scroll</button>
      <button type="button" data-copy>copy JSON</button>
    </div>
  `;
  panel.appendChild(scrub);

  const scrubRange = scrub.querySelector<HTMLInputElement>('[data-scrub]')!;
  const scrubNum = scrub.querySelector<HTMLInputElement>('[data-scrub-num]')!;
  const sync = (v: number) => {
    scrubRange.value = String(v);
    scrubNum.value = v.toFixed(3);
  };
  sync(opts.getProgress());

  const drive = (v: number) => {
    sync(v);
    opts.setOverride(v);
  };
  scrubRange.addEventListener('input', () => drive(Number(scrubRange.value)));
  scrubNum.addEventListener('input', () => drive(Number(scrubNum.value)));
  scrub.querySelector('[data-release]')!.addEventListener('click', () => {
    opts.setOverride(null);
    sync(opts.getProgress());
  });
  scrub.querySelector('[data-copy]')!.addEventListener('click', () => {
    void navigator.clipboard?.writeText(JSON.stringify(cfg, null, 2));
  });

  /* ---- Every tunable ---- */
  const leaves = collect(cfg);
  let group = '';
  for (const l of leaves) {
    if (l.group !== group) {
      group = l.group;
      const h = document.createElement('h3');
      h.textContent = group;
      panel.appendChild(h);
    }

    const row = document.createElement('div');
    row.className = 'row';
    const name = l.slot >= 0 ? `${l.key}[${l.slot}]` : l.key;
    const label = document.createElement('label');
    label.textContent = name;
    label.title = name;
    row.appendChild(label);

    if (l.kind === 'color') {
      const c = document.createElement('input');
      c.type = 'color';
      c.value = String(read(cfg, l));
      c.addEventListener('input', () => {
        write(cfg, l, c.value);
        opts.rerender();
      });
      row.appendChild(c);
      const spacer = document.createElement('span');
      row.appendChild(spacer);
    } else {
      const cur = Number(read(cfg, l));
      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(l.min);
      range.max = String(l.max);
      range.step = String(l.step);
      range.value = String(cur);

      const num = document.createElement('input');
      num.type = 'number';
      num.step = String(l.step);
      num.value = String(cur);

      // Some values are only read when geometry is rebuilt, not per frame.
      const structural = l.group === 'trail' && l.key === 'segments';
      const push = (v: number) => {
        write(cfg, l, v);
        range.value = String(v);
        num.value = String(v);
        if (structural || l.key === 'pinVh' || l.key === 'scrub') opts.refresh();
        else opts.rerender();
      };
      range.addEventListener('input', () => push(Number(range.value)));
      num.addEventListener('input', () => push(Number(num.value)));
      row.appendChild(range);
      row.appendChild(num);
    }
    panel.appendChild(row);
  }

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent =
    'Values write straight into the tuning object. count and pinVh need a reload to take full effect.';
  panel.appendChild(note);

  document.body.appendChild(panel);
}
