// Draws knayi's Win -> Unicode table for review: each Win glyph in a Win font next to the Unicode text it
// converts to, in a Unicode Myanmar font, on the same base consonant. Each pair should look the same.
//
//   node scripts/eval/win-glyphs.mjs path/to/WININNWA.TTF [--out file.html]
//
// The Win fonts are freeware with all rights reserved, so the font is not in the repository; use a
// copy you have. The page embeds it and is written to .eval-cache/ (ignored by git) by default. The
// Unicode side uses Noto Sans Myanmar from Google Fonts, or a Myanmar font installed on the machine.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { tables } = require('../../library/win.js');
const { BASE, PRE, MARK, STACK, KINZI } = tables.ROLES;

const args = process.argv.slice(2);
const winFont = args.find((a) => !a.startsWith('--'));
const outArg = args.indexOf('--out');
const out = outArg >= 0 ? args[outArg + 1] : path.join(ROOT, '.eval-cache', 'win-glyphs.html');
if (!winFont) {
  console.error('usage: node scripts/eval/win-glyphs.mjs path/to/WININNWA.TTF [--out file.html]');
  process.exit(1);
}

const KA = String.fromCodePoint(0x1000);
const hex = (s) => [...s].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cell(label, winText, unicodeText) {
  return `<div class="cell"><div class="label">${esc(label)}</div><div class="pair">` +
    `<span class="win">${esc(winText)}</span><span class="uni">${esc(unicodeText) || '&#8203;'}</span></div></div>`;
}

const cells = [];
for (const [win, [role, text, extra = '']] of Object.entries(tables.WIN)) {
  const code = win.codePointAt(0);
  if (code >= 0x80 && code < 0xA0) continue; // ISO-8859-1 aliases of the Windows-1252 entries
  const label = `${hex(win)} ${win} ${role} → ${text || extra ? hex(text + extra) : '(dropped)'}`;
  if (role === PRE) cells.push(cell(label, win + 'u', KA + text));
  else if (role === MARK || role === STACK) cells.push(cell(label, 'u' + win, KA + text + extra));
  else if (role === KINZI) cells.push(cell(label, 'u' + win, text + KA + extra));
  else cells.push(cell(label, win, text + extra));
}
const SEQUENCE_SAMPLES = ['aMomf', 'Mo', 'ps', 'OD'];
for (const sample of SEQUENCE_SAMPLES) {
  const rule = tables.SEQUENCES.find(([pattern]) => new RegExp(pattern.source).test(sample));
  if (rule) cells.push(cell(`${sample} sequence → ${hex(rule[1])}`, sample, rule[1]));
}

const font = fs.readFileSync(winFont).toString('base64');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>knayi Win glyph table</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar&display=swap">
<style>
@font-face { font-family: 'WinGlyphs'; src: url(data:font/ttf;base64,${font}) format('truetype'); }
body { margin: 16px; font: 13px system-ui, sans-serif; color: #111; background: #fff; }
p { max-width: 70ch; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; }
.cell { border: 1px solid #ccc; border-radius: 6px; padding: 4px; text-align: center; }
.label { font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pair { display: flex; justify-content: space-around; align-items: center; min-height: 84px; }
.win { font-family: 'WinGlyphs'; font-size: 44px; color: #1a4fb5; white-space: nowrap; }
.uni { font-family: 'Noto Sans Myanmar', 'Myanmar MN', 'Myanmar Text', Padauk, sans-serif; font-size: 30px; line-height: 2; color: #b5301a; white-space: nowrap; }
</style></head><body>
<h1>knayi Win → Unicode glyph table</h1>
<p>Blue: the Win font, with marks on <code>u</code> (က). Red: the Unicode text knayi converts it to, with marks on U+1000, in a Unicode font. Each pair should show the same letters; the two fonts differ in style. ${cells.length} entries from library/win.js.</p>
<div class="grid">${cells.join('')}</div></body></html>`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${cells.length} entries)`);
