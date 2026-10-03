// One line of input through one command: as plain text, or as a JSON Lines record (--jsonl).
//
// A record is a JSON object on one line. knayi reads the text from its --field, and writes the result to --into (by
// default the --field itself for text, else the command's own field: encoding, syllables or issues). Every other
// byte of the line is passed through as it was: knayi never re-serializes a record, so key order, white space,
// escapes and numbers beyond what a JavaScript number holds (an id of 20 digits) stay as they were. A record the
// command leaves as it was is written byte for byte.

import { inputError } from './errors.js';

// The output for one line of plain text: what the command writes for it, without the line break.
export function plainLine(command, line, where) {
  const result = command.run(line);
  return { result: result, text: line, output: command.plainText(result, line, where) };
}

// The output for one line of JSON Lines, without the line break. A line of white space alone is passed through as a
// blank line, and is no record.
export function jsonLine(command, line, where, settings) {
  if (isBlank(line)) return { result: null, text: null, output: line };
  const record = parseRecord(line, where);
  const text = record[settings.field];
  if (typeof text !== 'string') {
    throw inputError(where.name + ':' + where.line, 'the record has no string field ' +
      JSON.stringify(settings.field) + ' (it is ' + describe(text) + '); --field names the field that holds the text');
  }
  const result = command.run(text);
  const into = settings.into !== null ? settings.into : command.resultField || settings.field;
  const value = command.jsonValue(result, text);
  const unchanged = into === settings.field && value === text;
  return { result: result, text: text, output: unchanged ? line : withField(line, into, value) };
}

function parseRecord(line, where) {
  let record;
  try {
    record = JSON.parse(line);
  } catch (error) {
    throw inputError(where.name + ':' + where.line, 'not JSON (' + error.message + ')');
  }
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw inputError(where.name + ':' + where.line, 'a record must be a JSON object, not ' + describe(record));
  }
  return record;
}

function describe(value) {
  if (value === undefined) return 'missing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value === 'object' ? 'an object' : 'a ' + typeof value;
}

function isBlank(line) {
  for (let i = 0; i < line.length; i++) if (!isJsonSpace(line.charCodeAt(i))) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Writing one field of a record into its source text, which JSON.parse has already accepted (RFC 8259).

// The line with the value of its member `name` replaced by `value`, written as JSON. Where the name appears more
// than once, JSON.parse kept the last, so that is the one replaced. A record without the member gets it at its end,
// after a comma when it has members, with the spacing of its first member.
export function withField(line, name, value) {
  const members = topLevelMembers(line);
  const json = JSON.stringify(value);
  for (let k = members.length - 1; k >= 0; k--) {
    if (members[k].name === name) return line.slice(0, members[k].valueStart) + json + line.slice(members[k].valueEnd);
  }
  const close = line.lastIndexOf('}');
  const spaced = members.length > 0 && members[0].spacedColon;
  const member = JSON.stringify(name) + (spaced ? ': ' : ':') + json;
  const separator = members.length === 0 ? '' : spaced ? ', ' : ',';
  return line.slice(0, close) + separator + member + line.slice(close);
}

// The members of the object the line holds: { name, valueStart, valueEnd, spacedColon } each, in order. One pass,
// left to right: a string or a nested value is skipped by its own end, so the scan is linear in the line.
function topLevelMembers(line) {
  const members = [];
  let i = skipSpace(line, line.indexOf('{') + 1);
  while (line.charCodeAt(i) === 0x22) { // a member starts with its name, a string
    const nameEnd = skipString(line, i);
    const name = JSON.parse(line.slice(i, nameEnd));
    const colon = skipSpace(line, nameEnd);
    const valueStart = skipSpace(line, colon + 1);
    const valueEnd = skipValue(line, valueStart);
    members.push({ name: name, valueStart: valueStart, valueEnd: valueEnd, spacedColon: valueStart > colon + 1 });
    i = skipSpace(line, valueEnd);
    if (line.charCodeAt(i) === 0x2C) i = skipSpace(line, i + 1); // ','
  }
  return members;
}

// Past the string that starts at i with its quote: past its closing quote, skipping each escaped unit.
function skipString(line, i) {
  let k = i + 1;
  for (;;) {
    const unit = line.charCodeAt(k);
    if (unit === 0x5C) k += 2; // a backslash and the unit it escapes
    else if (unit === 0x22) return k + 1;
    else k++;
  }
}

// Past the value that starts at i: a string, an object or array (to its matching bracket), or a number, true, false
// or null (to the next comma, bracket or space).
function skipValue(line, i) {
  const first = line.charCodeAt(i);
  if (first === 0x22) return skipString(line, i);
  if (first === 0x7B || first === 0x5B) return skipBrackets(line, i);
  let k = i;
  while (k < line.length && !isValueEnd(line.charCodeAt(k))) k++;
  return k;
}

function skipBrackets(line, i) {
  let depth = 0;
  let k = i;
  do {
    const unit = line.charCodeAt(k);
    if (unit === 0x22) {
      k = skipString(line, k);
      continue;
    }
    if (unit === 0x7B || unit === 0x5B) depth++;
    else if (unit === 0x7D || unit === 0x5D) depth--;
    k++;
  } while (depth > 0);
  return k;
}

function skipSpace(line, i) {
  let k = i;
  while (k < line.length && isJsonSpace(line.charCodeAt(k))) k++;
  return k;
}

// JSON's white space: space, tab, line feed and carriage return (RFC 8259 §2).
function isJsonSpace(unit) {
  return unit === 0x20 || unit === 0x09 || unit === 0x0A || unit === 0x0D;
}

function isValueEnd(unit) {
  return unit === 0x2C || unit === 0x7D || unit === 0x5D || isJsonSpace(unit);
}
