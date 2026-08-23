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
const channels = (h) => {
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

/* Day being the default is a decision someone made outdoors, and it is the kind
 * of thing a later refactor "tidies up". */
test('day is still what a browser with no preference gets', () => {
  const bare = css.slice(0, css.indexOf(':root[data-theme="night"]'));
  assert.match(bare, /:root,\s*\n?:root\[data-theme="day"\]/,
    'bare :root must carry the day palette, not night');
});

console.log(`\n${passed} passed\n`);
