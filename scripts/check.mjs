// Checks kinari.css against what a release promises, and prints the contrast of each text colour on its ground.
//
//   node scripts/check.mjs kinari.css
//
// What it holds the file to is what mallow takes from a release (mallow decision-19 §7), plus the one rule this
// theme sets itself: each colour is written once per side and paired in three places.
//
// It reads the CSS with a small brace matcher rather than a CSS parser, so the repository has no dependency to
// install. That is enough for a file this repository writes; it is not a general CSS reader.

import { readFileSync } from 'node:fs';

const ALLOWED_AT_RULES = new Set(['media', 'supports', 'container']);
const FALLBACK_PRELUDE = 'not (color: light-dark(#000, #fff))';
const REQUIRED_SIZES = { '16:9': ['1280px', '720px'], '4:3': ['960px', '720px'] };

const file = process.argv[2] ?? 'kinari.css';
const source = readFileSync(file, 'utf8');
const failures = [];
const fail = (message) => failures.push(message);

// ---- Meta comments

const comments = [...source.matchAll(/\/\*([\s\S]*?)\*\//g)].map((m) => m[1].trim());
const meta = (key) =>
  comments.flatMap((c) => {
    const m = c.match(new RegExp(`^@${key}\\s+(.+)$`));
    return m ? [m[1].trim()] : [];
  });

if (!meta('theme').includes('kinari')) {
  fail('no `@theme kinari` comment');
}

const sizes = Object.fromEntries(
  meta('size').map((v) => {
    const [name, ...dims] = v.split(/\s+/);
    return [name, dims];
  }),
);
for (const [name, dims] of Object.entries(REQUIRED_SIZES)) {
  if (sizes[name]?.join(' ') !== dims.join(' ')) {
    fail(`@size ${name} must be ${dims.join(' ')}, found ${sizes[name]?.join(' ') ?? 'none'}`);
  }
}

const stamp = source.split('\n', 1)[0].match(/^\/\* kinari (\d+\.\d+\.\d+) — /);
const pkgVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
if (!stamp) {
  fail('the first line must be the stamp `/* kinari <version> — …`');
} else if (stamp[1] !== pkgVersion) {
  fail(`the stamp says ${stamp[1]} but package.json says ${pkgVersion}`);
}

// ---- Rules

// Comments, strings and url() contents are blanked to spaces of the same length, so a brace or an `@` inside them
// is not read as structure while offsets still line up with the source.
const blank = (s) => s.replace(/[^\n]/g, ' ');
const masked = source
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, (m) => `url(${blank(m.slice(4, -1))})`)
  .replace(/"[^"\n]*"|'[^'\n]*'/g, (m) => `"${blank(m.slice(1, -1))}"`);

function parseBlock(text, start, end, parent) {
  const rules = [];
  let i = start;
  while (i < end) {
    let open = text.indexOf('{', i);
    const semi = text.indexOf(';', i);
    if (open === -1 || open >= end) {
      open = end;
    }
    if (semi !== -1 && semi < open && text.slice(i, semi).trim().startsWith('@')) {
      rules.push({ prelude: text.slice(i, semi).trim(), statement: true, parent });
      i = semi + 1;
      continue;
    }
    if (open === end) {
      break;
    }
    let depth = 1;
    let j = open + 1;
    while (depth > 0 && j < end) {
      if (text[j] === '{') {
        depth++;
      } else if (text[j] === '}') {
        depth--;
      }
      j++;
    }
    const prelude = text.slice(i, open).trim();
    const rule = { prelude, parent, bodyStart: open + 1, bodyEnd: j - 1 };
    if (prelude.startsWith('@')) {
      rule.children = parseBlock(text, open + 1, j - 1, rule);
    }
    rules.push(rule);
    i = j;
  }
  return rules;
}

const rules = parseBlock(masked, 0, masked.length, null);
const walk = (list) => list.flatMap((r) => [r, ...(r.children ? walk(r.children) : [])]);
const allRules = walk(rules);

for (const r of allRules.filter((r) => r.prelude.startsWith('@'))) {
  const name = r.prelude.slice(1).split(/[\s(]/, 1)[0];
  if (!ALLOWED_AT_RULES.has(name)) {
    fail(`at-rule @${name} is not allowed (only @media, @supports and @container survive a deck CSS walk)`);
  }
}

const declarations = (r) =>
  source
    .slice(r.bodyStart, r.bodyEnd)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const colon = d.indexOf(':');
      return [d.slice(0, colon).trim(), d.slice(colon + 1).trim()];
    });

const topLevel = (prelude) => rules.find((r) => r.prelude === prelude && !r.children);
const fallback = rules.find((r) => r.prelude === `@supports ${FALLBACK_PRELUDE}`);
const inFallback = (prelude) => fallback?.children.find((r) => r.prelude === prelude);

const slide = topLevel('section');
const invert = topLevel('section.invert');
if (!slide || !invert) {
  fail('top-level `section` and `section.invert` rules are required');
}
if (!fallback) {
  fail(`no \`@supports ${FALLBACK_PRELUDE}\` block`);
}

// ---- The pairing

const slideDecls = slide ? declarations(slide) : [];
const sides = { light: new Map(), dark: new Map() };
for (const [prop, value] of slideDecls) {
  const m = prop.match(/^--kinari-(light|dark)-(.+)$/);
  if (m) {
    sides[m[1]].set(m[2], value);
  }
}
const tokens = [...new Set([...sides.light.keys(), ...sides.dark.keys()])].sort();
for (const t of tokens) {
  for (const side of ['light', 'dark']) {
    if (!sides[side].has(t)) {
      fail(`--kinari-${t} has no ${side} side`);
    }
  }
}

const pair = (a, b, t) => `light-dark(var(--kinari-${a}-${t}), var(--kinari-${b}-${t}))`;
function expectMapping(rule, label, valueOf) {
  if (!rule) {
    fail(`${label}: missing`);
    return;
  }
  const found = new Map(declarations(rule).filter(([p]) => /^--kinari-/.test(p) && !/^--kinari-(light|dark)-/.test(p)));
  for (const t of tokens) {
    const want = valueOf(t);
    const got = found.get(`--kinari-${t}`);
    if (got !== want) {
      fail(`${label}: --kinari-${t} should be \`${want}\`, found \`${got ?? 'nothing'}\``);
    }
    found.delete(`--kinari-${t}`);
  }
  for (const extra of found.keys()) {
    fail(`${label}: ${extra} has no --kinari-light-* / --kinari-dark-* source`);
  }
}
expectMapping(slide, 'section', (t) => pair('light', 'dark', t));
expectMapping(invert, 'section.invert', (t) => pair('dark', 'light', t));
expectMapping(inFallback('section'), 'fallback section', (t) => `var(--kinari-light-${t})`);
expectMapping(inFallback('section.invert'), 'fallback section.invert', (t) => `var(--kinari-dark-${t})`);

// ---- No colour outside the two sides

const literalColour = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i;
for (const r of allRules.filter((r) => !r.children && !r.statement)) {
  for (const [prop, value] of declarations(r)) {
    if (/^--kinari-(light|dark)-/.test(prop)) {
      continue;
    }
    const withoutUrls = value.replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, 'url()');
    if (literalColour.test(withoutUrls)) {
      fail(`${r.prelude} { ${prop} } writes a colour literally; give it a --kinari-light-* / --kinari-dark-* pair`);
    }
  }
}

// ---- Contrast (reported, not judged)

function parseColour(v) {
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = Number.parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  m = v.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)$/);
  if (m) {
    return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  }
  return null;
}
const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
const luminance = ([r, g, b]) =>
  [r, g, b]
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const report = [
  ['paper', ['ink', 'heading', 'accent', 'muted']],
  ['code-ground', ['code-text', 'code-comment', 'code-keyword', 'code-string', 'code-number', 'code-title', 'code-type', 'code-attr']],
];
if (failures.length === 0) {
  console.log('Contrast against the flat ground (the paper texture shifts it slightly):');
  for (const side of ['light', 'dark']) {
    console.log(`  ${side}`);
    for (const [ground, inks] of report) {
      const g = parseColour(sides[side].get(ground));
      for (const ink of inks) {
        const c = parseColour(sides[side].get(ink));
        const ratio = contrast(over(c, g), g);
        const mark = ratio >= 4.5 ? '' : ratio >= 3 ? '  (below 4.5)' : '  (below 3)';
        console.log(`    ${ink.padEnd(13)} on ${ground.padEnd(11)} ${ratio.toFixed(2)}${mark}`);
      }
    }
  }
}

if (failures.length > 0) {
  for (const f of failures) {
    console.error(`✗ ${f}`);
  }
  process.exit(1);
}
console.log(`✓ ${file}: ${tokens.length} colour pairs, sizes ${Object.keys(REQUIRED_SIZES).join(' / ')}, fallback present`);
