// Builds the public benchmark page from the JSON written by run.mjs and bench.mjs.
// Usage: node scripts/eval/report.mjs <eval.json> <bench.json> [outDir]   (outDir defaults to docs/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from './datasets.mjs';

const [evalPath, benchPath, outArg] = process.argv.slice(2);
if (!evalPath || !benchPath || [evalPath, benchPath, outArg].some((a) => a && a.startsWith('--'))) {
  console.error('usage: node scripts/eval/report.mjs <eval.json> <bench.json> [outDir]');
  process.exit(1);
}
const outDir = outArg || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs');
const evalResult = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
const bench = JSON.parse(fs.readFileSync(benchPath, 'utf8'));

// The page names the code it measured, and both results must come from that same code: the commit, whether
// main.js, library/, scripts/ or package.json had uncommitted changes, and a hash of main.js and library/.
const codeText = (c) => (c.commit ? c.commit.slice(0, 7) : 'no commit') + (c.dirty ? ' with uncommitted changes' : '') +
  ', library ' + String(c.libraryHash).slice(0, 12);
const measured = evalResult.code;
if (!measured || !bench.code) {
  console.error('eval.json or bench.json does not record the code it was made from. Run npm run bench:page again.');
  process.exit(1);
}
if (measured.commit !== bench.code.commit || measured.dirty !== bench.code.dirty || measured.libraryHash !== bench.code.libraryHash) {
  console.error('eval.json and bench.json were made from different code (' + codeText(measured) + '; ' + codeText(bench.code) +
    '). Run npm run bench:page again.');
  process.exit(1);
}

// Only openly licensed data may reach the page. Every row names its sources; each must be a licensed source
// from datasets.mjs, whatever flags the JSON carries.
const licensed = new Set(SOURCES.filter((s) => !s.unlicensed).map((s) => s.id));
const rowSources = evalResult.sections.flatMap((s) => s.rows.map((r) => r.sources));
if (evalResult.withUnlicensed || rowSources.some((ids) => !Array.isArray(ids) || ids.length === 0 || ids.some((id) => !licensed.has(id)))) {
  console.error('These results include data without a license, or rows without a known source. Run eval again without --with-unlicensed.');
  process.exit(1);
}
const sources = SOURCES.filter((s) => rowSources.some((ids) => ids.includes(s.id)));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const code = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const pct = (r) => (r == null ? '—' : r.pct.toFixed(1) + '%');
const num = (n) => esc(Number(n).toLocaleString('en-US'));
const msText = (v, digits) => (v == null ? '—' : esc(v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })) + ' ms');
const E = evalResult.engines;
const D = evalResult.datasets || {};
// Bold marks the best value only where higher is plainly better. A detector can lower the false-positive
// tables just by calling Zawgyi less often, so those get no bold.
const better = { conversion: 'higher', detection: 'higher' };

function bestIndexes(cells, direction, columns) {
  if (!direction) return new Set();
  // Compare like with like: within each variant (exact / NFC) separately.
  const groups = {};
  cells.forEach((c, i) => { if (c) (groups[columns[i].variant || ''] ||= []).push(i); });
  const best = new Set();
  for (const idx of Object.values(groups)) {
    if (idx.length < 2) continue;
    const values = idx.map((i) => cells[i].pct);
    const target = direction === 'higher' ? Math.max(...values) : Math.min(...values);
    idx.forEach((i) => { if (Math.abs(cells[i].pct - target) < 1e-9) best.add(i); });
  }
  return best;
}

function sectionTable(s) {
  const variants = s.columns.some((c) => c.variant);
  const engines = [...new Set(s.columns.map((c) => c.engine))];
  let head;
  let cols = '';
  if (variants) {
    cols = '<colgroup><col><col></colgroup>' + engines.map(() => '<colgroup span="2"></colgroup>').join('');
    head = '<tr><th rowspan="2" scope="col">Data</th><th rowspan="2" scope="col" class="n">n</th>' +
      engines.map((e) => '<th colspan="2" scope="colgroup" class="eng">' + esc(E[e]) + '</th>').join('') + '</tr><tr>' +
      s.columns.map((c) => '<th scope="col" class="num sub">' + esc(c.variant) + '</th>').join('') + '</tr>';
  } else {
    head = '<tr><th scope="col">Data</th><th scope="col" class="n">n</th>' +
      s.columns.map((c) => '<th scope="col" class="num">' + esc(E[c.engine]) + '</th>').join('') + '</tr>';
  }
  const rows = s.rows.map((r) => {
    const best = bestIndexes(r.cells, better[s.id], s.columns);
    return '<tr><th scope="row">' + esc(r.label) + '</th><td class="n">' + num(r.n) + '</td>' +
      r.cells.map((c, i) => '<td class="num' + (best.has(i) ? ' best' : '') + (c == null ? ' na' : '') + '">' + pct(c) + '</td>').join('') + '</tr>';
  }).join('');
  return '<div class="scroll"><table>' + cols + '<thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
}

// Cell indexes follow the column order in run.mjs: per engine (local, baseline, tools, rabbit) two variants.
const find = (id, label) => evalResult.sections.find((s) => s.id === id)?.rows.find((r) => r.label === label);
const roundTrip = find('conversion', 'Wikipedia → Rabbit Zawgyi → back');
const google = find('conversion', 'google/language-resources reference pairs');
const wiki = find('unicode-flagged', 'Burmese Wikipedia sample');
const slowestLong = bench.longInput.slice().sort((a, b) => b.local - a.local)[0];
const tiles = [
  roundTrip && {
    value: pct(roundTrip.cells[0]), label: 'Zawgyi → Unicode round trip, exact',
    detail: E.baseline + ': ' + pct(roundTrip.cells[2]) + ' · ' + E.tools + ': ' + pct(roundTrip.cells[4]) + ' · ' + Number(roundTrip.n).toLocaleString('en-US') + ' Wikipedia lines'
  },
  google && {
    value: pct(google.cells[1]), label: 'Google reference pairs, NFC',
    detail: E.rabbit + ': ' + pct(google.cells[7]) + ' · ' + E.tools + ': ' + pct(google.cells[5]) + ' · ' + google.n + ' pairs'
  },
  wiki && {
    value: pct(wiki.cells[0]), label: 'Wikipedia lines flagged as Zawgyi',
    detail: 'plain fontDetect; on evidence ' + pct(wiki.cells[1]) + ' · ' + E.tools + ': ' + pct(wiki.cells[4]) + ' / ' + pct(wiki.cells[5])
  },
  slowestLong && {
    value: slowestLong.local.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ms', label: 'Slowest long input',
    detail: E.baseline + ': ' + (slowestLong.baseline == null ? 'not run' : slowestLong.baseline.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ms') + ' on the same input'
  }
].filter(Boolean);

function sizeText(id) {
  const lines = (d) => d ? Number(d.unique).toLocaleString('en-US') + ' distinct lines' + (d.lines !== d.unique ? ' (of ' + Number(d.lines).toLocaleString('en-US') + ')' : '') : '';
  switch (id) {
    case 'google': return D.google ? D.google.pairs + ' pairs' : '';
    case 'cldr': return D.cldr ? D.cldr.pairs + ' pairs, ' + D.cldr.notInGoogle + ' not in Google\'s file' : '';
    case 'waitzar': return D.waitzar ? Number(D.waitzar.unique).toLocaleString('en-US') + ' distinct words' : '';
    case 'wikipedia': return D.wikipedia ? Number(D.wikipedia.rows).toLocaleString('en-US') + ' of ' + Number(D.wikipedia.total).toLocaleString('en-US') + ' articles (seed ' + D.wikipedia.seed + '), ' + lines(D.wikipedia) : '';
    case 'glotcc': return ['shn', 'mnw', 'ksw', 'blk'].filter((k) => D[k]).map((k) => k + ' ' + D[k].rows + ' documents').join(', ');
    default: return lines(D[id]);
  }
}

const realRows = bench.realText.rows.map((r) =>
  '<tr><th scope="row">' + esc(r.task) + '</th><td class="num">' + msText(r.local, 1) + '</td><td class="num">' + msText(r.baseline, 1) +
  '</td><td class="num">' + (r.baseline ? esc((r.local / r.baseline).toFixed(2)) + '×' : '—') + '</td></tr>').join('');
const longRows = bench.longInput.map((r) =>
  '<tr><th scope="row">' + esc(r.input) + '</th><td class="num">' + msText(r.local, 0) + '</td><td class="num">' + msText(r.baseline, 0) + '</td></tr>').join('');
const sourceRows = sources.map((s) =>
  '<tr><th scope="row"><a href="' + esc(s.url) + '">' + esc(s.title) + '</a></th><td>' + esc(s.use) + '</td><td>' + esc(sizeText(s.id)) + '</td><td>' +
  (s.licenseUrl ? '<a href="' + esc(s.licenseUrl) + '">' + esc(s.license) + '</a>' : esc(s.license)) + '</td></tr>').join('');
const date = String(evalResult.generatedAt).slice(0, 10);
const sweep = bench.sweep;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>knayi Benchmark</title>
<meta name="description" content="Accuracy and speed of knayi-myscript on public Zawgyi and Unicode Burmese data, next to myanmar-tools and Rabbit.">
<style>
:root {
  --bg: #fbfaf7; --surface: #ffffff; --text: #1d2420; --muted: #5d6a63; --line: #e3e6e1;
  --accent: #16452d; --accent-soft: #e6f0ea; --best: #0f5f39; --code: #f1f3ef;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #111513; --surface: #181d1a; --text: #e7ece9; --muted: #9aa8a0; --line: #2a322e;
    --accent: #8fd1ad; --accent-soft: #1d2b24; --best: #9ee3bd; --code: #222a26;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #111513; --surface: #181d1a; --text: #e7ece9; --muted: #9aa8a0; --line: #2a322e;
  --accent: #8fd1ad; --accent-soft: #1d2b24; --best: #9ee3bd; --code: #222a26;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Myanmar", "Myanmar Text", Padauk, sans-serif;
}
main { max-width: 980px; margin: 0 auto; padding: 40px 16px 64px; }
header p { margin: 4px 0; }
h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 8px; color: var(--accent); }
h2 { font-size: 1.3rem; margin: 48px 0 8px; }
h3 { font-size: 1.05rem; margin: 28px 0 8px; }
a { color: var(--accent); }
.meta { color: var(--muted); font-size: .92rem; }
.note { color: var(--muted); font-size: .92rem; margin: 0 0 12px; max-width: 70ch; }
ul.note { padding-left: 1.2em; }
ul.note li { margin: 4px 0; }
code { background: var(--code); padding: 1px 5px; border-radius: 4px; font-size: .88em; }
pre { background: var(--code); padding: 12px 14px; border-radius: 8px; overflow-x: auto; font-size: .88rem; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 28px 0 8px; }
.tile { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
.tile .value { font-size: 1.8rem; font-weight: 650; color: var(--accent); font-variant-numeric: tabular-nums; line-height: 1.2; }
.tile .label { font-weight: 600; margin-top: 4px; }
.tile .detail { color: var(--muted); font-size: .85rem; }
.scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: .92rem; }
th, td { padding: 8px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
thead th { font-weight: 600; background: var(--accent-soft); white-space: nowrap; }
th.eng { text-align: center; }
.num, .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sub { font-weight: 500; color: var(--muted); }
td.best { color: var(--best); font-weight: 700; }
td.na { color: var(--muted); }
tbody th { font-weight: 500; min-width: 12em; }
footer { margin-top: 56px; color: var(--muted); font-size: .88rem; border-top: 1px solid var(--line); padding-top: 16px; }
</style>
</head>
<body>
<main>
<header>
<p class="meta"><a href="./">knayi-myscript</a> · <a href="https://github.com/greenlikeorange/knayi-myscript">GitHub</a></p>
<h1>Benchmark</h1>
<p>How ${esc(E.local)} converts and detects Burmese text on public Zawgyi and Unicode data, next to ${esc(E.baseline)}, ${esc(E.tools)} and ${esc(E.rabbit)}.</p>
<p class="meta">Run on ${esc(date)} · commit ${measured.commit ? '<a href="https://github.com/greenlikeorange/knayi-myscript/commit/' + esc(measured.commit) + '"><code>' + esc(measured.commit.slice(0, 7)) + '</code></a>' : 'unknown'}${measured.dirty ? ' with uncommitted changes' : ''} · ${esc(bench.machine)} · Node ${esc(bench.node)} · every data set has an open license (see <a href="#sources">sources</a>) · see <a href="#limits">limits</a></p>
</header>

<section class="tiles" aria-label="Highlights">
${tiles.map((t) => '<div class="tile"><div class="value">' + esc(t.value) + '</div><div class="label">' + esc(t.label) + '</div><div class="detail">' + esc(t.detail) + '</div></div>').join('\n')}
</section>

<h2>Accuracy</h2>
<p class="note">In the conversion and detection tables, the best value in each row is in bold. The tables of text flagged as Zawgyi have no bold: a detector can lower them just by calling Zawgyi less often, so read them next to the detection table. Every set is measured on its distinct lines.</p>
${evalResult.sections.map((s) => '<h3 id="' + esc(s.id) + '">' + esc(s.title) + '</h3>\n<p class="note">' + code(s.note) + '</p>\n' + sectionTable(s)).join('\n')}

<h2 id="speed">Speed</h2>
<h3>Real text</h3>
<p class="note">${num(bench.realText.lines)} distinct lines of FLORES-200 and Wikipedia, and their Zawgyi form made by Rabbit. Mean of 10 runs after 3 warm-ups. Timings depend on the machine, so compare the ratio: below 1 means ${esc(E.local)} is faster.</p>
<div class="scroll"><table><thead><tr><th scope="col">Task</th><th scope="col" class="num">${esc(E.local)}</th><th scope="col" class="num">${esc(E.baseline)}</th><th scope="col" class="num">ratio</th></tr></thead><tbody>${realRows}</tbody></table></div>
<h3>Long input</h3>
<p class="note">Inputs that took quadratic time before 2.9.1. One run each.</p>
<div class="scroll"><table><thead><tr><th scope="col">Input</th><th scope="col" class="num">${esc(E.local)}</th><th scope="col" class="num">${esc(E.baseline)}</th></tr></thead><tbody>${longRows}</tbody></table></div>
${sweep ? '<p class="note">Sweep of ' + num(sweep.inputs) + ' long inputs: every Myanmar code point repeated 30,000 times, every ordered pair of ' +
  num(sweep.marks) + ' marks repeated 10,000 times, and three base letters each followed by every mark, through 8 call forms. ' +
  num(sweep.runs) + ' runs, slowest ' + msText(sweep.slowest, 0) + ', ' + num(sweep.slow.length) + ' over ' + msText(sweep.limit, 0) + '.</p>' : ''}

<h2 id="limits">Limits</h2>
<ul class="note">
<li>The reference pairs are few, and both sets come from Google's i18n work. CLDR's expected output follows ICU, the converter myanmar-tools ships, and in at least one pair it expects ICU's own ordering of asat before tall aa.</li>
<li>Exact match counts canonically equivalent spellings as different; the NFC column does not.</li>
<li>The round trip uses Rabbit to make the Zawgyi input, so Rabbit is not scored on it.</li>
<li>The Unicode sets contain a few lines of real Zawgyi text, so their labels are slightly noisy.</li>
<li>The Wikipedia and GlotCC rows come from the current revision of those datasets; the Wikipedia rows are 25 random blocks picked with a fixed seed.</li>
<li>Timings are from one machine. Compare ratios, not absolute times.</li>
</ul>

<h2 id="sources">Sources and licenses</h2>
<p class="note">The data is downloaded when the benchmark runs and is not copied into this repository. Every download must match a pinned sha256; GitHub files are also pinned to a commit, mC4 to a revision and Okell to a Zenodo record. Only aggregate numbers are published here.</p>
<div class="scroll"><table><thead><tr><th scope="col">Data</th><th scope="col">Used for</th><th scope="col">Size</th><th scope="col">License</th></tr></thead><tbody>${sourceRows}</tbody></table></div>

<h2 id="reproduce">Reproduce</h2>
<pre>npm run bench:page</pre>
<p class="note">That runs <code>npm run eval</code> and <code>npm run bench -- --sweep</code> and rebuilds this page. Raw results: <a href="benchmark.json">benchmark.json</a>. Method: <a href="https://github.com/greenlikeorange/knayi-myscript/blob/main/scripts/eval/README.md">scripts/eval/README.md</a>.</p>

<footer>Generated by scripts/eval/report.mjs on ${esc(evalResult.generatedAt)} from ${esc(codeText(measured))} (sha256 of main.js and library/: ${esc(measured.libraryHash)}).</footer>
</main>
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'benchmark.html'), html);
fs.writeFileSync(path.join(outDir, 'benchmark.json'), JSON.stringify({ code: measured, eval: evalResult, bench }, null, 2) + '\n');
console.error('wrote ' + path.join(outDir, 'benchmark.html') + ' and benchmark.json');
