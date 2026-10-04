// Every row of the library's tables, for the per-row tests (test/tables.test.js) and the script that finds
// their probes (scripts/testing/table-cases.js). A row has:
// - id: stable while the table keeps its order, such as 'zawgyi glyph U+1031' or 'detector zawgyi 3';
// - label: what the row is, for messages (for a Unicode to Zawgyi rule, the label debugging output logs);
// - exercises(probe): whether a probe really uses the row: the glyph is read, or the rule changes the text at
//   its turn, or the signature decides the detection;
// - run(probe): what the public API returns for the probe, the expectation a case pins;
// - reach(probe), for Unicode to Zawgyi rules: 'call' when the rule fires inside the public call, 'pattern'
//   when only its pattern matches the probe (the rules before it always change such input first);
// - branches, for a row with a pattern: [{ re, turn(probe), apply(re, text) }]. turn gives the text the pattern
//   sees at its turn inside the public call (the earlier rules of its table already applied), or null when the
//   call never runs it on this probe; apply runs the rule on that text with `re` in place of its pattern and
//   returns the result as a string. scripts/testing/table-cases.js runs apply with copies of the pattern that
//   differ in one branch, to find a probe for each branch.
//
// The tables are the 2.x tables of the 2.x reference, which compat follows, read from fresh copies of its library
// in scripts/reference/library/ (scripts/testing/internals.js), which does not export them. The cases of
// test/fixtures/tables.json hold what the reference gives for each probe.

const path = require('path');
const { loadWithInternals } = require('./internals');

const REFERENCE_LIBRARY = path.join(__dirname, '..', 'reference', 'library');
const fromReference = { dir: REFERENCE_LIBRARY };

const ZERO_WIDTH_BREAKS = /[\u200B\u200C]/g;

function codePoint(ch) {
  return 'U+' + ('000' + ch.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
}

function test(re, text) {
  re.lastIndex = 0;
  const found = re.test(text);
  re.lastIndex = 0;
  return found;
}

function countMatches(re, text) {
  re.lastIndex = 0;
  const found = text.match(re);
  return (found && found.length) || 0;
}

// The text the library's detector and breaker see: trimmed, without zero-width spaces and non-joiners.
function cleaned(text) {
  return text.trim().replace(ZERO_WIDTH_BREAKS, '');
}

function applySequences(text, sequences) {
  for (const sequence of sequences) text = text.replace(sequence[0], sequence[1]);
  return text;
}

function replace(re, text, replacement) {
  re.lastIndex = 0;
  const result = text.replace(re, replacement);
  re.lastIndex = 0;
  return result;
}

function loadTables() {
  const syllable = loadWithInternals('syllableRules.js', ['convertRules', 'BREAK_RULES', 'COLLAPSE_MARKS'],
    fromReference);
  return {
    zawgyi: loadWithInternals('zawgyi.js', ['ZAWGYI', 'SEQUENCES'], fromReference).__internals,
    win: require(path.join(REFERENCE_LIBRARY, 'win.js')).tables,
    syllable: syllable.__internals,
    collapseMarks: syllable.collapseMarks,
    detector: loadWithInternals('detection.js', ['library'], fromReference).__internals.library.detect,
    typingFixes: loadWithInternals('typingFixes.js', ['TYPOS'], fromReference).__internals,
    storageOrder: require(path.join(REFERENCE_LIBRARY, 'storageOrder.js'))
  };
}

function buildRows(knayi) {
  const tables = loadTables();
  const rows = [];

  // Glyph and sequence rows of the drawing-order fonts.
  function fontRows(font, table, sequences, roles) {
    const convert = (probe) => knayi.fontConvert(probe, 'unicode', font);
    const stages = (probe) => knayi.fontConvert.debugging(probe, 'unicode', font).matched_patterns;
    Object.keys(table).forEach(function (key) {
      rows.push({
        id: font + ' glyph ' + codePoint(key),
        table: font + ' glyphs',
        label: JSON.stringify(key) + ' ' + table[key][0] + ' ' + JSON.stringify(table[key][1] + (table[key][2] || '')),
        role: roles[table[key][0]],
        key: key,
        exercises: (probe) => applySequences(probe, sequences).indexOf(key) !== -1,
        run: (probe) => ({ output: convert(probe), stages: stages(probe) })
      });
    });
    // A sequence sees the text after the sequences before it, as the font pipeline applies them in order; a
    // probe exercises it when it changes that text.
    sequences.forEach(function (sequence, i) {
      const branch = {
        re: sequence[0],
        turn: (probe) => applySequences(probe.trim(), sequences.slice(0, i)),
        apply: (re, text) => replace(re, text, sequence[1])
      };
      rows.push({
        id: font + ' sequence ' + i,
        table: font + ' sequences',
        label: sequence[0].source,
        pattern: sequence[0],
        branches: [branch],
        exercises: (probe) => {
          const text = branch.turn(probe);
          return branch.apply(sequence[0], text) !== text;
        },
        run: (probe) => ({ output: convert(probe), stages: stages(probe) })
      });
    });
  }
  const roleNames = {};
  Object.keys(tables.win.ROLES).forEach((name) => { roleNames[tables.win.ROLES[name]] = name.toLowerCase(); });
  fontRows('zawgyi', tables.zawgyi.ZAWGYI, tables.zawgyi.SEQUENCES, roleNames);
  fontRows('win', tables.win.WIN, tables.win.SEQUENCES, roleNames);

  // Unicode to Zawgyi rules. A rule fires when debugging output logs its label. PR 1.2 of the refactor plan
  // keeps the old regex source as a third item when it rewrites a pattern, so the label survives.
  const u2z = tables.syllable.convertRules.unicode.zawgyi;
  const u2zRules = [];
  ['oneTime', 'asLongAsMatch'].forEach(function (group) {
    u2z[group].forEach(function (rule, i) {
      u2zRules.push({ id: 'unicode-to-zawgyi ' + group + ' ' + i, rule: rule, group: group,
        label: typeof rule[2] === 'string' ? rule[2] : rule[0].source });
    });
  });
  // fontConvert trims the text and collapses repeated marks, then applies every rule once, in order: each
  // oneTime rule, then each asLongAsMatch rule that matches, which one replace leaves without a match
  // (syllableRules.js, convertText).
  const u2zApply = (r) => (re, text) => replace(re, text, r.rule[1]);
  const u2zTurn = (index) => (probe) => {
    let text = tables.collapseMarks(probe.trim(), 'unicode');
    for (let j = 0; j < index; j++) text = u2zApply(u2zRules[j])(u2zRules[j].rule[0], text);
    return text;
  };
  const idOfLabel = {};
  u2zRules.forEach((r) => { if (!idOfLabel[r.label]) idOfLabel[r.label] = r.id; });
  const logged = (probe) => knayi.fontConvert.debugging(probe, 'zawgyi', 'unicode').matched_patterns;
  u2zRules.forEach(function (r, index) {
    rows.push({
      id: r.id,
      table: 'unicode-to-zawgyi',
      label: r.label,
      pattern: r.rule[0],
      branches: [{ re: r.rule[0], turn: u2zTurn(index), apply: u2zApply(r) }],
      reach: (probe) => (logged(probe).indexOf(r.label) !== -1 ? 'call' : test(r.rule[0], probe) ? 'pattern' : null),
      exercises: (probe) => logged(probe).indexOf(r.label) !== -1 || test(r.rule[0], probe),
      run: (probe) => ({
        output: knayi.fontConvert(probe, 'zawgyi', 'unicode'),
        fired: logged(probe).map((label) => idOfLabel[label] || label)
      })
    });
  });

  // Detector signatures. A probe exercises a signature when the signature decides the detection: with its
  // matches the probe is its font, and without them it is not.
  const types = Object.keys(tables.detector);
  function scores(text) {
    const score = {};
    types.forEach((type) => {
      score[type] = tables.detector[type].reduce((sum, re) => sum + countMatches(re, text), 0);
    });
    return score;
  }
  types.forEach(function (type) {
    const other = types.filter((t) => t !== type)[0];
    tables.detector[type].forEach(function (re, i) {
      rows.push({
        id: 'detector ' + type + ' ' + i,
        table: 'detector signatures',
        label: re.source,
        pattern: re,
        // Every signature counts its matches in the cleaned text.
        branches: [{ re: re, turn: cleaned, apply: (other, text) => String(countMatches(other, text)) }],
        // A signature that always comes with another needs a match of the other font to decide alone.
        contextPatterns: types.reduce((all, t) => all.concat(tables.detector[t]), []).filter((other) => other !== re),
        exercises: (probe) => {
          const text = cleaned(probe);
          if (!/[\u1000-\u109F]/.test(text)) return false;
          const score = scores(text);
          const own = countMatches(re, text);
          return own > 0 && score[type] > score[other] && score[type] - own <= score[other];
        },
        run: (probe) => ({
          unicode: knayi.fontDetect(probe, 'unicode', { adapter: 'rules' }),
          zawgyi: knayi.fontDetect(probe, 'zawgyi', { adapter: 'rules' })
        })
      });
    });
  });

  // Break rules, applied in order as syllBreak applies them. A rule fires when it changes the text at its turn.
  // The Zawgyi kinzi rule has a third item, a pattern that turns it off; it gets a second row for that.
  function breakTurn(font, index, text) {
    const rules = tables.syllable.BREAK_RULES[font];
    let current = text;
    for (let i = 0; i < index; i++) {
      if (rules[i][2] && test(rules[i][2], text)) continue;
      rules[i][0].lastIndex = 0;
      current = current.replace(rules[i][0], rules[i][1]);
    }
    rules[index][0].lastIndex = 0;
    return { before: current, after: current.replace(rules[index][0], rules[index][1]) };
  }
  ['zawgyi', 'unicode'].forEach(function (font) {
    tables.syllable.BREAK_RULES[font].forEach(function (rule, i) {
      const run = (probe) => ({ output: knayi.syllBreak(probe, font, '|') });
      const turnOf = (probe) => {
        const text = cleaned(probe);
        return rule[2] && test(rule[2], text) ? null : breakTurn(font, i, text).before;
      };
      rows.push({
        id: 'break ' + font + ' ' + i,
        table: 'break rules',
        label: rule[0].source,
        pattern: rule[0],
        branches: [{ re: rule[0], turn: turnOf, apply: (re, text) => replace(re, text, rule[1]) }],
        exercises: (probe) => {
          const text = cleaned(probe);
          if (!/[\u1000-\u109F]/.test(text) || (rule[2] && test(rule[2], text))) return false;
          const turn = breakTurn(font, i, text);
          return turn.after !== turn.before;
        },
        run: run
      });
      if (!rule[2]) return;
      rows.push({
        id: 'break ' + font + ' ' + i + ' turned off',
        table: 'break rules',
        label: rule[2].source,
        pattern: rule[0],
        alsoPattern: rule[2],
        // The switch is tested on the whole cleaned text.
        branches: [{ re: rule[2], turn: cleaned, apply: (re, text) => (test(re, text) ? 'off' : 'on') }],
        exercises: (probe) => {
          const text = cleaned(probe);
          if (!/[\u1000-\u109F]/.test(text) || !test(rule[2], text)) return false;
          const turn = breakTurn(font, i, text);
          return turn.after !== turn.before;
        },
        run: run
      });
    });
  });

  // spellingFix: one row per mark and font. collapseMarks collapses a run of any one mark of the font with a
  // single regex; a row's pattern, [mark]{2,}, is the part of that regex for its mark. A run of one mark ends
  // where any other character starts, so collapsing the other marks never changes it, and every row sees the
  // cleaned text.
  Object.keys(tables.syllable.COLLAPSE_MARKS).forEach(function (font) {
    tables.syllable.COLLAPSE_MARKS[font].split('').forEach(function (mark) {
      const re = new RegExp('[' + mark + ']{2,}', 'g');
      rows.push({
        id: 'collapse ' + font + ' ' + codePoint(mark),
        table: 'spellingFix collapse',
        label: re.source,
        pattern: re,
        branches: [{ re: re, turn: cleaned, apply: (other, text) => replace(other, text, mark) }],
        exercises: (probe) => test(re, cleaned(probe)),
        run: (probe) => ({ output: knayi.spellingFix(probe, font) })
      });
    });
  });

  // normalize's typo rules, which run after the syllables are put in order.
  const TYPOS = tables.typingFixes.TYPOS;
  TYPOS.forEach(function (rule, i) {
    const turn = (probe) => {
      let text = tables.storageOrder.arrangeUnicode(probe.normalize('NFC'));
      for (let t = 0; t < i; t++) text = replace(TYPOS[t][0], text, TYPOS[t][1]);
      return text;
    };
    rows.push({
      id: 'typo ' + i,
      table: 'normalize typos',
      label: rule[0].source,
      pattern: rule[0],
      branches: [{ re: rule[0], turn: turn, apply: (re, text) => replace(re, text, rule[1]) }],
      exercises: (probe) => {
        const text = turn(probe);
        return replace(rule[0], text, rule[1]) !== text;
      },
      run: (probe) => ({ output: knayi.normalize(probe) })
    });
  });

  return rows;
}

module.exports = { buildRows: buildRows, codePoint: codePoint, cleaned: cleaned };
