// Every public call form of knayi, as compare.mjs checks them and perf.mjs times them.
//
//   id       the name used in reports and in `--expect form:set=n` and `--forms`
//   needs    the export the form calls; a copy without it (an old release) skips the form
//   input    which input sets the form reads: 'myanmar' (corpora, generated and fuzz Myanmar text) or 'win'
//            (Latin-1 and Windows-1252 text, plus the generated and fuzz Myanmar sets, never the corpora)
//   text     the text perf.mjs feeds it: 'unicode', 'zawgyi' or 'win'; null leaves the form out of perf.mjs
//   call     (knayi, string) => result
const unicodeTo = (to) => (k, s) => k.fontConvert(s, to, 'unicode');
const toUnicode = (from) => (k, s) => k.fontConvert(s, 'unicode', from);
const debugToUnicode = (from) => (k, s) => k.fontConvert.debugging(s, 'unicode', from);

export const FORMS = [
  { id: 'normalize', needs: 'normalize', input: 'myanmar', text: 'unicode', call: (k, s) => k.normalize(s) },
  { id: 'fontConvert.zawgyi-unicode', needs: 'fontConvert', input: 'myanmar', text: 'zawgyi', call: toUnicode('zawgyi') },
  { id: 'fontConvert.win-unicode', needs: 'fontConvert', input: 'win', text: 'win', call: toUnicode('win') },
  { id: 'fontConvert.detected-unicode', needs: 'fontConvert', input: 'myanmar', text: 'zawgyi', call: toUnicode(undefined) },
  { id: 'fontConvert.unicode-zawgyi', needs: 'fontConvert', input: 'myanmar', text: 'unicode', call: unicodeTo('zawgyi') },
  { id: 'debugging.zawgyi-unicode', needs: 'fontConvert', input: 'myanmar', text: 'zawgyi', call: debugToUnicode('zawgyi') },
  { id: 'debugging.win-unicode', needs: 'fontConvert', input: 'win', text: 'win', call: debugToUnicode('win') },
  { id: 'debugging.detected-unicode', needs: 'fontConvert', input: 'myanmar', text: 'zawgyi', call: debugToUnicode(undefined) },
  { id: 'debugging.unicode-zawgyi', needs: 'fontConvert', input: 'myanmar', text: 'unicode',
    call: (k, s) => k.fontConvert.debugging(s, 'zawgyi', 'unicode') },
  { id: 'fontDetect', needs: 'fontDetect', input: 'myanmar', text: 'unicode', call: (k, s) => k.fontDetect(s) },
  { id: 'fontDetect.unicode', needs: 'fontDetect', input: 'myanmar', text: 'unicode', call: (k, s) => k.fontDetect(s, 'unicode') },
  { id: 'syllBreak.unicode', needs: 'syllBreak', input: 'myanmar', text: 'unicode', call: (k, s) => k.syllBreak(s, 'unicode') },
  { id: 'syllBreak.zawgyi', needs: 'syllBreak', input: 'myanmar', text: 'zawgyi', call: (k, s) => k.syllBreak(s, 'zawgyi') },
  { id: 'syllBreak.detected', needs: 'syllBreak', input: 'myanmar', text: 'unicode', call: (k, s) => k.syllBreak(s) },
  { id: 'spellingFix.unicode', needs: 'spellingFix', input: 'myanmar', text: 'unicode', call: (k, s) => k.spellingFix(s, 'unicode') },
  { id: 'spellingFix.zawgyi', needs: 'spellingFix', input: 'myanmar', text: 'zawgyi', call: (k, s) => k.spellingFix(s, 'zawgyi') },
  // Lengths of 10 to 120 cover the omission eating most of the budget, one word, a phrase and a sentence.
  ...[10, 30, 60, 120].map((length) => ({
    id: 'truncate.' + length, needs: 'truncate', input: 'myanmar', text: length === 30 ? 'unicode' : null,
    call: (k, s) => k.truncate(s, { length })
  }))
];

export const formById = (id) => FORMS.find((f) => f.id === id);

// Picks forms by id; each pattern may end in * (`debugging.*`).
export function selectForms(patterns) {
  if (!patterns || patterns.length === 0) return FORMS.slice();
  const match = (id, p) => (p.endsWith('*') ? id.startsWith(p.slice(0, -1)) : id === p);
  const unknown = patterns.filter((p) => !FORMS.some((f) => match(f.id, p)));
  if (unknown.length) throw new Error('unknown call form ' + unknown.join(', ') + '; the forms are ' + FORMS.map((f) => f.id).join(', '));
  return FORMS.filter((f) => patterns.some((p) => match(f.id, p)));
}

export const available = (form, lib) => typeof lib[form.needs] === 'function' &&
  (!form.id.startsWith('debugging.') || typeof lib.fontConvert.debugging === 'function');

// What a call produced, as one comparable value: a string result as itself, any other value as its type and JSON,
// and a throw as the error class only. Engine TypeErrors word their messages per runtime and per build (the
// minified build renames variables), so only the class is part of the contract (decision 9b); knayi itself throws
// nothing on these inputs.
export function outcome(form, lib, s) {
  let value;
  try {
    value = form.call(lib, s);
  } catch (e) {
    return '\u0000throw ' + (e && e.constructor && e.constructor.name ? e.constructor.name : typeof e);
  }
  return typeof value === 'string' ? value : '\u0000' + typeof value + ' ' + JSON.stringify(value);
}
