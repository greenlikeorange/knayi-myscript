// Fails when the 3.0 API's output changed but OUTPUT_VERSION was not raised above that of the last release
// (decision 33; CONTRIBUTING.md, "Output stays byte-identical, unless the pull request is DELIBERATE").
//
//   node scripts/next/output-version.mjs --base <ref> --compare <file>
//
// <file> is what `npm run compare -- --base api:<ref> --head api:. --json <file>` wrote: its cells count, per call
// form and input set, the inputs on which the 3.0 API of the base and of this checkout give different output. Any
// difference, expected by --expect or not, is a change to what a function returns.
//
// OUTPUT_VERSION tells a dataset which output it holds, and a dataset can hold only released output. So a change
// needs an OUTPUT_VERSION in src/version.js above that of the latest release the base descends from (its tag
// v<version>, a prerelease included): the first change after a release raises it, and later changes before the
// next release share that number. A 2.x release has no src/version.js and counts as 1, the output 3.0's changes
// start from. Without a release tag in the base's history (a shallow clone), the change must raise the base's own
// number. OUTPUT_VERSION never goes down. CI's Compare job runs this after the comparison of the 3.0 API, and
// test/next/output-version.test.mjs checks outputVersionVerdict.
//
// One exception, which this check does not see: a move of compat's 2.x reference to other output raises
// OUTPUT_VERSION too, even between two releases, since the number names compat's output as well (CONTRIBUTING.md,
// "The public API stays stable"); the port that moves it raises the number (docs/next/DESIGN.md §8).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DECLARATION = /^export const OUTPUT_VERSION = (\d+);$/m;
const VERSION_FILE = 'src/version.js';

const git = (args) => execFileSync('git', ['-C', ROOT].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// What the check says: { ok, message }. changed lists the call forms whose output differs ('' for none); base and
// head are the OUTPUT_VERSION of the base and of this checkout; release is { tag, version } of the latest release
// the base descends from, or null when its history has none.
export function outputVersionVerdict(changed, base, head, release) {
  if (head < base) {
    return { ok: false, message: 'OUTPUT_VERSION went down, from ' + base + ' to ' + head + ': it never does.' };
  }
  if (changed === '') return { ok: true, message: 'OUTPUT_VERSION ' + head + ': the 3.0 API gives the base\'s output.' };
  const floor = release === null ? { version: base, of: 'the base' } : { version: release.version, of: release.tag };
  if (head > floor.version) {
    return { ok: true, message: 'OUTPUT_VERSION ' + head + ', above ' + floor.version + ' of ' + floor.of +
      ', covers the 3.0 API\'s output changes: ' + changed + '.' };
  }
  return { ok: false, message: 'The 3.0 API\'s output changes (' + changed + '), but OUTPUT_VERSION is ' + head +
    ', as in ' + floor.of + ': raise it in ' + VERSION_FILE + ', with a line on what changed (decision 33).' };
}

// --name value pairs: { base, compare }.
function readArguments(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    if ((name !== '--base' && name !== '--compare') || i + 1 >= argv.length) {
      throw new Error('usage: node scripts/next/output-version.mjs --base <ref> --compare <file>');
    }
    options[name.slice(2)] = argv[i + 1];
  }
  if (!options.base || !options.compare) throw new Error('both --base and --compare are needed');
  return options;
}

// The OUTPUT_VERSION a src/version.js declares.
function outputVersionOf(source, where) {
  const match = DECLARATION.exec(source);
  if (!match) throw new Error(where + ' declares no `export const OUTPUT_VERSION = <n>;`');
  return Number(match[1]);
}

function outputVersionAt(ref) {
  return outputVersionOf(git(['show', ref + ':' + VERSION_FILE]), ref + ':' + VERSION_FILE);
}

// { tag, version }: the latest release tag the ref descends from, and its OUTPUT_VERSION (1 for a 2.x release, which
// has no src/version.js); null when the history holds no release tag.
function lastRelease(ref) {
  let tag;
  try {
    tag = git(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', ref]).trim();
  } catch (error) {
    return null;
  }
  try {
    return { tag: tag, version: outputVersionAt(tag) };
  } catch (error) {
    return { tag: tag, version: 1 };
  }
}

// The call forms whose output differs, with their counts: 'form n, form n', largest first, or '' for none.
function changedForms(result) {
  const totals = new Map();
  for (const cell of result.cells) totals.set(cell.form, (totals.get(cell.form) || 0) + cell.differ);
  return [...totals].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
    .map(([form, n]) => form + ' ' + n.toLocaleString('en-US')).join(', ');
}

function main(argv) {
  const options = readArguments(argv);
  const changed = changedForms(JSON.parse(fs.readFileSync(options.compare, 'utf8')));
  const base = outputVersionAt(options.base);
  const head = outputVersionOf(fs.readFileSync(path.join(ROOT, VERSION_FILE), 'utf8'), VERSION_FILE);
  const verdict = outputVersionVerdict(changed, base, head, changed === '' ? null : lastRelease(options.base));
  if (verdict.ok) console.log(verdict.message);
  else console.error(verdict.message);
  return verdict.ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error('output-version: ' + error.message);
    process.exitCode = 2;
  }
}
