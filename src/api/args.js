// @ts-check
// Argument checks of the 3.0 API (DESIGN.md §11.1). Layer L4.
//
// The 3.0 API checks its arguments and throws, where 2.x returned its input or printed a warning:
// - a wrong type is a TypeError with the code ERR_KNAYI_INVALID_ARG_TYPE;
// - a value of the right type that knayi does not accept is a RangeError with the code ERR_KNAYI_INVALID_ARG_VALUE.
// The message names the function and the argument: 'knayi.toUnicode: options.from must be ...'.
//
// Options are per call, in camelCase, and read once; nothing is kept. Every function is map-safe: lines.map(f)
// passes an index where the options go, and an index is no options (core/options.js optionsObject does the same for
// the core). An option that is undefined or null takes its default; a key the function does not take is a
// RangeError that names what the caller most likely meant.

import { deepFreeze } from '../freeze.js';
import { ERR, libraryError } from '../core/errors.js';
import { NO_OPTIONS } from '../core/options.js';

/** @typedef {Readonly<Record<string, unknown>>} Options the options object of a call, as readOptions gives it */
/** @typedef {import('../index.js').Trace} Trace */
/** @typedef {import('../index.js').ZawgyiDetector} ZawgyiDetector */

// value when it is a string; else a TypeError. 3.0 takes strings only: no String objects, numbers or null.
/**
 * @param {string} api
 * @param {string} name
 * @param {unknown} value
 * @returns {string}
 */
export function requireString(api, name, value) {
  if (typeof value === 'string') return value;
  throw libraryError(ERR.INVALID_ARG_TYPE, wrongType(api, name, 'a string', value), TypeError);
}

// The options of a call: an object, or NO_OPTIONS for undefined, null and a number (an index from Array#map).
// Anything else, an array included, is a TypeError. `keys` are the function's options: an own enumerable key that is
// not one of them is a RangeError (unknownOption), since a misspelt option, another function's or 2.x's would
// otherwise be ignored without a word, and the call would read the text otherwise than its caller asked.
/**
 * @param {string} api
 * @param {unknown} value
 * @param {readonly string[]} keys
 * @returns {Options}
 */
export function readOptions(api, value, keys) {
  if (value === undefined || value === null || typeof value === 'number') return NO_OPTIONS;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw libraryError(ERR.INVALID_ARG_TYPE, wrongType(api, 'options', 'an object', value), TypeError);
  }
  const options = /** @type {Options} */ (value);
  const own = Object.keys(options);
  for (let k = 0; k < own.length; k++) {
    if (keys.indexOf(own[k]) !== -1) continue;
    throw libraryError(ERR.INVALID_ARG_VALUE, unknownOption(api, own[k], keys), RangeError);
  }
  return options;
}

// The options of 2.x and the names 3.0 changed, and the option of 3.0 each stands for (MIGRATION.md): 2.x
// truncate's fontType, the first 3.0 names font and policy, and 2.x's detector options.
/** @type {Readonly<Record<string, string>>} */
const RENAMED_OPTIONS = /* @__PURE__ */ deepFreeze({
  font: 'from', fontType: 'from', policy: 'bareConsonants', use_myanmartools: 'zawgyiDetector',
  adapter: 'zawgyiDetector', myanmartools_zg_threshold: 'thresholds'
});

// The message for an option the function does not take: 'knayi.<api>: options.<key> is not an option of <api>',
// then what the caller most likely meant, or the options the function takes.
/**
 * @param {string} api
 * @param {string} key
 * @param {readonly string[]} keys
 * @returns {string}
 */
function unknownOption(api, key, keys) {
  return where(api, 'options.' + key + ' is not an option of ' + api + optionHint(key, keys));
}

// What the caller most likely meant: the 3.0 name of the key, when the function takes it, or else the function's
// options. The 3.0 API has nothing to silence.
/**
 * @param {string} key
 * @param {readonly string[]} keys
 * @returns {string}
 */
function optionHint(key, keys) {
  if (key === 'silent_mode') return ': the 3.0 API writes nothing to the console';
  const renamed = hasOwn(RENAMED_OPTIONS, key) ? RENAMED_OPTIONS[key] : '';
  if (keys.indexOf(renamed) !== -1) return '; did you mean options.' + renamed + '?';
  return ', which takes ' + listOf(keys, '');
}

/**
 * @param {object} object
 * @param {string} key
 */
function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

// options[name] when it is one of `allowed`, `fallback` when it is undefined or null; else a TypeError for a value
// that is not a string, a RangeError for a string that is not allowed.
/**
 * @template {string} T
 * @template F
 * @param {string} api
 * @param {Options} options
 * @param {string} name
 * @param {readonly T[]} allowed
 * @param {F} fallback
 * @returns {T | F}
 */
export function readChoice(api, options, name, allowed, fallback) {
  const value = options[name];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') {
    throw libraryError(ERR.INVALID_ARG_TYPE, wrongType(api, 'options.' + name, 'a string', value), TypeError);
  }
  const choice = /** @type {T} */ (value);
  if (allowed.indexOf(choice) === -1) {
    const what = 'options.' + name + ' must be ' + listOf(allowed, '\'') + ', not ' + JSON.stringify(value);
    throw libraryError(ERR.INVALID_ARG_VALUE, where(api, what), RangeError);
  }
  return choice;
}

// options[name] as a boolean: undefined and null are false.
/**
 * @param {string} api
 * @param {Options} options
 * @param {string} name
 * @returns {boolean}
 */
export function readFlag(api, options, name) {
  const value = options[name];
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  throw libraryError(ERR.INVALID_ARG_TYPE, wrongType(api, 'options.' + name, 'a boolean', value), TypeError);
}

// options[name] as a whole number of at least 0, or `fallback` when it is undefined or null.
/**
 * @param {string} api
 * @param {Options} options
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
export function readCount(api, options, name, fallback) {
  const value = options[name];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number') {
    throw libraryError(ERR.INVALID_ARG_TYPE, wrongType(api, 'options.' + name, 'a number', value), TypeError);
  }
  if (!isWholeNumber(value)) {
    throw libraryError(ERR.INVALID_ARG_VALUE, where(api, 'options.' + name + ' must be a whole number of 0 or more'),
      RangeError);
  }
  return value;
}

// options[name] as a limit: a whole number of 1 or more, or Infinity for none; `fallback` when it is undefined or
// null.
/**
 * @param {string} api
 * @param {Options} options
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
export function readLimit(api, options, name, fallback) {
  const value = options[name];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number') {
    throw libraryError(ERR.INVALID_ARG_TYPE, wrongType(api, 'options.' + name, 'a number', value), TypeError);
  }
  if (value !== Infinity && !(value >= 1 && isWholeNumber(value))) {
    throw libraryError(ERR.INVALID_ARG_VALUE,
      where(api, 'options.' + name + ' must be a whole number of 1 or more, or Infinity'), RangeError);
  }
  return value;
}

// value when it is a function; else a TypeError.
/**
 * @template {Function} F
 * @param {string} api
 * @param {string} name
 * @param {F | unknown} value
 * @returns {F}
 */
export function requireFunction(api, name, value) {
  if (typeof value === 'function') return /** @type {F} */ (value);
  throw libraryError(ERR.INVALID_ARG_TYPE, wrongType(api, name, 'a function', value), TypeError);
}

// options[name] as a string, or `fallback` when it is undefined or null.
/**
 * @param {string} api
 * @param {Options} options
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
export function readText(api, options, name, fallback) {
  const value = options[name];
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value;
  throw libraryError(ERR.INVALID_ARG_TYPE, wrongType(api, 'options.' + name, 'a string', value), TypeError);
}

// options.trace: a trace made by createTrace(), which the call fills, or null.
/**
 * @param {string} api
 * @param {Options} options
 * @returns {Trace | null}
 */
export function readTrace(api, options) {
  const value = /** @type {Trace | null | undefined} */ (options.trace);
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && Array.isArray(value.records)) return value;
  throw libraryError(ERR.INVALID_ARG_TYPE, wrongType(api, 'options.trace', 'a trace from createTrace()', value),
    TypeError);
}

// options.zawgyiDetector: myanmar-tools' ZawgyiDetector, or any object with getZawgyiProbability(text), or null.
/**
 * @param {string} api
 * @param {Options} options
 * @returns {ZawgyiDetector | null}
 */
export function readZawgyiDetector(api, options) {
  const value = /** @type {ZawgyiDetector | null | undefined} */ (options.zawgyiDetector);
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && typeof value.getZawgyiProbability === 'function') return value;
  throw libraryError(ERR.INVALID_ARG_TYPE,
    wrongType(api, 'options.zawgyiDetector', 'an object with getZawgyiProbability(text)', value), TypeError);
}

// options.thresholds: [unicodeBelow, zawgyiAbove], two numbers from 0 to 1, the first no greater than the second;
// `fallback` when undefined or null.
/**
 * @param {string} api
 * @param {Options} options
 * @param {readonly number[]} fallback
 * @returns {readonly number[]}
 */
export function readThresholds(api, options, fallback) {
  const value = options.thresholds;
  if (value === undefined || value === null) return fallback;
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'number' || typeof value[1] !== 'number') {
    throw libraryError(ERR.INVALID_ARG_TYPE, wrongType(api, 'options.thresholds', 'an array of two numbers', value),
      TypeError);
  }
  if (!(value[0] >= 0 && value[0] <= value[1] && value[1] <= 1)) {
    throw libraryError(ERR.INVALID_ARG_VALUE,
      where(api, 'options.thresholds must be [low, high] with 0 <= low <= high <= 1'), RangeError);
  }
  return value;
}

// The message of an error of the 3.0 API: 'knayi.<function>: <what is wrong>' (core/errors.js).
/**
 * @param {string} api
 * @param {string} what
 * @returns {string}
 */
export function where(api, what) {
  return 'knayi.' + api + ': ' + what;
}

// 'knayi.<api>: <name> must be <wanted>, not <what value is>'.
/**
 * @param {string} api
 * @param {string} name
 * @param {string} wanted
 * @param {unknown} value
 * @returns {string}
 */
export function wrongType(api, name, wanted, value) {
  return where(api, name + ' must be ' + wanted + ', not ' + describe(value));
}

/** @param {number} value */
function isWholeNumber(value) {
  return value >= 0 && value <= 0x1FFFFFFFFFFFFF && Math.floor(value) === value;
}

// 'a', 'a or b', 'a, b or c', each between two `quote`s (values) or none (option names, joined by 'and').
/**
 * @param {readonly string[]} values
 * @param {string} quote
 */
function listOf(values, quote) {
  const quoted = values.map((value) => quote + value + quote);
  const last = quote === '' ? ' and ' : ' or ';
  return quoted.length === 1 ? quoted[0] : quoted.slice(0, -1).join(', ') + last + quoted[quoted.length - 1];
}

// What a value is, for a message: 'null', 'undefined', 'an array', 'an object', or 'a' and its type.
/** @param {unknown} value */
function describe(value) {
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) return 'an array';
  return typeof value === 'object' ? 'an object' : 'a ' + typeof value;
}
