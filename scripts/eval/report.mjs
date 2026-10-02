// Builds the public benchmark page from the JSON written by run.mjs and bench.mjs.
// Usage: node scripts/eval/report.mjs <eval.json> <bench.json> [outDir]   (outDir defaults to docs/)
import fs from 'node:fs';
import path from 'node:path';

const [evalPath, benchPath, outArg] = process.argv.slice(2);
if (!evalPath || !benchPath) {
  console.error('usage: node scripts/eval/report.mjs <eval.json> <bench.json> [outDir]');
  process.exit(1);
}
const outDir = outArg || path.join(import.meta.dirname, '..', '..', 'docs');
const evalResult = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
const bench = JSON.parse(fs.readFileSync(benchPath, 'utf8'));

if (evalResult.withUnlicensed || evalResult.sources.some((s) => s.unlicensed)) {
  console.error('These results include data without a license (--with-unlicensed). Run eval again without it before publishing.');
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const code = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const pct = (r) => (r == null ? '—' : r.pct.toFixed(1) + '%');
const num = (n) => n.toLocaleString('en-US');
const msText = (v, digits) => (v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + ' ms');
const E = evalResult.engines;
const better = { conversion: 'higher', detection: 'higher', 'unicode-flagged': 'lower', 'other-languages': 'lower' };

function bestIndexes(cells, direction, columns) {
  if (!direction) return new Set();
  // Compare like with like: within each variant (default / evidence) separately.
  const groups = {};
  cells.forEach((c, i) => { if (c) (groups[columns[i].variant || ''] ||= []).push(i); });
  const best = new Set();
  for (const idx of Object.values(groups)) {
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
  if (variants) {
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
  return '<div class="scroll"><table><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
}

const find = (id, label) => evalResult.sections.find((s) => s.id === id)?.rows.find((r) => r.label === label);
const roundTrip = find('conversion', 'Wikipedia → Rabbit Zawgyi → back');
const flores = find('unicode-flagged', 'FLORES-200 mya_Mymr');
const agree = find('web-text', 'Agrees with myanmar-tools');
const worstLong = bench.longInput.filter((r) => r.baseline != null).sort((a, b) => b.baseline - a.baseline)[0];
const tiles = [
  roundTrip && { value: pct(roundTrip.cells[0]), label: 'Zawgyi → Unicode round trip, exact', detail: E.baseline + ': ' + pct(roundTrip.cells[1]) + ' · ' + num(roundTrip.n) + ' Wikipedia lines' },
  flores && { value: pct(flores.cells[0]), label: 'FLORES-200 Unicode flagged as Zawgyi', detail: num(flores.n) + ' sentences, plain fontDetect' },
  worstLong && { value: msText(worstLong.local, 0), label: 'Worst-case long input', detail: E.baseline + ': ' + msText(worstLong.baseline, 0) + ' on the same input' },
  agree && { value: pct(agree.cells[0]), label: 'Agrees with myanmar-tools on web text', detail: num(agree.n) + ' mC4 lines where it is confident' }
].filter(Boolean);

const realRows = bench.realText.rows.map((r) =>
  '<tr><th scope="row">' + esc(r.task) + '</th><td class="num">' + msText(r.local, 1) + '</td><td class="num">' + msText(r.baseline, 1) +
  '</td><td class="num">' + (r.local / r.baseline).toFixed(2) + '×</td></tr>').join('');
const longRows = bench.longInput.map((r) =>
  '<tr><th scope="row">' + esc(r.input) + '</th><td class="num">' + msText(r.local, 0) + '</td><td class="num">' + msText(r.baseline, 0) + '</td></tr>').join('');
const sourceRows = evalResult.sources.map((s) =>
  '<tr><th scope="row"><a href="' + esc(s.url) + '">' + esc(s.title) + '</a></th><td>' + esc(s.use) + '</td><td>' +
  (s.licenseUrl ? '<a href="' + esc(s.licenseUrl) + '">' + esc(s.license) + '</a>' : esc(s.license)) + '</td></tr>').join('');
const date = evalResult.generatedAt.slice(0, 10);

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
<p class="meta">Run on ${esc(date)} · ${esc(bench.machine)} · Node ${esc(bench.node)} · every data set has an open license (see <a href="#sources">sources</a>)</p>
</header>

<section class="tiles" aria-label="Highlights">
${tiles.map((t) => '<div class="tile"><div class="value">' + esc(t.value) + '</div><div class="label">' + esc(t.label) + '</div><div class="detail">' + esc(t.detail) + '</div></div>').join('\n')}
</section>

<h2>Accuracy</h2>
<p class="note">The best value in each row is in bold. Some rows favour myanmar-tools, because their expected outputs came from Google's own tools; the note under each heading says which.</p>
${evalResult.sections.map((s) => '<h3 id="' + esc(s.id) + '">' + esc(s.title) + '</h3>\n<p class="note">' + code(s.note) + '</p>\n' + sectionTable(s)).join('\n')}

<h2 id="speed">Speed</h2>
<h3>Real text</h3>
<p class="note">${num(bench.realText.lines)} lines of FLORES-200 and Wikipedia, and their Zawgyi form made by Rabbit. Mean of 10 runs after 3 warm-ups. A ratio below 1 means ${esc(E.local)} is faster.</p>
<div class="scroll"><table><thead><tr><th scope="col">Task</th><th scope="col" class="num">${esc(E.local)}</th><th scope="col" class="num">${esc(E.baseline)}</th><th scope="col" class="num">ratio</th></tr></thead><tbody>${realRows}</tbody></table></div>
<h3>Long input</h3>
<p class="note">Inputs that took quadratic time before 2.9.1. One run each.</p>
<div class="scroll"><table><thead><tr><th scope="col">Input</th><th scope="col" class="num">${esc(E.local)}</th><th scope="col" class="num">${esc(E.baseline)}</th></tr></thead><tbody>${longRows}</tbody></table></div>
${bench.sweep ? '<p class="note">Sweep: every Myanmar code point repeated 30,000 times and every pair of marks repeated 10,000 times, through every call form. ' +
  num(bench.sweep.runs) + ' runs, slowest ' + bench.sweep.slowest.toFixed(0) + ' ms, ' + bench.sweep.slow.length + ' over ' + bench.sweep.limit + ' ms.</p>' : ''}

<h2 id="sources">Sources and licenses</h2>
<p class="note">The data is downloaded when the benchmark runs and is not copied into this repository. GitHub files are pinned to a commit, mC4 to a revision, and every download to a sha256. Only aggregate numbers are published here.</p>
<div class="scroll"><table><thead><tr><th scope="col">Data</th><th scope="col">Used for</th><th scope="col">License</th></tr></thead><tbody>${sourceRows}</tbody></table></div>

<h2 id="reproduce">Reproduce</h2>
<pre>npm run eval -- --json eval.json
npm run bench -- --sweep --json bench.json
node scripts/eval/report.mjs eval.json bench.json</pre>
<p class="note">Raw results: <a href="benchmark.json">benchmark.json</a>. Method and caveats: <a href="https://github.com/greenlikeorange/knayi-myscript/blob/master/scripts/eval/README.md">scripts/eval/README.md</a>.</p>

<footer>Generated by scripts/eval/report.mjs on ${esc(evalResult.generatedAt)}.</footer>
</main>
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'benchmark.html'), html);
fs.writeFileSync(path.join(outDir, 'benchmark.json'), JSON.stringify({ eval: evalResult, bench }, null, 2) + '\n');
console.error('wrote ' + path.join(outDir, 'benchmark.html') + ' and benchmark.json');
