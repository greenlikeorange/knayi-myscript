// Accuracy of knayi on public Zawgyi/Unicode data, next to a published baseline, myanmar-tools, and Rabbit.
// Usage: node scripts/eval/run.mjs [--json results.json] [--with-unlicensed]
//   --with-unlicensed  also use the 2018 search-query log, which has no license; never part of the published page
import fs from 'node:fs';
import os from 'node:os';
import { loadAll, SOURCES } from './datasets.mjs';
import { loadEngines } from './engines.mjs';
import { codeState, REPO } from './lib/knayi.mjs';

const args = process.argv.slice(2);
function option(name) {
  const i = args.indexOf(name);
  if (i === -1) return null;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(name + ' needs a file name');
  return args[i + 1];
}
const jsonOut = option('--json');
const withUnlicensed = args.includes('--with-unlicensed');

const data = await loadAll({ withUnlicensed });
const E = loadEngines();
const detectors = ['local', 'baseline', 'tools'];
const converters = ['local', 'baseline', 'tools', 'rabbit'];

const rate = (hits, n) => (n ? { hits, n, pct: (100 * hits) / n } : null);
const count = (xs, ok) => xs.reduce((sum, x) => sum + (ok(x) ? 1 : 0), 0);
const nfc = (s) => s.normalize('NFC');
const sections = [];

// Conversion: Zawgyi → Unicode against an expected string, exactly and after NFC normalization.
const pairsRow = (label, sources, pairs, keys) => ({
  label,
  sources,
  n: pairs.length,
  cells: converters.flatMap((key) => {
    if (!keys.includes(key)) return [null, null];
    const out = pairs.map(([z]) => E[key].toUnicode(z));
    return [
      rate(count(pairs.map((p, i) => [out[i], p[1]]), ([o, u]) => o === u), pairs.length),
      rate(count(pairs.map((p, i) => [out[i], p[1]]), ([o, u]) => nfc(o) === nfc(u)), pairs.length)
    ];
  })
});
const roundTrip = [...new Map(data.wikipedia.map((u) => [E.rabbit.toZawgyi(u), u]).filter(([z, u]) => z !== u)).entries()];
sections.push({
  id: 'conversion',
  title: 'Conversion: Zawgyi → Unicode',
  note: 'Higher is better. Both reference sets come from Google\'s i18n work, and CLDR\'s expected output follows ICU, the converter ' +
    'myanmar-tools ships, so myanmar-tools has a home advantage on them. CLDR pairs that repeat Google\'s file are counted once, in the ' +
    'Google row. "NFC" compares after Unicode NFC normalization, which treats canonically equivalent spellings as equal (ဦ typed as ' +
    'U+1025 U+102E or as U+1026). The round trip turns Wikipedia lines into Zawgyi with Rabbit and converts them back; Rabbit is left ' +
    'out of that row because it made the input. The Wikipedia text has typing errors of its own, mostly ဝ typed for zero in numbers ' +
    '(၁ဝ for ၁၀). Since 2.10 knayi corrects them, and this row counts each correction as a miss.',
  columns: converters.flatMap((engine) => [{ engine, variant: 'exact' }, { engine, variant: 'NFC' }]),
  rows: [
    pairsRow('google/language-resources reference pairs', ['google'], data.google, converters),
    pairsRow('CLDR reference pairs not in Google\'s file (ICU)', ['cldr'], data.cldr, converters),
    pairsRow('Wikipedia → Rabbit Zawgyi → back', ['wikipedia'], roundTrip, ['local', 'baseline', 'tools'])
  ]
});

// Detection of real text with a known encoding. Words that read the same in both encodings cannot be detected
// by anyone, so WaitZar words that neither Rabbit nor myanmar-tools changes are left out.
const waitzar = data.waitzar.filter((w) => E.rabbit.toUnicode(w) !== w || E.tools.toUnicode(w) !== w);
const detectRow = (label, sources, texts, truth, fallback) => ({
  label,
  sources,
  n: texts.length,
  cells: detectors.map((key) => rate(count(texts, (t) => E[key].detect(t, fallback) === truth), texts.length))
});
const detectionRows = [detectRow('WaitZar hand-typed Zawgyi words, on evidence', ['waitzar'], waitzar, 'zawgyi', 'unicode')];
if (data.queries) {
  detectionRows.unshift(
    detectRow('2018 search queries, Zawgyi', ['queries'], data.queries.filter((q) => q.label === 'zawgyi').map((q) => q.text), 'zawgyi'),
    detectRow('2018 search queries, Unicode', ['queries'], data.queries.filter((q) => q.label === 'unicode').map((q) => q.text), 'unicode')
  );
}
sections.push({
  id: 'detection',
  title: 'Detection: real text recognised',
  note: 'Higher is better. "On evidence" passes fallback `unicode`, so a word counts only when the detector finds Zawgyi evidence ' +
    '(for myanmar-tools, p above 0.95). ' + (data.waitzar.length - waitzar.length) + ' of ' + data.waitzar.length +
    ' distinct WaitZar words read the same in both encodings (neither Rabbit nor myanmar-tools changes them) and are left out.' +
    (data.queries ? ' Query labels come from myanmar-tools (rows where its C++ and JS detectors agree), so it has a home advantage there; those rows use a plain fontDetect.' : ''),
  columns: detectors.map((engine) => ({ engine })),
  rows: detectionRows
});

// Unicode text wrongly flagged as Zawgyi: with the default fallback, and on evidence only.
const flaggedColumns = detectors.flatMap((engine) => [{ engine, variant: 'default' }, { engine, variant: 'evidence' }]);
const flaggedRow = (label, sources, texts) => ({
  label,
  sources,
  n: texts.length,
  cells: detectors.flatMap((key) => [
    rate(count(texts, (t) => E[key].detect(t) === 'zawgyi'), texts.length),
    rate(count(texts, (t) => E[key].detect(t, 'unicode') === 'zawgyi'), texts.length)
  ])
});
const flaggedNote = 'Lower is better, but nothing is bolded: a detector can flag less Unicode just by calling Zawgyi less often, so read ' +
  'these next to the detection table. "default" is a plain `fontDetect(text)`, where a tie falls back to `zawgyi`. "evidence" uses ' +
  'fallback `unicode`, so only real Zawgyi evidence counts. For myanmar-tools both use the thresholds of knayi\'s adapter: Zawgyi above ' +
  'p = 0.95, Unicode below 0.05, and the fallback in between.';
sections.push({
  id: 'unicode-flagged',
  title: 'Unicode flagged as Zawgyi',
  note: flaggedNote + ' A few lines in these sets are real Zawgyi, so 0% is not always reachable.',
  columns: flaggedColumns,
  rows: [
    flaggedRow('FLORES-200 mya_Mymr', ['flores'], data.flores),
    flaggedRow('Burmese Wikipedia sample', ['wikipedia'], data.wikipedia),
    flaggedRow('Okell corpus', ['okell'], data.okell)
  ]
});
sections.push({
  id: 'other-languages',
  title: 'Other Myanmar-script languages flagged as Zawgyi',
  note: flaggedNote,
  columns: flaggedColumns,
  rows: [
    flaggedRow('Shan (GlotCC shn-Mymr)', ['glotcc'], data.other.shn),
    flaggedRow('Mon (GlotCC mnw-Mymr)', ['glotcc'], data.other.mnw),
    flaggedRow("S'gaw Karen (GlotCC ksw-Mymr)", ['glotcc'], data.other.ksw),
    flaggedRow("Pa'o (GlotCC blk-Mymr)", ['glotcc'], data.other.blk)
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
    { label: 'Called Zawgyi', sources: ['mc4'], n: data.mc4.length, cells: detectors.map((key) => rate(count(data.mc4, (t) => E[key].detect(t, 'unicode') === 'zawgyi'), data.mc4.length)) },
    { label: 'Agrees with myanmar-tools', sources: ['mc4'], n: confident.length, cells: detectors.map((key) => key === 'tools' ? null : rate(count(confident, (t) => E[key].detect(t, 'unicode') === E.tools.detect(t, 'unicode')), confident.length)) }
  ]
});

// Markdown for the console.
const engineLabel = (key) => E[key].name + (E[key].checkout ? ' (this checkout)' : '');
const columnLabel = (c) => engineLabel(c.engine) + (c.variant ? ' ' + c.variant : '');
const fmt = (r) => (r == null ? '—' : r.pct.toFixed(1) + '%');
for (const s of sections) {
  console.log('\n## ' + s.title + '\n\n' + s.note + '\n');
  console.log('| Data | n | ' + s.columns.map(columnLabel).join(' | ') + ' |');
  console.log('| --- | ---: | ' + s.columns.map(() => '---:').join(' | ') + ' |');
  for (const row of s.rows) {
    console.log('| ' + row.label + ' | ' + row.n.toLocaleString('en-US') + ' | ' + row.cells.map(fmt).join(' | ') + ' |');
  }
}

if (jsonOut) {
  const used = new Set(sections.flatMap((s) => s.rows.flatMap((r) => r.sources)));
  const result = {
    generatedAt: new Date().toISOString(),
    // The code that produced these numbers: commit, uncommitted changes, and a hash of main.js and library/.
    code: codeState(REPO),
    node: process.version,
    platform: os.type() + ' ' + os.release(),
    withUnlicensed,
    engines: Object.fromEntries(Object.entries(E).map(([key, e]) => [key, e.name])),
    datasets: data.meta,
    sources: SOURCES.filter((s) => used.has(s.id)),
    sections
  };
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2) + '\n');
  console.error('wrote ' + jsonOut);
}
