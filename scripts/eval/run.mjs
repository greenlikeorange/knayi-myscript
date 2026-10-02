// Accuracy of knayi on public Zawgyi/Unicode data, next to a published baseline, myanmar-tools, and Rabbit.
// Usage: node scripts/eval/run.mjs [--json results.json] [--with-unlicensed]
//   --with-unlicensed  also use the 2018 search-query log, which has no license; never part of the published page
import fs from 'node:fs';
import os from 'node:os';
import { loadAll, SOURCES } from './datasets.mjs';
import { loadEngines } from './engines.mjs';

const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const withUnlicensed = args.includes('--with-unlicensed');

const data = await loadAll({ withUnlicensed });
const E = loadEngines();
const detectors = ['local', 'baseline', 'tools'];
const converters = ['local', 'baseline', 'tools', 'rabbit'];

const rate = (hits, n) => ({ hits, n, pct: n ? (100 * hits) / n : 0 });
const count = (xs, ok) => xs.reduce((sum, x, i) => sum + (ok(x, i) ? 1 : 0), 0);
const sections = [];

// Conversion: exact match against an expected Unicode string.
const pairsRow = (label, pairs, keys) => ({
  label,
  n: pairs.length,
  cells: converters.map((key) => (keys.includes(key) ? rate(count(pairs, ([z, u]) => E[key].toUnicode(z) === u), pairs.length) : null))
});
const roundTrip = data.wikipedia.map((u) => [E.rabbit.toZawgyi(u), u]).filter(([z, u]) => z !== u);
sections.push({
  id: 'conversion',
  title: 'Conversion: Zawgyi → Unicode, exact match',
  note: 'Higher is better. Gold pairs are hand-checked; CLDR follows ICU, the converter myanmar-tools ships, so myanmar-tools has a home advantage there. ' +
    'The round trip turns Wikipedia lines into Zawgyi with Rabbit and converts them back; Rabbit is left out because it made the input.',
  columns: converters.map((engine) => ({ engine })),
  rows: [
    pairsRow('google/language-resources gold pairs', data.google, converters),
    pairsRow('CLDR gold pairs', data.cldr, converters),
    pairsRow('Wikipedia → Rabbit Zawgyi → back', roundTrip, ['local', 'baseline', 'tools'])
  ]
});

// Detection of real text with a known encoding.
const detectRow = (label, texts, truth, fallback) => ({
  label,
  n: texts.length,
  cells: detectors.map((key) => rate(count(texts, (t) => E[key].detect(t, fallback) === truth), texts.length))
});
const detectionRows = [detectRow('WaitZar hand-typed Zawgyi words, on evidence', data.waitzar, 'zawgyi', 'unicode')];
if (data.queries) {
  detectionRows.unshift(
    detectRow('2018 search queries, Zawgyi', data.queries.filter((q) => q.label === 'zawgyi').map((q) => q.text), 'zawgyi'),
    detectRow('2018 search queries, Unicode', data.queries.filter((q) => q.label === 'unicode').map((q) => q.text), 'unicode')
  );
}
sections.push({
  id: 'detection',
  title: 'Detection: real Zawgyi recognised',
  note: 'Higher is better. "On evidence" passes fallback `unicode`, so a word counts only when the detector finds real Zawgyi evidence.' +
    (data.queries ? ' Query labels come from myanmar-tools (rows where its C++ and JS detectors agree), so it has a home advantage on those rows.' : ''),
  columns: detectors.map((engine) => ({ engine })),
  rows: detectionRows
});

// Unicode text wrongly flagged as Zawgyi: with the default fallback, and on evidence only.
const flaggedColumns = detectors.flatMap((engine) => [{ engine, variant: 'default' }, { engine, variant: 'evidence' }]);
const flaggedRow = (label, texts) => ({
  label,
  n: texts.length,
  cells: detectors.flatMap((key) => [
    rate(count(texts, (t) => E[key].detect(t) === 'zawgyi'), texts.length),
    rate(count(texts, (t) => E[key].detect(t, 'unicode') === 'zawgyi'), texts.length)
  ])
});
const flaggedNote = 'Lower is better. "default" is a plain `fontDetect(text)`, where a tie falls back to `zawgyi`. "evidence" uses fallback `unicode`, so only real Zawgyi evidence counts.';
sections.push({
  id: 'unicode-flagged',
  title: 'Unicode flagged as Zawgyi',
  note: flaggedNote,
  columns: flaggedColumns,
  rows: [
    flaggedRow('FLORES-200 mya_Mymr', data.flores),
    flaggedRow('Burmese Wikipedia sample', data.wikipedia),
    flaggedRow('Okell corpus', data.okell)
  ]
});
sections.push({
  id: 'other-languages',
  title: 'Other Myanmar-script languages flagged as Zawgyi',
  note: flaggedNote,
  columns: flaggedColumns,
  rows: [
    flaggedRow('Shan (GlotCC shn-Mymr)', data.other.shn),
    flaggedRow('Mon (GlotCC mnw-Mymr)', data.other.mnw),
    flaggedRow("S'gaw Karen (GlotCC ksw-Mymr)", data.other.ksw),
    flaggedRow("Pa'o (GlotCC blk-Mymr)", data.other.blk)
  ]
});

// Web text has no labels: report how much each engine calls Zawgyi, and how often it agrees with
// myanmar-tools where myanmar-tools is confident.
const confident = data.mc4.filter((t) => { const p = E.tools.probability(t); return p < 0.05 || p > 0.95; });
sections.push({
  id: 'web-text',
  title: 'Web text without labels (mC4 Burmese validation)',
  note: 'Share of lines called Zawgyi on evidence, and agreement with myanmar-tools on the ' + confident.length.toLocaleString('en-US') +
    ' lines where myanmar-tools is confident (p < 0.05 or p > 0.95).',
  columns: detectors.map((engine) => ({ engine })),
  rows: [
    { label: 'Called Zawgyi', n: data.mc4.length, cells: detectors.map((key) => rate(count(data.mc4, (t) => E[key].detect(t, 'unicode') === 'zawgyi'), data.mc4.length)) },
    { label: 'Agrees with myanmar-tools', n: confident.length, cells: detectors.map((key) => rate(count(confident, (t) => E[key].detect(t, 'unicode') === E.tools.detect(t, 'unicode')), confident.length)) }
  ]
});

// Markdown for the console.
const engineLabel = (key) => E[key].name + (E[key].checkout ? ' (this checkout)' : '');
const columnLabel = (c) => engineLabel(c.engine) + (c.variant ? ' ' + c.variant : '');
const fmt = (r) => (r == null ? '' : r.pct.toFixed(1) + '%');
for (const s of sections) {
  console.log('\n## ' + s.title + '\n\n' + s.note + '\n');
  console.log('| Data | n | ' + s.columns.map(columnLabel).join(' | ') + ' |');
  console.log('| --- | ---: | ' + s.columns.map(() => '---:').join(' | ') + ' |');
  for (const row of s.rows) {
    console.log('| ' + row.label + ' | ' + row.n.toLocaleString('en-US') + ' | ' + row.cells.map(fmt).join(' | ') + ' |');
  }
}

if (jsonOut) {
  const result = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: os.type() + ' ' + os.release(),
    withUnlicensed,
    engines: Object.fromEntries(Object.entries(E).map(([key, e]) => [key, e.name])),
    sources: SOURCES.filter((s) => withUnlicensed || !s.unlicensed),
    sections
  };
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2) + '\n');
  console.error('wrote ' + jsonOut);
}
