// Renders sample.md with kinari through Marp CLI.
//
//   node scripts/render.mjs             HTML and PDF of both sides, and a 4:3 PDF, into out/
//   node scripts/render.mjs --preview   the two contact sheets in images/ (needs ImageMagick's `montage`)
//
// Marp CLI's pages set no `color-scheme`, so a deck draws kinari's light side there. The dark side is drawn by
// appending a global <style> that sets one, which is what a reader of a Marp CLI deck does to get it too.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARP_CLI = '@marp-team/marp-cli@4.5.1';
const OUT = 'out';
const preview = process.argv.includes('--preview');

const sample = readFileSync('sample.md', 'utf8');
const variants = {
  light: sample,
  dark: `${sample}\n<style>\nsection { color-scheme: dark; }\n</style>\n`,
};

function marp(input, ...args) {
  execFileSync('pnpm', ['dlx', MARP_CLI, '--theme', 'kinari.css', input, ...args], {
    stdio: 'inherit',
  });
}

mkdirSync(OUT, { recursive: true });
for (const [side, text] of Object.entries(variants)) {
  writeFileSync(join(OUT, `sample-${side}.md`), text);
}

if (preview) {
  for (const side of Object.keys(variants)) {
    const dir = join(OUT, `png-${side}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir);
    marp(join(OUT, `sample-${side}.md`), '--images', 'png', '-o', join(dir, 'slide.png'));
    const slides = readdirSync(dir)
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => join(dir, f));
    execFileSync(
      'montage',
      [
        ...slides,
        '-geometry',
        '640x360+8+8',
        '-tile',
        '2x',
        '-background',
        side === 'dark' ? '#111111' : '#cccccc',
        join('images', `preview-${side}.png`),
      ],
      { stdio: 'inherit' },
    );
  }
} else {
  for (const side of Object.keys(variants)) {
    const input = join(OUT, `sample-${side}.md`);
    marp(input, '-o', join(OUT, `sample-${side}.html`));
    marp(input, '--pdf', '-o', join(OUT, `sample-${side}.pdf`));
  }
  const fourThree = join(OUT, 'sample-4x3.md');
  writeFileSync(fourThree, sample.replace(/^---\n/, '---\nsize: 4:3\n'));
  marp(fourThree, '--pdf', '-o', join(OUT, 'sample-4x3.pdf'));
}
