// Accuracy of knayi on public Zawgyi/Unicode data, next to a published baseline, myanmar-tools, and Rabbit.
// Usage: node scripts/eval/run.mjs [--json results.json]
import fs from 'node:fs';
import { loadAll } from './datasets.mjs';
import { loadEngines } from './engines.mjs';

const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

const data = await loadAll();
const E = loadEngines();
const detectors = [E.local, E.baseline, E.tools];
const converters = [E.local, E.baseline, E.tools, E.rabbit];

const results = [];
const rate = (hits, n) => ({ hits, n, pct: n ? (100 * hits) / n : 0 });
const fmt = (r) => (r == null ? '' : r.pct.toFixed(1) + '%');

function section(title, note, columns, rows) {
  console.log('\n## ' + title + '\n');
  if (note) console.log(note + '\n');
  console.log('| Data | n | ' + columns.map((c) => c.name).join(' | ') + ' |');
  console.log('| --- | ---: | ' + columns.map(() => '---:').join(' | ') + ' |');
  for (const row of rows) {
    console.log('| ' + row.label + ' | ' + row.n.toLocaleString('en-US') + ' | ' + row.cells.map(fmt).join(' | ') + ' |');
    results.push({ section: title, data: row.label, n: row.n, results: Object.fromEntries(columns.map((c, i) => [c.name, row.cells[i]])) });
  }
}

const count = (xs, ok) => xs.reduce((sum, x, i) => sum + (ok(x, i) ? 1 : 0), 0);

// Conversion: exact match against an expected Unicode string.
const pairsRow = (label, pairs, engines) => ({
  label,
  n: pairs.length,
  cells: engines.map((e) => rate(count(pairs, ([z, u]) => e.toUnicode(z) === u), pairs.length))
});
const roundTrip = data.wikipedia.map((u) => [E.rabbit.toZawgyi(u), u]).filter(([z, u]) => z !== u);
const roundTripRow = pairsRow('Wikipedia → Rabbit Zawgyi → back', roundTrip, converters.slice(0, 3));
roundTripRow.cells.push(null);
section('Conversion: Zawgyi → Unicode, exact match', [
  'Gold pairs are hand-checked; CLDR follows ICU, the converter myanmar-tools ships, so myanmar-tools has a home advantage there.',
  'The round trip turns Wikipedia lines into Zawgyi with Rabbit and converts them back; Rabbit is left out because it made the input.'
].join(' '), converters, [
  pairsRow('google/language-resources gold', data.google, converters),
  pairsRow('CLDR test data', data.cldr, converters),
  roundTripRow
]);

// Detection of real text with a known encoding.
const detectRow = (label, texts, truth, fallback) => ({
  label,
  n: texts.length,
  cells: detectors.map((e) => rate(count(texts, (t) => e.detect(t, fallback) === truth), texts.length))
});
const zawgyiQueries = data.queries.filter((q) => q.label === 'zawgyi').map((q) => q.text);
const unicodeQueries = data.queries.filter((q) => q.label === 'unicode').map((q) => q.text);
section('Detection: real text recognised correctly', [
  'Query labels come from myanmar-tools (rows where its C++ and JS detectors agree), so it has a home advantage on those rows.',
  'WaitZar words use fallback `unicode`, so a word only counts when the detector finds real Zawgyi evidence.'
].join(' '), detectors, [
  detectRow('2018 search queries, Zawgyi', zawgyiQueries, 'zawgyi'),
  detectRow('2018 search queries, Unicode', unicodeQueries, 'unicode'),
  detectRow('WaitZar hand-typed Zawgyi words', data.waitzar, 'zawgyi', 'unicode')
]);

// Unicode text wrongly flagged as Zawgyi: with the default fallback, and on evidence only.
const flaggedColumns = detectors.flatMap((e) => [{ name: e.name + ' default' }, { name: e.name + ' evidence' }]);
const flaggedRow = (label, texts) => ({
  label,
  n: texts.length,
  cells: detectors.flatMap((e) => [
    rate(count(texts, (t) => e.detect(t) === 'zawgyi'), texts.length),
    rate(count(texts, (t) => e.detect(t, 'unicode') === 'zawgyi'), texts.length)
  ])
});
const flaggedNote = '"default" is a plain `fontDetect(text)`, where a tie falls back to `zawgyi`. "evidence" uses fallback `unicode`, so only real Zawgyi evidence counts. Lower is better.';
section('Unicode flagged as Zawgyi', flaggedNote, flaggedColumns, [
  flaggedRow('FLORES-200 mya_Mymr', data.flores),
  flaggedRow('Burmese Wikipedia sample', data.wikipedia),
  flaggedRow('Okell corpus', data.okell)
]);
section('Other Myanmar-script languages flagged as Zawgyi', flaggedNote, flaggedColumns, [
  flaggedRow('Shan (GlotCC shn-Mymr)', data.other.shn),
  flaggedRow('Mon (GlotCC mnw-Mymr)', data.other.mnw),
  flaggedRow("S'gaw Karen (GlotCC ksw-Mymr)", data.other.ksw),
  flaggedRow("Pa'o (GlotCC blk-Mymr)", data.other.blk)
]);

// Web text has no labels: report how much each engine calls Zawgyi, and how often knayi agrees with
// myanmar-tools where myanmar-tools is confident.
const confident = data.mc4.filter((t) => { const p = E.tools.probability(t); return p < 0.05 || p > 0.95; });
section('Web text without labels (mC4 Burmese validation)', [
  'Share of lines called Zawgyi on evidence, and agreement with myanmar-tools on the ' + confident.length.toLocaleString('en-US') +
  ' lines where myanmar-tools is confident (p < 0.05 or p > 0.95).'
].join(' '), [{ name: 'called Zawgyi' }, { name: 'agrees with myanmar-tools' }], detectors.map((e) => ({
  label: e.name,
  n: data.mc4.length,
  cells: [
    rate(count(data.mc4, (t) => e.detect(t, 'unicode') === 'zawgyi'), data.mc4.length),
    rate(count(confident, (t) => e.detect(t, 'unicode') === E.tools.detect(t, 'unicode')), confident.length)
  ]
})));

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({ node: process.version, engines: Object.values(E).map((e) => e.name), results }, null, 2) + '\n');
  console.error('wrote ' + jsonOut);
}
