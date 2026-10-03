// Finds a probe for every table row (scripts/testing/rows.js) and records what the public API returns for it,
// in test/fixtures/tables.json, which test/tables.test.js checks.
//
//   node scripts/testing/table-cases.js           report what --write would change (exit 1 if anything)
//   node scripts/testing/table-cases.js --write   write the file: keep each probe that still exercises its
//                                                 row, find probes for new rows, record today's outputs
//
// Rewrite the file only in a pull request that changes output on purpose, and review its diff: every changed
// "expect" is an output change. Probes are synthetic (made from the rows' own patterns and a few letters), so
// no corpus text enters the repository.
//
// A probe for a glyph is the glyph in a short syllable of its role. A probe for a pattern row is the shortest
// string found that makes the row fire inside the public call (reach "call"); for a rule that never fires
// there, because the rules before it always change its input first, the shortest string its pattern matches
// (reach "pattern").

const fs = require('fs');
const path = require('path');
const fc = require('fast-check');
const knayi = require('../../main');
const { buildRows } = require('./rows');

const FIXTURE = path.join(__dirname, '..', '..', 'test', 'fixtures', 'tables.json');
const RANDOM_TRIES = 4000;

knayi.setGlobalOptions({ silent_mode: true });

// Syllables that put a glyph in its role. Zawgyi: e, ka, ma, sa, aa; Win: a (e), u (ka), r (ma), o (sa), m (aa).
const GLYPH_TEMPLATES = {
  zawgyi: {
    base: ['\u1031%\u102C', '%\u102C', '%'],
    pre: ['%\u1000', '%\u1000\u102C'],
    mark: ['\u1000%', '\u1019%'],
    stack: ['\u1019%', '\u1000%'],
    kinzi: ['\u1000%', '\u101E%']
  },
  win: {
    base: ['a%m', '%m', '%'],
    pre: ['%u', '%um'],
    mark: ['u%', 'r%'],
    stack: ['r%', 'u%'],
    kinzi: ['u%', 'o%'],
    text: ['u%m', '%']
  }
};

// Letters added around a sampled match, and mixed into random probes.
const CONTEXT = ['', '\u1000', ' ', '\u1000 '];
const BASE_ALPHABET = ['\u1000', '\u1004', '\u1010', '\u101B', '\u1031', '\u103A', '\u1039', '\u102C', '\u102D', '\u103C', ' '];

// A seed per row (FNV-1a of its id), so a row's probe does not depend on the rows before it.
function seedOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h | 0;
}

// The characters a pattern names, with ranges sampled, as an alphabet for random probes.
function patternAlphabet(source) {
  const text = source.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\([tnrf])/g, (m, c) => ({ t: '\t', n: '\n', r: '\r', f: '\f' })[c]);
  const chars = new Set();
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (text[i + 1] === '-' && i + 2 < text.length && !'[]()'.includes(text[i + 2])) {
      const from = c.charCodeAt(0);
      const to = text.charCodeAt(i + 2);
      const step = Math.max(1, Math.ceil((to - from + 1) / 24));
      for (let code = from; code <= to; code += step) chars.add(String.fromCharCode(code));
      chars.add(text[i + 2]);
      i += 2;
    } else if (!'[]()|*+?^$\\{},.!=:'.includes(c)) {
      chars.add(c);
    }
  }
  return [...chars];
}

function better(a, b) {
  if (!b) return true;
  if (a.reach !== b.reach) return a.reach === 'call';
  if (a.probe.length !== b.probe.length) return a.probe.length < b.probe.length;
  return a.probe < b.probe;
}

// Strings the pattern matches, from fast-check. Anchors are dropped, a lookahead's text is appended where it
// stands and a negative lookahead is left out, since fast-check does not generate for them.
function sample(re, id, count) {
  const source = re.source.replace(/^\^|\$$/g, '').replace(/\(\?=([^()]*)\)/g, '$1').replace(/\(\?![^()]*\)/g, '');
  try {
    return fc.sample(fc.stringMatching(new RegExp(source), { size: 'xsmall' }), { seed: seedOf(id), numRuns: count });
  } catch (e) {
    return [];
  }
}

function candidateFor(row, probe) {
  if (!row.exercises(probe)) return null;
  return { probe: probe, reach: row.reach ? row.reach(probe) : undefined };
}

function findProbe(row) {
  if (row.key !== undefined) {
    const font = row.id.split(' ')[0];
    for (const template of GLYPH_TEMPLATES[font][row.role] || ['%']) {
      const found = candidateFor(row, template.split('%').join(row.key));
      if (found) return found;
    }
    return null;
  }
  let best = null;
  const consider = (probe) => {
    const found = candidateFor(row, probe);
    if (found && better(found, best)) best = found;
  };
  let samples = sample(row.pattern, row.id, 400);
  if (row.alsoPattern) {
    // A switch that turns a rule off needs the rule's input and the switch in one probe.
    const others = sample(row.alsoPattern, row.id + ' switch', 40);
    samples = [].concat(...others.map((other) => samples.slice(0, 40).map((own) => other + ' ' + own)));
  }
  for (const s of samples) {
    for (const before of CONTEXT) for (const after of CONTEXT) consider(before + s + after);
  }
  if (best && best.reach !== 'pattern') return best;
  // Then each match next to a match of another row's pattern.
  for (const other of row.contextPatterns || []) {
    for (const context of sample(other, row.id + ' ' + other.source, 3)) {
      for (const own of samples.slice(0, 40)) {
        consider(own + context);
        consider(context + own);
        consider(own + ' ' + context);
        consider(context + ' ' + own);
      }
    }
  }
  if (best && best.reach !== 'pattern') return best;
  // Then random strings over the pattern's characters and a few letters.
  const alphabet = patternAlphabet(row.pattern.source);
  const unit = alphabet.length
    ? fc.oneof({ weight: 7, arbitrary: fc.constantFrom(...alphabet) }, { weight: 3, arbitrary: fc.constantFrom(...BASE_ALPHABET) })
    : fc.constantFrom(...BASE_ALPHABET);
  const strings = fc.sample(fc.string({ unit: unit, minLength: 1, maxLength: 7 }), { seed: seedOf(row.id + ' random'), numRuns: RANDOM_TRIES });
  strings.forEach(consider);
  return best;
}

// JSON with every character outside printable ASCII written as a \u escape, so code points show in a review.
function stringify(value) {
  return JSON.stringify(value, null, 2).replace(/[^\x20-\x7e\n]/g, (c) => '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4)) + '\n';
}

function main() {
  const write = process.argv.includes('--write');
  const rows = buildRows(knayi);
  const old = fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).cases : {};
  const cases = {};
  const missing = [];
  let kept = 0, found = 0, changed = 0;
  for (const row of rows) {
    const previous = old[row.id];
    let pick = null;
    if (previous && row.exercises(previous.probe)) {
      pick = { probe: previous.probe, reach: row.reach ? row.reach(previous.probe) : undefined };
      if (pick.reach === 'pattern') {
        const fresh = findProbe(row); // look again for a probe that reaches the rule inside the call
        if (fresh && fresh.reach === 'call') pick = fresh;
      }
      if (pick.probe === previous.probe) kept++;
      else found++;
    } else {
      pick = findProbe(row);
      if (pick) found++;
    }
    if (!pick) {
      missing.push(row.id + '  ' + row.label);
      continue;
    }
    const entry = { probe: pick.probe };
    if (pick.reach) entry.reach = pick.reach;
    entry.expect = row.run(pick.probe);
    if (previous && JSON.stringify(previous.expect) !== JSON.stringify(entry.expect)) {
      changed++;
      console.log('changed  ' + row.id + '\n  was ' + JSON.stringify(previous.expect) + '\n  now ' + JSON.stringify(entry.expect));
    }
    cases[row.id] = entry;
  }
  const stale = Object.keys(old).filter((id) => !cases[id]);
  console.log(rows.length + ' rows: ' + kept + ' probes kept, ' + found + ' found, ' + missing.length + ' without a probe, ' +
    changed + ' with a changed output, ' + stale.length + ' stale cases');
  missing.forEach((m) => console.log('no probe  ' + m));
  stale.forEach((id) => console.log('stale     ' + id));
  const tables = {};
  for (const row of rows) {
    const t = tables[row.table] || (tables[row.table] = { rows: 0, cases: 0, call: 0, reach: false });
    t.rows++;
    if (row.reach) t.reach = true;
    if (cases[row.id]) t.cases++;
    if (cases[row.id] && cases[row.id].reach === 'call') t.call++;
  }
  for (const name of Object.keys(tables)) {
    const t = tables[name];
    console.log(name.padEnd(22) + t.cases + '/' + t.rows + ' rows have a case' +
      (t.reach ? '; ' + t.call + ' fire inside the public call' : ''));
  }
  if (write) {
    fs.writeFileSync(FIXTURE, stringify({
      about: 'One synthetic probe per table row, and what the public API returned for it. Written by ' +
        'node scripts/testing/table-cases.js --write; checked by test/tables.test.js.',
      cases: cases
    }));
    console.log('wrote ' + path.relative(process.cwd(), FIXTURE));
  }
  if (missing.length || (!write && (found || changed || stale.length))) process.exitCode = 1;
}

main();
