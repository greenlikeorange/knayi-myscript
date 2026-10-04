// What each command of knayi does to one text, and how it writes the result (README.md, "Command line").
//
// A text is one line of plain text, or the --field of one JSON Lines record. Each command calls the 3.0 API
// (src/index.js) once per text, with the options of its command line, so a run holds one line or record at a time,
// whatever the size of its input.
//
// A command is an object:
//   run(text)                        the API's result for the text
//   writesLines                      true: in plain text, one line out for each line in, ending as that line ends;
//                                    false: the output is a report of whole lines, with none for a clean line (check)
//   plainText(result, text, where)   what plain text output writes for the text; where is { name, line } of the input
//   jsonValue(result, text)          the value --jsonl writes to the record
//   resultField                      the field --jsonl writes when --into is not given; null for the --field itself
//   newCounts(), tally(counts, text, result)   what --report counts, besides the records

import { normalize, toUnicode, toZawgyi, detectEncoding, segmentSyllables, explain } from '../../src/index.js';

// The command named on the command line (options.js has made convert to-unicode or to-zawgyi), its options bound.
// zawgyiDetector is myanmar-tools' ZawgyiDetector for --detector myanmar-tools, else null (detector.js).
export function createCommand(name, settings, zawgyiDetector) {
  switch (name) {
    case 'normalize': return textCommand((text) => normalize(text));
    case 'to-unicode': return toUnicodeCommand(settings, zawgyiDetector);
    case 'to-zawgyi': return toZawgyiCommand(settings);
    case 'detect': return detectCommand(zawgyiDetector);
    case 'segment': return segmentCommand(settings);
    case 'check': return checkCommand(zawgyiDetector);
    default: throw new Error('knayi: no command ' + name); // options.js lets no other name through
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The commands that give text: normalize, to-unicode and to-zawgyi.

function textCommand(run) {
  return Object.freeze({
    run: run,
    writesLines: true,
    plainText: (result) => result,
    jsonValue: (result) => result,
    resultField: null,
    newCounts: () => ({ changed: 0 }),
    tally: (counts, text, result) => {
      if (result !== text) counts.changed++;
    }
  });
}

// toUnicode with --from, or with each line detected (--tie, --detector) when --from is not given.
function toUnicodeCommand(settings, zawgyiDetector) {
  const options = Object.freeze({ from: settings.from, tie: settings.tie, zawgyiDetector: zawgyiDetector });
  return textCommand((text) => toUnicode(text, options));
}

// toZawgyi, line by line. --from zawgyi copies the text as it is, as 2.x fontConvert did for a text already in its
// target.
//
// Line by line, an e or a medial ra typed at the start of a line stays on its line, where toZawgyi on a whole text
// moves it onto the line above: rows uz.order.1 and uz.order.3 of src/rules/unicodeToZawgyi.js move them past
// anything that is not a consonant, a line break included (DESIGN.md §10 Q10). A text of several lines (a JSON Lines
// field) converts a line at a time too, so that both formats give the same output.
function toZawgyiCommand(settings) {
  if (settings.from === 'zawgyi') return textCommand((text) => text);
  return textCommand(toZawgyiByLine);
}

function toZawgyiByLine(text) {
  if (text.indexOf('\n') === -1) return toZawgyi(text);
  return text.split('\n').map((line) => toZawgyi(line)).join('\n');
}

// ---------------------------------------------------------------------------------------------------------------
// detect and segment: one value for each text.

// detectEncoding's encoding: 'unicode', 'zawgyi', 'unknown' (the evidence ties) or 'none' (no Myanmar letter).
function detectCommand(zawgyiDetector) {
  const options = Object.freeze({ zawgyiDetector: zawgyiDetector });
  return Object.freeze({
    run: (text) => detectEncoding(text, options).encoding,
    writesLines: true,
    plainText: (encoding) => encoding,
    jsonValue: (encoding) => encoding,
    resultField: 'encoding',
    newCounts: () => ({ encodings: { unicode: 0, zawgyi: 0, unknown: 0, none: 0 } }),
    tally: (counts, text, encoding) => {
      counts.encodings[encoding]++;
    }
  });
}

// segmentSyllables: in plain text the syllables joined by --separator, in JSON Lines their array.
function segmentCommand(settings) {
  const options = Object.freeze({ bareConsonants: settings.bareConsonants, from: settings.from });
  return Object.freeze({
    run: (text) => segmentSyllables(text, options),
    writesLines: true,
    plainText: (syllables) => syllables.join(settings.separator),
    jsonValue: (syllables) => syllables,
    resultField: 'syllables',
    newCounts: () => ({ syllables: 0 }),
    tally: (counts, text, syllables) => {
      counts.syllables += syllables.length;
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------
// check: explain's issues.
//
// Each issue gets a line of its own, '<file>:<line>:<column>: <rule>: <text> -> <fix>', its column counted from 1,
// as compilers and linters write them. The column counts characters (code points), as a Python str does, since the
// command line is for pipelines in other languages (decision 32); the 3.0 API counts UTF-16 units, as JavaScript
// strings do. The two differ only after a character above U+FFFF, such as an emoji. With --jsonl, each record gets
// its issues, whose start and end count characters too.

function checkCommand(zawgyiDetector) {
  const options = Object.freeze({ zawgyiDetector: zawgyiDetector });
  return Object.freeze({
    run: (text) => explain(text, options),
    writesLines: false,
    plainText: issueLines,
    jsonValue: issuesInCodePoints,
    resultField: 'issues',
    newCounts: () => ({ issues: 0, recordsWithIssues: 0, rules: {} }),
    tally: tallyIssues
  });
}

function issueLines(issues, text, where) {
  const characterAt = codePointOffsets(text);
  let lines = '';
  for (const issue of issues) {
    const column = characterAt(issue.start) + 1;
    lines += where.name + ':' + where.line + ':' + column + ': ' + issue.rule + ': ' + JSON.stringify(issue.text) +
      ' -> ' + JSON.stringify(issue.fix) + '\n';
  }
  return lines;
}

function issuesInCodePoints(issues, text) {
  const characterAt = codePointOffsets(text);
  return issues.map((issue) => ({ kind: issue.kind, rule: issue.rule, start: characterAt(issue.start),
    end: characterAt(issue.end), text: issue.text, fix: issue.fix }));
}

function tallyIssues(counts, text, issues) {
  if (issues.length === 0) return;
  counts.issues += issues.length;
  counts.recordsWithIssues++;
  for (const issue of issues) counts.rules[issue.rule] = (counts.rules[issue.rule] || 0) + 1;
}

// A function from a UTF-16 offset of the text to its offset in characters. Only a text with a surrogate pair needs
// the table; a pair counts once, and an unpaired surrogate as the character it is.
function codePointOffsets(text) {
  if (!hasSurrogate(text)) return (offset) => offset;
  const characters = new Int32Array(text.length + 1);
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    characters[i] = count;
    if (!isPairStart(text, i)) count++;
  }
  characters[text.length] = count;
  return (offset) => characters[offset];
}

function hasSurrogate(text) {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xD800 && unit <= 0xDFFF) return true;
  }
  return false;
}

// Whether text[i] is the high half of a surrogate pair, which counts with the low half after it.
function isPairStart(text, i) {
  const unit = text.charCodeAt(i);
  if (unit < 0xD800 || unit > 0xDBFF || i + 1 >= text.length) return false;
  const next = text.charCodeAt(i + 1);
  return next >= 0xDC00 && next <= 0xDFFF;
}
