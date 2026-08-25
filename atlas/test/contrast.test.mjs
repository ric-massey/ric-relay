/* Run: node test/contrast.test.mjs
 *
 * The one rule this app's look is built on is that it has to be readable at
 * arm's length in direct sun, and the way that rule dies is not a redesign —
 * it is somebody nudging a grey one step lighter because it looked nicer on a
 * desk monitor at night. Nothing on screen complains. The next person to check
 * a note at a gate in July is the one who finds out.
 *
 * So the palette is measured rather than trusted, and it is measured by reading
 * the real values out of styles.css. A token renamed or retuned in the
 * stylesheet fails here; a copy of the numbers kept in this file would not.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8');

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log('  ok  ', name); }
  catch (err) { console.error('  FAIL', name, '\n       ', err.message); process.exitCode = 1; }
};

/* ── reading the palette out of the stylesheet ── */

/* Each theme's block, so `--ink` means the right thing in each. Day is both
 * `:root` and `[data-theme="day"]`; night overrides it further down. */
function themeBlock(selector) {
  const at = css.indexOf(selector);
  assert.notEqual(at, -1, `no ${selector} block in styles.css`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
}

function tokens(block) {
  const out = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[name] = value;
  }
  return out;
}

const day   = tokens(themeBlock(':root[data-theme="day"]'));
const night = tokens(themeBlock(':root[data-theme="night"]'));

/* ── WCAG relative luminance, the actual formula ── */
export const channels = (h) => {
  const s = h.replace('#', '');
  const full = s.length === 3 ? [...s].map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const linear = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const luminance = (hex) => {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function ratio(theme, fg, bg) {
  assert.ok(theme[fg], `--${fg} is not a colour token any more`);
  assert.ok(theme[bg], `--${bg} is not a colour token any more`);
  return contrast(theme[fg], theme[bg]);
}

const atLeast = (theme, fg, bg, min) => {
  const r = ratio(theme, fg, bg);
  assert.ok(r >= min,
    `--${fg} on --${bg} is ${r.toFixed(2)}:1, needs ${min}:1 ` +
    `(${theme[fg]} on ${theme[bg]})`);
};

console.log('\ncontrast — day is the one that gets used in sun');

/* 7:1 is AAA, and it is the floor rather than the goal for anything carrying
 * meaning. Sunlight is not a browser; the standard assumes an office. */
test('body text is far past AAA on every surface it lands on', () => {
  for (const bg of ['bg', 'panel', 'panel-2', 'panel-3']) atLeast(day, 'ink', bg, 7);
});

test('"dim" text is still AAA — outdoors dim must not mean faint', () => {
  for (const bg of ['bg', 'panel', 'panel-2']) atLeast(day, 'ink-dim', bg, 7);
});

/* The one tone allowed below AAA, and the rule that keeps it honest: it is for
 * detail nobody has to read in the field — a timestamp, a hostname, the label
 * over a group. Never a value, never an instruction, never a warning. */
test('the tertiary tone still clears AA on every surface', () => {
  for (const bg of ['bg', 'panel', 'panel-2', 'panel-3']) atLeast(day, 'ink-mute', bg, 4.5);
});

test('the accent carries white, and the warning carries its own ink', () => {
  atLeast(day, 'on-accent', 'accent', 3);      // large/bold text on a solid fill
  atLeast(day, 'warn-ink', 'warn-bg', 7);
});

test('the status colours read against the washes they sit on', () => {
  atLeast(day, 'good', 'good-wash', 4.5);
  atLeast(day, 'danger', 'danger-wash', 4.5);
});

/* A line you cannot see is a box that has come apart. --edge is the one with
 * the satellite imagery behind it, so it is held to a real number rather than
 * to whether it looked fine on white. */
test('the structural line is visible against the surfaces it divides', () => {
  assert.ok(ratio(day, 'edge', 'panel') >= 3,
    `--edge on --panel is ${ratio(day, 'edge', 'panel').toFixed(2)}:1, needs 3:1`);
});

console.log('\ncontrast — night, for caves and dusk');

test('night holds the same floors', () => {
  for (const bg of ['bg', 'panel', 'panel-2']) {
    atLeast(night, 'ink', bg, 7);
    atLeast(night, 'ink-dim', bg, 7);
    atLeast(night, 'ink-mute', bg, 4.5);
  }
  atLeast(night, 'on-accent', 'accent', 3);
  atLeast(night, 'good', 'good-wash', 4.5);
  atLeast(night, 'danger', 'danger-wash', 4.5);
});

/* ── the accents ──────────────────────────────────────────────────────────
 * A colour picker is five more chances to ship an unreadable button, and the
 * one that fails will be the one nobody on the team happens to choose. Every
 * pair in the stylesheet is measured, in both themes, from the stylesheet.
 */
function accentBlocks(nightMode) {
  const out = {};
  const re = nightMode
    ? /:root\[data-theme="night"\]\[data-accent="(\w+)"\]\s*\{([^}]*)\}/g
    : /:root\[data-accent="(\w+)"\]\s*\{([^}]*)\}/g;
  for (const [, name, body] of css.matchAll(re)) out[name] = tokens('{' + body + '}');
  return out;
}

const dayAccents = accentBlocks(false);
const nightAccents = accentBlocks(true);

test('every accent exists in both themes', () => {
  const names = Object.keys(dayAccents);
  assert.ok(names.length >= 5, `only found ${names.length} accents`);
  for (const n of names) {
    assert.ok(nightAccents[n], `${n} has no night pair — it would keep the day colour on a dark panel`);
  }
});

test('every accent carries its own label colour, in both themes', () => {
  for (const [name, t] of Object.entries(dayAccents)) {
    const r = contrast(day['on-accent'], t.accent);
    assert.ok(r >= 3, `day ${name}: label on accent is ${r.toFixed(2)}:1, needs 3:1`);
  }
  for (const [name, t] of Object.entries(nightAccents)) {
    const r = contrast(night['on-accent'], t.accent);
    assert.ok(r >= 3, `night ${name}: label on accent is ${r.toFixed(2)}:1, needs 3:1`);
  }
});

/* The wash is the background of the privacy card, a note being edited and the
 * county proposal. Body text lands on all three. */
test('every accent wash still carries body text', () => {
  for (const [name, t] of Object.entries(dayAccents)) {
    const r = contrast(day.ink, t['accent-wash']);
    assert.ok(r >= 7, `day ${name}: ink on wash is ${r.toFixed(2)}:1, needs 7:1`);
  }
  for (const [name, t] of Object.entries(nightAccents)) {
    const r = contrast(night.ink, t['accent-wash']);
    assert.ok(r >= 7, `night ${name}: ink on wash is ${r.toFixed(2)}:1, needs 7:1`);
  }
});

test('the pressed state is visibly darker than the accent it belongs to', () => {
  for (const [name, t] of Object.entries(dayAccents)) {
    assert.ok(luminance(t['accent-dk']) < luminance(t.accent),
      `day ${name}: accent-dk is not darker than accent`);
  }
});

/* ── glass ────────────────────────────────────────────────────────────────
 * Opt-in, and the number that makes it survivable is the opacity. Worked out
 * against the worst backdrop there is — black satellite imagery at night —
 * because that is the case where a frosted panel stops being a panel.
 */
test('glass is opt-in and stays readable over the worst backdrop', () => {
  const m = css.match(/color-mix\(in srgb, var\(--panel\) (\d+)%, transparent\)/);
  assert.ok(m, 'the glass surface is no longer a color-mix — re-check its opacity');
  const alpha = Number(m[1]) / 100;
  assert.ok(alpha >= 0.65, `glass is ${m[1]}% opaque; below 65% text starts to go`);

  // panel over pure black at that alpha, then body text on the result
  const over = channels(day.panel).map((c) => Math.round(c * alpha));
  const worst = '#' + over.map((c) => c.toString(16).padStart(2, '0')).join('');
  const r = contrast(day.ink, worst);
  assert.ok(r >= 7, `over black backdrop, body text is ${r.toFixed(2)}:1, needs 7:1`);

  assert.doesNotMatch(css, /^:root\s*\{[^}]*backdrop-filter/m,
    'glass must never be on the bare :root — it is a choice, not the default');
});

/* ── the kinds ────────────────────────────────────────────────────────────
 * Eight colours that have to do two jobs at 28px on satellite imagery: stand
 * out from the halo drawn around them, and not be mistakable for each other.
 * Both are measurable, so neither is left to whether it looked fine on the day.
 */
/* Found by looking for the blocks that actually declare --kind-*, rather than
 * by slicing between the first `:root {` and the first night block. That was
 * the obvious way to write it and it was wrong: the night PALETTE appears
 * before the kinds do, so the slice ran backwards and came back empty — and an
 * empty set silently passes a test that loops over it. */
function kindBlocks() {
  const out = { day: {}, night: {} };
  const re = /(:root(?:\[data-theme="night"\])?)\s*\{([^}]*?--kind-[^}]*)\}/g;
  for (const [, selector, body] of css.matchAll(re)) {
    const into = selector.includes('night') ? out.night : out.day;
    for (const [, name, value] of body.matchAll(/--kind-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
      into[name] = value;
    }
  }
  return out;
}

const { day: dayKinds, night: nightKinds } = kindBlocks();

/* Two colours near enough in this measure are the same pin at arm's length.
 * Weighted RGB — cheap, and it tracks perception well enough for a dot. */
function apart(a, b) {
  const [x, y] = [channels(a), channels(b)];
  return Math.sqrt(2 * (x[0] - y[0]) ** 2 + 4 * (x[1] - y[1]) ** 2 + 3 * (x[2] - y[2]) ** 2);
}

test('there is a colour for every kind, in both themes', () => {
  assert.equal(Object.keys(dayKinds).length, 9, 'expected nine day kinds');
  for (const k of Object.keys(dayKinds)) {
    assert.ok(nightKinds[k], `${k} has no night colour and would stay dark-on-dark`);
  }
});

test('every kind stands out from the halo drawn around it', () => {
  assert.ok(Object.keys(dayKinds).length && Object.keys(nightKinds).length,
    'no kind colours were found at all — this test would otherwise pass on nothing');
  for (const [k, v] of Object.entries(dayKinds)) {
    const r = contrast(v, day.halo);
    assert.ok(r >= 3, `day ${k} against the halo is ${r.toFixed(2)}:1, needs 3:1`);
  }
  for (const [k, v] of Object.entries(nightKinds)) {
    const r = contrast(v, night.halo);
    assert.ok(r >= 3, `night ${k} against the halo is ${r.toFixed(2)}:1, needs 3:1`);
  }
});

/* Parking is not a ninth kind and is not tested as one — see the note beside
 * --park in styles.css. It is a square sign rather than a teardrop, and that
 * separates it further than any colour left in the space would. What it still
 * has to do is survive being drawn on satellite imagery, which is the same
 * halo rule as everything else, so that half is not waived. */
test('the parking colour stands out from its halo in both themes', () => {
  const park = {};
  for (const [, selector, body] of css.matchAll(
      /(:root(?:\[data-theme="night"\])?)\s*\{([^}]*?--park:[^}]*)\}/g)) {
    const m = body.match(/--park:\s*(#[0-9a-fA-F]{6})/);
    if (m) park[selector.includes('night') ? 'night' : 'day'] = m[1];
  }
  assert.ok(park.day, 'no --park in the day palette');
  assert.ok(park.night, 'no --park in the night palette — it would be dark on dark');
  for (const [label, theme] of [['day', day], ['night', night]]) {
    const r = contrast(park[label], theme.halo);
    assert.ok(r >= 3, `${label} parking against the halo is ${r.toFixed(2)}:1, needs 3:1`);
  }
});

test('no two kinds are the same pin at a glance', () => {
  for (const [label, set] of [['day', dayKinds], ['night', nightKinds]]) {
    const keys = Object.keys(set);
    assert.ok(keys.length >= 8, `${label}: only ${keys.length} kinds found`);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const d = apart(set[keys[i]], set[keys[j]]);
        assert.ok(d > 90,
          `${label}: ${keys[i]} and ${keys[j]} are only ${d.toFixed(0)} apart, want > 90`);
      }
    }
  }
});

/* Day being the default is a decision someone made outdoors, and it is the kind
 * of thing a later refactor "tidies up". */
test('day is still what a browser with no preference gets', () => {
  const bare = css.slice(0, css.indexOf(':root[data-theme="night"]'));
  assert.match(bare, /:root,\s*\n?:root\[data-theme="day"\]/,
    'bare :root must carry the day palette, not night');
});

console.log(`\n${passed} passed\n`);
