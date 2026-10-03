// The tracked dist/ is the build of the last release. jsDelivr serves main's dist/ to `@master` links, so dist/
// changes only in a release commit, which also changes the version in package.json, and then it must equal a
// fresh build of the same commit.
//
//   node scripts/check-dist.js --base <rev>   fails when dist/ differs from the merge base of <rev> and HEAD while
//                                             the version in package.json does not; when the version changed,
//                                             also checks dist/ against a fresh build
//   node scripts/check-dist.js --fresh        checks dist/ against a fresh build now (before a release commit)
//
// The comparison is between the merge base and the working tree, so uncommitted changes count too.

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FILES, build } = require('./build');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function lines(text) {
  return text ? text.split('\n') : [];
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || '';
}

// Compares dist/ with a fresh build, file by file, and reports each file that differs, is missing or is extra.
function checkFresh() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'knayi-dist-check-'));
  try {
    build(temp);
    const names = new Set(FILES.concat(fs.existsSync(dist) ? fs.readdirSync(dist) : []));
    const problems = [];
    const hash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12);
    for (const name of Array.from(names).sort()) {
      const committed = path.join(dist, name);
      const fresh = path.join(temp, name);
      if (!fs.existsSync(fresh)) {
        problems.push(name + ' is in dist/ but the build does not write it');
      } else if (!fs.existsSync(committed)) {
        problems.push(name + ' is missing from dist/');
      } else {
        const a = fs.readFileSync(committed);
        const b = fs.readFileSync(fresh);
        if (!a.equals(b)) {
          problems.push(name + ' differs: dist/ has ' + a.length + ' B (' + hash(a) + '), a fresh build ' + b.length + ' B (' + hash(b) + ')');
        }
      }
    }
    if (problems.length) {
      fail(
        'dist/ does not match a fresh build of this commit:\n  ' + problems.join('\n  ') +
        '\nRun `npm run build` and commit dist/ with the release.'
      );
    } else {
      console.log('dist/ matches a fresh build (' + FILES.length + ' files).');
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function checkPolicy(base) {
  let mergeBase;
  try {
    mergeBase = git(['merge-base', base, 'HEAD']);
  } catch (error) {
    fail('Cannot find the merge base of ' + base + ' and HEAD (' + String(error.stderr || error.message).trim() + '). Fetch more history, for example `git fetch --unshallow`.');
    return false;
  }
  const changed = lines(git(['diff', '--name-only', mergeBase, '--', 'dist']))
    .concat(lines(git(['ls-files', '--others', '--exclude-standard', '--', 'dist'])));
  const before = JSON.parse(git(['show', mergeBase + ':package.json'])).version;
  const now = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const since = 'since ' + mergeBase.slice(0, 7) + ' (merge base with ' + base + ')';

  if (before !== now) {
    console.log('package.json version ' + before + ' -> ' + now + ' ' + since + ': a release, so dist/ must equal a fresh build.');
    return true;
  }
  if (changed.length) {
    fail(
      'dist/ changed ' + since + ', but the version in package.json is still ' + now + ':\n  ' + changed.join('\n  ') +
      '\ndist/ changes only in release commits, because jsDelivr serves main\'s dist/ to @master links. ' +
      'Tests build into a temporary directory, so restore it with `git checkout ' + mergeBase.slice(0, 7) + ' -- dist`.'
    );
  } else {
    console.log('dist/ unchanged ' + since + '; version ' + now + '.');
  }
  return false;
}

const base = argument('--base');
const fresh = process.argv.includes('--fresh');
if (base === null && !fresh) {
  console.error('Usage: node scripts/check-dist.js --base <rev> | --fresh');
  process.exit(2);
}
if (base === '') {
  console.error('--base needs a revision, for example origin/main.');
  process.exit(2);
}

const versionChanged = base !== null && checkPolicy(base);
if (fresh || versionChanged) checkFresh();
