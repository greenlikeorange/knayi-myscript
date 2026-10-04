// Unit tests of src/rules/unicodeToZawgyi.js (docs/next/DESIGN.md §7.9): the rule rows against 2.x's
// convertRules.unicode.zawgyi (the frozen scripts/oracle/syllable.js), the sections and the why comment of each
// row, the six wrapped rows (decision 29), an example for each row id (D17), the rows read from the Zawgyi glyph
// table and the one pass that writes GLYPHS (§3.9), the table probes, and the trace (§3.9, D4). The differential
// fuzz is in unicodeToZawgyi.fuzz.test.mjs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as acorn from 'acorn';
import { UNICODE_TO_ZAWGYI_RULES, unicodeToZawgyi, traceUnicodeToZawgyi } from '../../src/rules/unicodeToZawgyi.js';
import fc from 'fast-check';
import {
  createTrace, startTrace, ruleLabel, applyRuleRows, traceRuleRows
} from '../../src/core/rules.js';
import { collapseRepeatedMarks } from '../../src/rules/segment.js';
import { ZAWGYI_GLYPHS } from '../../src/fonts/zawgyi.js';
import { pendingPort, srcText, tableProbes } from './helpers.mjs';
import {
  TWO_X_ROWS, TWO_X_PROBE_IDS, twoXUnicodeToZawgyi, twoXDebugLog, traceAsDebugLog, asFontConvert
} from './unicodeToZawgyi.oracle.mjs';

const ROWS = UNICODE_TO_ZAWGYI_RULES;

// The sections in the order they run, with the id prefix and the row count of each (DESIGN.md §3.9).
const SECTIONS = [
  ['SHAPES_IN_CONTEXT', 'shapes', 5], ['KINZI', 'kinzi', 5], ['VISUAL_ORDER', 'order', 5],
  ['SMALL_LETTERS', 'small', 3], ['GLYPHS', 'glyphs', 38], ['NARROW_TA', 'narrow-ta', 1],
  ['MEDIAL_RA_SHAPES', 'medial-ra', 8]
];

// One hand-written example per row id: [id, Unicode text, its Zawgyi text]. Each makes its row change the text
// inside the conversion; the comment says what the text is. Real words where one shows the rule, else synthetic.
const EXAMPLES = [
  ['uz.shapes.1', '\u1015\u103C\u102F', '\u103B\u1015\u1033'], // pyu, to make
  ['uz.shapes.2', '\u1019\u103C\u1030', '\u103B\u1019\u1034'], // myu, mist
  ['uz.shapes.3', '\u1000\u103B\u1037', '\u1000\u103A\u1094'], // synthetic: ka, medial ya, dot below
  ['uz.shapes.4', '\u1000\u103B\u103D\u1014\u103A', '\u1000\u107D\u103C\u1014\u1039'], // kyun, servant
  ['uz.shapes.5', '\u1019\u103C\u102D\u102F\u1037', '\u107F\u1019\u102D\u1033\u1095'], // myo, town
  ['uz.kinzi.1', '\u101E\u1004\u103A\u1039\u1018\u1031\u102C', '\u101E\u1031\u1018\u1064\u102C'], // thinbaw, ship
  // ingaleik, English
  ['uz.kinzi.2', '\u1021\u1004\u103A\u1039\u1002\u101C\u102D\u1015\u103A',
    '\u1021\u1002\u1064\u101C\u102D\u1015\u1039'],
  // thingyaing, cemetery
  ['uz.kinzi.3', '\u101E\u1004\u103A\u1039\u1001\u103B\u102D\u102F\u1004\u103A\u1038',
    '\u101E\u1001\u108B\u103A\u1033\u1004\u1039\u1038'],
  ['uz.kinzi.4', '\u1021\u1004\u103A\u1039\u1000\u103B\u102E', '\u1021\u1000\u108C\u103A'], // eingyi, shirt
  ['uz.kinzi.5', '\u101E\u1004\u103A\u1039\u1000\u1036', '\u101E\u1000\u108D'], // synthetic: kinzi on ka with anusvara
  ['uz.order.1', '\u1000\u103C\u1000\u103A', '\u107E\u1000\u1000\u1039'], // kyet, chicken
  ['uz.order.2', '\u1023\u1014\u1039\u1012\u103C\u1031', '\u1023\u1031\u103B\u108F\u1075'], // eindre, composure
  ['uz.order.3', '\u1014\u1031', '\u1031\u1014'], // ne, sun
  ['uz.order.4', '\u1015\u1005\u1039\u1005\u1031\u1000', '\u1015\u1031\u1005\u1065\u1000'], // pacceka, Pali
  ['uz.order.5', '\u1000\u103C\u1031\u102C\u1004\u103A', '\u1031\u107E\u1000\u102C\u1004\u1039'], // kyaung, cat
  ['uz.small.1', '\u1014\u102F', '\u108F\u102F'], // nu, tender
  ['uz.small.2', '\u1014\u103C', '\u103B\u108F'], // synthetic: na, medial ra
  ['uz.small.3', '\u1009\u102F', '\u106A\u102F'], // synthetic: nya, u
  ['uz.glyphs.1', '\u104E\u1004\u103A\u1038', '\u104E'], // lagaung, it
  ['uz.glyphs.2', '\u1015\u1031\u102B\u103A', '\u1031\u1015\u105A'], // paw, on
  ['uz.glyphs.3', '\u1015\u103C\u103F\u1014\u102C', '\u103B\u1015\u1086\u1014\u102C'], // pyatthana, problem
  ['uz.glyphs.4', '\u1015\u101C\u1039\u101C\u1004\u103A', '\u1015\u101C\u1085\u1004\u1039'], // pallin, throne
  ['uz.glyphs.5', '\u101E\u1019\u1039\u1019\u1010', '\u101E\u1019\u107C\u1010'], // thammada, president
  ['uz.glyphs.6', '\u1000\u1019\u1039\u1018\u102C', '\u1000\u1019\u107B\u102C'], // kaba, world
  ['uz.glyphs.7', '\u101E\u1019\u1039\u1017\u1014\u103A', '\u101E\u1019\u107A\u1014\u1039'], // thamban, sampan
  ['uz.glyphs.8', '\u1015\u102F\u1015\u1039\u1016', '\u1015\u102F\u1015\u1079'], // synthetic: stacked pha
  // kumpani, company
  ['uz.glyphs.9', '\u1000\u102F\u1019\u1039\u1015\u100F\u102E',
    '\u1000\u102F\u1019\u1078\u100F\u102E'],
  ['uz.glyphs.10', '\u1012\u102D\u1014\u1039\u1014', '\u1012\u102D\u108F\u1077'], // dinna, given (Pali)
  ['uz.glyphs.11', '\u1017\u102F\u1012\u1039\u1013', '\u1017\u102F\u1012\u1076'], // Buddha
  ['uz.glyphs.12', '\u101E\u1012\u1039\u1012\u102B', '\u101E\u1012\u1075\u102B'], // thadda, grammar
  ['uz.glyphs.13', '\u101D\u1010\u1039\u1011\u102F', '\u101D\u1010\u1073\u1033'], // wuttu, story
  // myitta (metta), loving kindness
  ['uz.glyphs.14', '\u1019\u1031\u1010\u1039\u1010\u102C',
    '\u1031\u1019\u1010\u1071\u102C'],
  // ponna, brahmin
  ['uz.glyphs.15', '\u1015\u102F\u100F\u1039\u100F\u102C\u1038',
    '\u1015\u102F\u100F\u1070\u102C\u1038'],
  // synthetic: dda with stacked ddha
  ['uz.glyphs.16', '\u101D\u102F\u100D\u1039\u100E\u102D',
    '\u101D\u102F\u106F\u102D'],
  ['uz.glyphs.17', '\u1000\u100F\u1039\u100D', '\u1000\u1091'], // kanda, section
  ['uz.glyphs.18', '\u101D\u100D\u1039\u100D', '\u101D\u106E'], // synthetic: dda with stacked dda
  ['uz.glyphs.19', '\u1025\u1000\u1039\u1000\u100B\u1039\u100C', '\u1025\u1000\u1060\u1092'], // oukkahta, chairman
  // thandan, shape
  ['uz.glyphs.20', '\u101E\u100F\u1039\u100C\u102C\u1014\u103A',
    '\u101E\u100F\u106D\u102C\u1014\u1039'],
  ['uz.glyphs.21', '\u101D\u100B\u1039\u100B', '\u101D\u1097'], // wutta, cycle
  ['uz.glyphs.22', '\u1000\u100F\u1039\u100B\u1000', '\u1000\u100F\u106C\u1000'], // kandaka, thorn (Pali)
  // majjhima, typed with ca and medial ya for jha
  ['uz.glyphs.23', '\u1019\u1007\u1039\u1005\u103B\u102D\u1019',
    '\u1019\u1007\u1069\u102D\u1019'],
  ['uz.glyphs.24', '\u101D\u102D\u1007\u1039\u1007\u102C', '\u101D\u102D\u1007\u1068\u102C'], // wizza, science
  ['uz.glyphs.25', '\u1019\u102D\u1005\u1039\u1006\u102C', '\u1019\u102D\u1005\u1066\u102C'], // meiksa, wrong view
  // pyissi, thing
  ['uz.glyphs.26', '\u1015\u1005\u1039\u1005\u100A\u103A\u1038',
    '\u1015\u1005\u1065\u100A\u1039\u1038'],
  ['uz.glyphs.27', '\u1021\u1002\u1039\u1003', '\u1021\u1002\u1063'], // aggha, price (Pali)
  // magazine
  ['uz.glyphs.28', '\u1019\u1002\u1039\u1002\u1007\u1004\u103A\u1038',
    '\u1019\u1002\u1062\u1007\u1004\u1039\u1038'],
  ['uz.glyphs.29', '\u1012\u102F\u1000\u1039\u1001', '\u1012\u102F\u1000\u1061'], // dukkha, suffering
  ['uz.glyphs.30', '\u1019\u103D\u103E\u1031\u1038', '\u1031\u1019\u108A\u1038'], // hmwe, fragrant
  ['uz.glyphs.31', '\u1019\u103E\u1030\u1038', '\u1019\u1089\u1038'], // hmu, chief
  ['uz.glyphs.32', '\u1005\u1000\u1039\u1000\u1030', '\u1005\u1000\u1060\u1034'], // sekku, paper
  ['uz.glyphs.33', '\u1019\u103E\u102F', '\u1019\u1088'], // hmu, affair
  ['uz.glyphs.34', '\u1019\u1004\u103A', '\u1019\u1004\u1039'], // min, king
  ['uz.glyphs.35', '\u1000\u103B\u102C\u1038', '\u1000\u103A\u102C\u1038'], // kya, tiger
  ['uz.glyphs.36', '\u1015\u103C', '\u103B\u1015'], // pya, to show
  ['uz.glyphs.37', '\u1000\u103D\u102C', '\u1000\u103C\u102C'], // kwa, to differ
  ['uz.glyphs.38', '\u1019\u103E\u102C', '\u1019\u103D\u102C'], // hma, at
  ['uz.narrow-ta.1', '\u101E\u1014\u1039\u1010\u102C', '\u101E\u108F\u1072\u102C'], // thanda, coral
  ['uz.medial-ra.1', '\u1000\u103C\u102C\u1038', '\u107E\u1000\u102C\u1038'], // kya, to hear
  ['uz.medial-ra.2', '\u1015\u103C\u103D\u102D', '\u1083\u1015\u103C\u102D'], // synthetic: pa with medial ra, wa and i
  ['uz.medial-ra.3', '\u1000\u103C\u103D\u102D', '\u1084\u1000\u103C\u102D'], // synthetic: ka with medial ra, wa and i
  ['uz.medial-ra.4', '\u1015\u103C\u102E\u1038', '\u107F\u1015\u102E\u1038'], // pyi, finished
  ['uz.medial-ra.5', '\u1000\u103C\u102D\u102F\u1038', '\u1080\u1000\u102D\u1033\u1038'], // kyo, rope
  ['uz.medial-ra.6', '\u1015\u103C\u103D\u1014\u103A', '\u1081\u1015\u103C\u1014\u1039'], // pyun, tube
  ['uz.medial-ra.7', '\u1000\u103C\u103D\u1000\u103A', '\u1082\u1000\u103C\u1000\u1039'], // kywet, rat
  ['uz.medial-ra.8', '\u1009\u103C', '\u1081\u106A'] // synthetic: nya with medial ra
];

const codes = (text) => Array.from(text, (c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

// The units of a regex source that is a pure literal of \u escapes, or null.
function literalUnits(source) {
  if (!/^(\\u[0-9a-fA-F]{4})+$/.test(source)) return null;
  return source.slice(2).split('\\u').map((h) => parseInt(h, 16));
}

// Whether 2.x's source is a pure literal starting at U+1000-U+1010, the V8 slow path (decision 29).
function isSlowAtom(source) {
  const units = literalUnits(source);
  return units !== null && units[0] >= 0x1000 && units[0] <= 0x1010;
}

// 2.x's source with its first \u escape in a one-character class.
const wrapFirstUnit = (source) => '[' + source.slice(0, 6) + ']' + source.slice(6);

// The sections of the source, each a list of its entries in order: { node, id, fromTable }. A section is
// deepFreeze([...rows]), or tableRows('<prefix>', [...entries]), where an entry that is a Unicode text (a string, or
// a name such as KINZI_TEXT) is a row read from the glyph table, whose id is that of its place in the section.
// Also returns the line comments of the source.
function readSections() {
  const comments = [];
  const ast = acorn.parse(srcText('rules/unicodeToZawgyi.js'),
    { ecmaVersion: 'latest', sourceType: 'module', locations: true, onComment: comments });
  const sections = new Map();
  for (const statement of ast.body) {
    const declarator = statement.type === 'VariableDeclaration' ? statement.declarations[0] : null;
    const section = declarator && SECTIONS.find(([name]) => name === declarator.id.name);
    if (section) sections.set(section[0], { init: declarator.init, entries: entriesOf(declarator.init, section[1]) });
  }
  return { sections, comments };
}

function entriesOf(init, prefix) {
  const list = init.callee.name === 'tableRows' ? init.arguments[1] : init.arguments[0];
  return list.elements.map((node, i) => (node.type === 'ObjectExpression'
    ? { node, id: node.properties.find((p) => p.key.name === 'id').value.value, fromTable: false }
    : { node, id: 'uz.' + prefix + '.' + (i + 1), fromTable: true }));
}

// The ids of the rows the source writes as a Unicode text, read from the glyph table, in row order.
const READ_FROM_TABLE = [...readSections().sections.values()]
  .flatMap(({ entries }) => entries.filter((entry) => entry.fromTable).map((entry) => entry.id));

// The rows of GLYPHS, and the text each matches.
const GLYPH_ROWS = ROWS.filter((row) => row.id.startsWith('uz.glyphs.'));
const textOf = (source) => String.fromCharCode(...literalUnits(source));

// A virama two units after a virama: a stack on a stack, where the one pass runs the GLYPHS rows one by one.
const STACK_ON_STACK = /\u1039[\s\S]\u1039/;

describe('the Unicode to Zawgyi rows (DESIGN.md §7.9)', () => {
  it('are 57 rows applied once, then 8 repeat rows, as 2.x has them', () => {
    assert.equal(ROWS.length, 65);
    assert.equal(TWO_X_ROWS.length, 65);
    assert.deepEqual(ROWS.map((row) => row.repeat), TWO_X_ROWS.map((two) => two.repeat));
    assert.equal(ROWS.filter((row) => !row.repeat).length, 57);
    assert.ok(ROWS.slice(57).every((row) => row.repeat), 'the repeat rows come last');
  });

  it('each row is its 2.x rule: label, replacement, flags and pattern', () => {
    ROWS.forEach((row, i) => {
      const [re, to] = TWO_X_ROWS[i].rule;
      assert.equal(ruleLabel(row), re.source, row.id + ' label (core/rules.js ruleLabel)');
      assert.equal(row.to, to, row.id + ' replacement');
      assert.equal(row.re.flags, 'g', row.id + ' flags');
      const expected = isSlowAtom(re.source) ? wrapFirstUnit(re.source) : re.source;
      assert.equal(row.re.source, expected, row.id + ' pattern');
    });
  });

  it('only the six 2.x pure literals that start at U+1000-U+1010 are wrapped, and only they carry a label', () => {
    const slow = ROWS.filter((row, i) => isSlowAtom(TWO_X_ROWS[i].rule[0].source)).map((row) => row.id);
    const labelled = ROWS.filter((row) => row.label !== undefined).map((row) => row.id);
    assert.deepEqual(slow, ['uz.kinzi.1', 'uz.glyphs.16', 'uz.glyphs.17', 'uz.glyphs.18', 'uz.glyphs.19',
      'uz.glyphs.21']);
    assert.deepEqual(labelled, slow);
    for (const row of ROWS) assert.equal(isSlowAtom(row.re.source), false, row.id + ' is still a slow atom');
  });

  it('a wrapped row replaces exactly what its 2.x literal replaces', () => {
    ROWS.forEach((row, i) => {
      if (row.label === undefined) return;
      const [re, to] = TWO_X_ROWS[i].rule;
      const units = literalUnits(re.source).map((code) => String.fromCharCode(code));
      const alphabet = units.concat(['\u1000', '\u1039', 'a']);
      for (const a of alphabet) {
        for (const b of alphabet) {
          for (const c of alphabet) {
            const text = a + units.join('') + b + units.slice(0, 2).join('') + c;
            assert.equal(text.replace(row.re, row.to), text.replace(re, to), row.id + ' on ' + codes(text));
          }
        }
      }
    });
  });

  it('ship only id, re, to, repeat, needs and the label of a wrapped row (D17)', () => {
    for (const row of ROWS) {
      const keys = ['id', 're', 'to', 'repeat', 'needs'].concat(row.label === undefined ? [] : ['label']);
      assert.deepEqual(Object.keys(row), keys, row.id);
      assert.equal(typeof row.repeat, 'boolean', row.id);
    }
  });

  it('have unique ids that name their section and their place in it', () => {
    const expected = SECTIONS.flatMap(([, prefix, count]) =>
      Array.from({ length: count }, (_, n) => 'uz.' + prefix + '.' + (n + 1)));
    assert.deepEqual(ROWS.map((row) => row.id), expected);
  });

  it('are frozen, and their regexes are left unfrozen with lastIndex 0 (D16)', () => {
    assert.ok(Object.isFrozen(ROWS));
    for (const row of ROWS) {
      assert.ok(Object.isFrozen(row), row.id);
      assert.ok(!Object.isFrozen(row.re), row.id + ': a frozen RegExp breaks replace');
      assert.equal(row.re.lastIndex, 0, row.id);
    }
  });
});

describe('the sections of src/rules/unicodeToZawgyi.js (DESIGN.md §3.9)', () => {
  const { sections, comments } = readSections();

  // The line comments that end right above `line`, joined.
  function commentAbove(line) {
    const lines = [];
    for (let at = line - 1; ; at--) {
      const comment = comments.find((c) => c.type === 'Line' && c.loc.start.line === at);
      if (!comment) break;
      lines.unshift(comment.value.trim());
    }
    return lines.join(' ');
  }

  it('hold every row, in 2.x order, each section a frozen array under its own name', () => {
    assert.deepEqual([...sections.keys()], SECTIONS.map(([name]) => name));
    const ids = [];
    for (const [name, { init, entries }] of sections) {
      const prefix = SECTIONS.find(([section]) => section === name)[1];
      assert.equal(init.type, 'CallExpression', name);
      if (init.callee.name === 'tableRows') {
        assert.equal(init.arguments[0].value, prefix, name + ': the id prefix of its table rows');
      } else {
        assert.equal(init.callee.name, 'deepFreeze', name);
        assert.ok(entries.every((entry) => !entry.fromTable), name + ' holds only rows');
      }
      ids.push(...entries.map((entry) => entry.id));
    }
    assert.deepEqual(ids, ROWS.map((row) => row.id));
  });

  it('give each row a why comment that cites UTN #11 or a research note', () => {
    const bad = [];
    for (const { entries } of sections.values()) {
      let why = '';
      entries.forEach((entry, i) => {
        // A run of table texts on adjacent lines shares the comment above its first line.
        const previous = entries[i - 1];
        const continuesRun = entry.fromTable && previous && previous.fromTable &&
          entry.node.loc.start.line - previous.node.loc.end.line <= 1;
        why = commentAbove(entry.node.loc.start.line) || (continuesRun ? why : '');
        if (!/UTN #11|research\/[a-z-]+\.md §\d/.test(why)) bad.push(entry.id + ': ' + (why || 'no comment'));
      });
    }
    assert.deepEqual(bad, []);
  });

  it('say why each row of one fixed text is written by hand', () => {
    const literal = (entry) => {
      const index = ROWS.findIndex((row) => row.id === entry.id);
      return literalUnits(TWO_X_ROWS[index].rule[0].source) !== null && TWO_X_ROWS[index].rule[1].indexOf('$') === -1;
    };
    const unexplained = [];
    for (const { entries } of sections.values()) {
      for (const entry of entries.filter((e) => !e.fromTable && literal(e))) {
        if (!/Written by hand: /.test(commentAbove(entry.node.loc.start.line))) unexplained.push(entry.id);
      }
    }
    assert.deepEqual(unexplained, []);
  });
});

describe('the rows read from the Zawgyi glyph table (DESIGN.md §3.9)', () => {
  // The table read backwards, restated: the first glyph whose row is the text, its attached marks included.
  function tableGlyph(text) {
    const found = Object.keys(ZAWGYI_GLYPHS).find((glyph) => {
      const [, unicode, marks] = ZAWGYI_GLYPHS[glyph];
      return unicode + (marks || '') === text;
    });
    return found === undefined ? null : found;
  }

  // 2.x's rows of one fixed text and one fixed replacement: [id, text, replacement].
  const LITERAL_ROWS = TWO_X_ROWS.map(({ rule: [re, to] }, i) => [ROWS[i].id, re.source, to])
    .filter(([, source, to]) => literalUnits(source) !== null && to.indexOf('$') === -1)
    .map(([id, source, to]) => [id, textOf(source), to]);

  it('are the 2.x rows of one fixed text whose glyph is the table\'s for that text, and only those', () => {
    const inverse = LITERAL_ROWS.filter(([, text, to]) => tableGlyph(text) === to).map(([id]) => id);
    assert.equal(LITERAL_ROWS.length, 42);
    assert.equal(inverse.length, 38);
    assert.deepEqual(READ_FROM_TABLE, inverse);
  });

  it('leave by hand only the four rows the table read backwards does not give', () => {
    const notInverse = LITERAL_ROWS.filter(([, text, to]) => tableGlyph(text) !== to);
    assert.deepEqual(notInverse.map(([id]) => id), ['uz.order.5', 'uz.small.2', 'uz.glyphs.23', 'uz.medial-ra.8']);
    // e moves (no glyph), na is short only after medial ra, ca with ya is drawn as jha, and ra on nya is two glyphs.
    assert.deepEqual(notInverse.map(([, text]) => tableGlyph(text)), [null, null, null, null]);
    assert.equal(tableGlyph('\u1039\u1008'), '\u1069', 'the table reads U+1069 as stacked jha');
  });
});

describe('GLYPHS in one pass (DESIGN.md §3.9)', () => {
  const texts = GLYPH_ROWS.map((row) => textOf(ruleLabel(row)));

  it('reads rows of one fixed text and one glyph, none of which reads a unit that a row before it writes', () => {
    GLYPH_ROWS.forEach((row, i) => {
      assert.notEqual(literalUnits(ruleLabel(row)), null, row.id + ' is a pure literal');
      assert.equal(row.to.indexOf('$'), -1, row.id + ' writes a fixed glyph');
      assert.equal(row.to.length, 1, row.id + ' writes one unit, so the pass never writes more than it reads');
      for (const later of texts.slice(i + 1)) {
        for (const unit of row.to) assert.equal(later.indexOf(unit), -1, row.id + ' writes a unit a later row reads');
      }
    });
  });

  it('meets no two overlapping rows where the later match comes first, but in a stack on a stack', () => {
    const outOfOrder = [];
    texts.forEach((first, x) => texts.forEach((second, y) => {
      for (let shift = 1; shift < first.length; shift++) {
        const overlap = first.slice(shift, shift + second.length);
        if (y >= x || second.slice(0, overlap.length) !== overlap) continue;
        const union = first.slice(0, shift) + (overlap.length === second.length ? first.slice(shift) : second);
        assert.match(union, STACK_ON_STACK, GLYPH_ROWS[y].id + ' inside ' + GLYPH_ROWS[x].id);
        outOfOrder.push(GLYPH_ROWS[x].id + ' then ' + GLYPH_ROWS[y].id);
      }
    }));
    assert.deepEqual(outOfOrder, ['uz.glyphs.17 then uz.glyphs.16', 'uz.glyphs.18 then uz.glyphs.16',
      'uz.glyphs.21 then uz.glyphs.19', 'uz.glyphs.22 then uz.glyphs.19', 'uz.glyphs.22 then uz.glyphs.21']);
  });

  // Every string of up to `length` units of `alphabet`.
  function* stringsOf(alphabet, length) {
    if (length === 0) return;
    yield* alphabet;
    for (const head of stringsOf(alphabet, length - 1)) for (const unit of alphabet) yield head + unit;
  }

  const meeting = ['\u1039', '\u100B', '\u100C', '\u100D', '\u100E', '\u100F', '\u1005', '\u103B', '\u103D', '\u103E',
    '\u102F', '\u1030', '\u103A', '\u102B', '\u104E', '\u1004', '\u1038', '\u1000', 'a'];
  const stacks = ['\u1039', '\u100B', '\u100C', '\u100D', '\u100E', '\u100F', '\u1005', '\u103B', 'a'];
  const SHORT = [...stringsOf(meeting, 4), ...stringsOf(stacks, 5)];
  const sameAsRows = (text) => {
    const expected = applyRuleRows(collapseRepeatedMarks(text, 'unicode'), ROWS);
    if (unicodeToZawgyi(text) !== expected) assert.fail(codes(text) + ': one pass ' + codes(unicodeToZawgyi(text)));
  };

  it('gives what the rows give one by one on every short string of the units where rows meet', () => {
    SHORT.forEach(sameAsRows);
    assert.equal(SHORT.length, 137560 + 66429);
  });

  // The pass writes a text of more than 64 units into a buffer, and a shorter one as joined slices.
  it('gives what the rows give on long text too, written as units rather than slices', () => {
    // Two spaces between strings, so that no virama stands two units after another across them.
    const noStackOnStack = SHORT.filter((text) => !STACK_ON_STACK.test(text));
    const long = [];
    for (let at = 0; at < noStackOnStack.length; at += 20) long.push(noStackOnStack.slice(at, at + 20).join('  '));
    const written = long.filter((text) => text.length > 64 && !STACK_ON_STACK.test(text));
    assert.ok(written.length > long.length * 0.9, written.length + ' of ' + long.length + ' texts are long');
    written.forEach(sameAsRows);
    const word = '\u1000\u103B\u1031\u102C\u1004\u103A\u1038 '; // kyaung, school, and a space: 8 units
    for (const units of [56, 64, 72, 20000]) sameAsRows(word.repeat(units / 8));
  });

  it('runs the rows one by one on a stack on a stack, where one pass would differ', () => {
    // ka, stacked tta, stacked ttha: tta with ttha comes before stacked tta, so the first virama stays.
    const text = '\u1000\u1039\u100B\u1039\u100C';
    assert.equal(unicodeToZawgyi(text), '\u1000\u1039\u1092');
    assert.equal(twoXUnicodeToZawgyi(text), '\u1000\u1039\u1092');
  });
});

describe('the repeat rows (DESIGN.md §3.9)', () => {
  // The trace records a repeat row once if it matched, so a match must always change the text: every match starts
  // with the row's first unit, a literal, and the replacement starts with another unit.
  it('start every match with a literal unit, and replace it with a different one', () => {
    for (const row of ROWS.filter((r) => r.repeat)) {
      const first = /^\\u([0-9a-fA-F]{4})/.exec(row.re.source);
      assert.ok(first, row.id + ': the pattern starts with a literal unit');
      assert.notEqual(row.to[0], '$', row.id + ': the replacement starts with a literal unit');
      assert.notEqual(row.to.charCodeAt(0), parseInt(first[1], 16), row.id);
    }
  });
});

describe('the units each row needs (DESIGN.md §3.10)', () => {
  // Texts that reach every row: the examples, the table probes and their edges, and seeded strings over the units
  // the rows name.
  const probes = tableProbes();
  const units = [...new Set(ROWS.flatMap((row) => row.re.source.match(/\\u[0-9a-f]{4}/g) || []))]
    .map((escape) => String.fromCharCode(parseInt(escape.slice(2), 16))).concat([' ', '\u200B', 'a']);
  const seeded = fc.sample(fc.string({ unit: fc.constantFrom(...units), minLength: 1, maxLength: 14 }),
    { seed: 4711, numRuns: 20000 });
  const TEXTS = EXAMPLES.map(([, text]) => text)
    .concat(TWO_X_PROBE_IDS.flatMap((id) => [probes[id]].concat(probes[id].edges || []).map((p) => p.probe)))
    .concat(seeded);

  // Calls visit(row, text) with each row and the collapsed text it is given, the rows run as 2.x runs them.
  function eachRowTurn(visit) {
    for (const input of TEXTS) {
      let text = collapseRepeatedMarks(input, 'unicode');
      for (const row of ROWS) {
        visit(row, text);
        text = applyRuleRows(text, [row]);
      }
    }
  }

  it('are units of U+1000-U+109F that the pattern writes as literals', () => {
    for (const row of ROWS) {
      assert.ok(row.needs.length > 0, row.id);
      for (const unit of row.needs) {
        const code = unit.charCodeAt(0);
        assert.ok(code >= 0x1000 && code <= 0x109F, row.id);
        assert.ok(row.re.source.indexOf('\\u' + code.toString(16)) !== -1, row.id + ' writes ' + code.toString(16));
      }
    }
  });

  it('are mandatory: every match of a row, on the text it is given, holds one of them', () => {
    const matched = new Map(ROWS.map((row) => [row.id, 0]));
    eachRowTurn((row, text) => {
      for (const match of text.matchAll(new RegExp(row.re.source, 'g'))) {
        matched.set(row.id, matched.get(row.id) + 1);
        assert.ok([...row.needs].some((unit) => match[0].indexOf(unit) !== -1),
          row.id + ' matched ' + codes(match[0]) + ' in ' + codes(text) + ', with none of its needs');
      }
    });
    assert.deepEqual([...matched].filter(([, count]) => count === 0).map(([id]) => id), [], 'rows never matched');
  });

  it('one replace of a repeat row leaves no match of it, so replacing once is 2.x asLongAsMatch (1584410)', () => {
    eachRowTurn((row, text) => {
      if (!row.repeat) return;
      const once = text.replace(row.re, row.to);
      assert.equal(once.search(row.re), -1, row.id + ' on ' + codes(text));
    });
  });

  it('skipping the rows that cannot match changes no result and no trace', () => {
    for (const text of TEXTS) {
      const collapsed = collapseRepeatedMarks(text, 'unicode');
      assert.equal(unicodeToZawgyi(text), applyRuleRows(collapsed, ROWS), codes(text));
      const skipping = createTrace();
      const every = createTrace();
      traceUnicodeToZawgyi(text, skipping);
      startTrace(every, collapsed);
      traceRuleRows(collapsed, ROWS, every);
      assert.deepEqual(skipping, every, codes(text));
    }
  });
});
describe('the examples (D17)', () => {
  it('cover every row id once', () => {
    assert.deepEqual(EXAMPLES.map(([id]) => id), ROWS.map((row) => row.id));
  });

  it('are what 2.x writes', () => {
    for (const [id, text, zawgyi] of EXAMPLES) assert.equal(twoXUnicodeToZawgyi(text), zawgyi, id);
  });

  for (const [id, text, zawgyi] of EXAMPLES) {
    it(id + ' changes its example', () => {
      assert.equal(unicodeToZawgyi(text), zawgyi, codes(text));
      const { trace, result } = traceAsDebugLog(text);
      assert.equal(result, zawgyi);
      assert.ok(trace.records.some((record) => record.id === id), id + ' is not in the trace of ' + codes(text));
    });
  }
});

describe('the table probes (test/fixtures/tables.json)', () => {
  const probes = tableProbes();
  const idOfProbe = new Map(TWO_X_PROBE_IDS.map((probeId, i) => [probeId, ROWS[i].id]));

  it('cover every row', () => {
    for (const probeId of TWO_X_PROBE_IDS) assert.ok(probes[probeId], 'no probe ' + probeId);
  });

  // The probes are the 2.x reference's: 2.11 added a row for stacked jha (05de555) as 'oneTime 41', and numbers the
  // rows after it one higher than the 2.10 rows of the oracle. The core's rows and this map follow with its port.
  it('give 2.x\'s output, and fire the rows 2.x fired, through the 2.x call form', pendingPort('05de555', () => {
    for (const probeId of TWO_X_PROBE_IDS) {
      const entry = probes[probeId];
      for (const { probe, expect } of [entry].concat(entry.edges || [])) {
        assert.equal(asFontConvert(probe, unicodeToZawgyi), expect.output, probeId + ' on ' + codes(probe));
        const fired = asFontConvert(probe, (text) => traceAsDebugLog(text).trace.records.map((r) => r.id));
        assert.deepEqual(typeof fired === 'string' ? [] : fired, expect.fired.map((f) => idOfProbe.get(f)),
          probeId + ' on ' + codes(probe));
      }
    }
  }));
});

describe('unicodeToZawgyi and traceUnicodeToZawgyi (DESIGN.md §2.3, §3.9)', () => {
  it('collapse a mark typed twice, then apply the rows', () => {
    const text = '\u1000\u103C\u103C\u102F\u102F';
    assert.equal(unicodeToZawgyi(text), '\u107E\u1000\u1033');
    const trace = createTrace();
    assert.equal(traceUnicodeToZawgyi(text, trace), '\u107E\u1000\u1033');
    assert.equal(trace.start, '\u1000\u103C\u102F', 'the trace starts at the collapsed text');
  });

  it('give text with nothing to convert back unchanged', () => {
    for (const text of ['', 'abc', '\u1000\u102C', '\u1041\u1042']) {
      assert.equal(unicodeToZawgyi(text), text);
      const { trace } = traceAsDebugLog(text);
      assert.deepEqual(trace.records, []);
    }
  });

  it('record each row that changed the text, with its id, its 2.x label and the text after it', () => {
    const trace = createTrace();
    traceUnicodeToZawgyi('\u1000\u103C\u102C', trace);
    assert.deepEqual(trace.records, [
      {
        id: 'uz.order.1', label: '([\\u1000-\\u1021][^\\u1000-\\u1021]*)([\\u103c\\u1082])',
        text: '\u103C\u1000\u102C'
      },
      { id: 'uz.glyphs.36', label: '\\u103c', text: '\u103B\u1000\u102C' },
      { id: 'uz.medial-ra.1', label: '\\u103b([\\u1000\\u1003\\u1006\\u100f\\u1010\\u1011\\u1018\\u1021\\u101a' +
        '\\u101c\\u101e\\u101f])', text: '\u107E\u1000\u102C' }
    ]);
  });

  it('record a wrapped row under its 2.x label', () => {
    const trace = createTrace();
    traceUnicodeToZawgyi('\u100D\u1039\u100E', trace);
    assert.deepEqual(trace.records.map((r) => [r.id, r.label]), [['uz.glyphs.16', '\\u100d\\u1039\\u100e']]);
  });

  it('record a repeat row once, however many places it changed', () => {
    const trace = createTrace();
    traceUnicodeToZawgyi('\u1000\u103C\u102C \u1000\u103C\u102C', trace);
    assert.equal(trace.records.filter((record) => record.id === 'uz.medial-ra.1').length, 1);
  });

  it('empty a trace that is used again', () => {
    const trace = createTrace();
    traceUnicodeToZawgyi('\u1000\u103C\u102C', trace);
    traceUnicodeToZawgyi('\u1014\u1031', trace);
    assert.equal(trace.start, '\u1014\u1031');
    assert.deepEqual(trace.records.map((record) => record.id), ['uz.order.3']);
  });

  it('read back as 2.x\'s debug log on every example', () => {
    for (const [id, text] of EXAMPLES) assert.deepEqual(traceAsDebugLog(text).log, twoXDebugLog(text), id);
  });
});
