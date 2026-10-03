// The errors the core throws on purpose (DESIGN.md §2.3, §4 rule 4). Layer L1.
//
// Every throw in src/ throws libraryError(...) with a code from ERR; test/next/guards/errors.test.mjs checks
// this. The one exception is compat's legacyTypeError() (D13), which reproduces the TypeErrors that 2.x threw by
// accident, with no code.
//
// Messages say where the error comes from and what is wrong, in this form:
//   knayi.<function>: <what is wrong>
//   knayi fonts/win.js: glyph U+00D3: <what is wrong>

import { deepFreeze } from '../freeze.js';

export const ERR = /* @__PURE__ */ deepFreeze({
  // TypeError: an argument has the wrong type.
  INVALID_ARG_TYPE: 'ERR_KNAYI_INVALID_ARG_TYPE',
  // RangeError: a value knayi does not accept.
  INVALID_ARG_VALUE: 'ERR_KNAYI_INVALID_ARG_VALUE',
  // Error: a font table fails compileFont's checks, at module load (§3.8).
  INVALID_FONT_TABLE: 'ERR_KNAYI_INVALID_FONT_TABLE',
  // Error: a function of the skeleton that its module's builder has not written yet (§7.2). None may remain at
  // the acceptance gate (§6.3).
  NOT_BUILT: 'ERR_KNAYI_NOT_BUILT'
});

// new Ctor(message) (Error by default), with an own enumerable string property `code`.
export function libraryError(code, message, Ctor) {
  const ErrorType = Ctor || Error;
  const error = new ErrorType(message);
  error.code = code;
  return error;
}
