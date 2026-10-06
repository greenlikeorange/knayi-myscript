// The tracked dist/ is the build of the last release, or of the release being prepared. jsDelivr serves main's dist/
// to `@master` links, so dist/ changes only in a release, and then it must equal a fresh build of the same commit.
// A release is either a change of the version in package.json, or, while the version has no tag v<version> yet, a
// commit with the subject `chore(release): <version>` (2.10.0 set its version in 7619008, long before its release
// commit, so that commit rebuilds dist/ without changing the version).
//
//   node scripts/check-dist.js --base <rev>   checks the changes since the merge base of <rev> and HEAD:
//     - the version changed: dist/ must equal a fresh build;
//     - dist/ changed and the version did not: the version must have no tag yet, a commit in the range must be its
//       release commit (subject `chore(release): <version>`), and dist/ must equal a fresh build; anything else fails;
//     - dist/ unchanged, and the version has a tag: dist/ must equal the dist/ of the tag, so a dist/ edited in an
//       earlier push still fails after a later push that does not touch it;
//     - dist/ unchanged, and the version has no tag yet (a release being prepared): passes. Until the release commit,
//       dist/ may be an earlier build (2.10.0's was rebuilt after 7619008 by pull requests merged before this check
//       existed), so there is nothing fixed to compare with; every pull request is still checked for changes.
//   node scripts/check-dist.js --fresh        checks dist/ against a fresh build now (before a release commit)
//   --release <rev>                           also compares dist/ with the dist/ of <rev> when dist/ is unchanged,
//                                             instead of the tag's
//
// The comparison is between the merge base and the working tree, so uncommitted changes count too; a release commit
// counts only once it is committed.

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

const readVersion = () => JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const releaseSubject = (version) => 'chore(release): ' + version;

// The commit the tag v<version> points at, or null when there is no such tag.
function tagged(version) {
  try {
    return git(['rev-parse', '--verify', '--quiet', 'refs/tags/v' + version + '^{commit}']) || null;
  } catch (error) {
    return null; // no such tag
  }
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

// What the changes since the merge base of `base` and HEAD call for: 'fresh' (compare dist/ with a fresh build),
// 'tag' (compare it with the dist/ of the tag), 'none', or null after a failure.
function checkPolicy(base) {
  let mergeBase;
  try {
    mergeBase = git(['merge-base', base, 'HEAD']);
  } catch (error) {
    fail('Cannot find the merge base of ' + base + ' and HEAD (' + String(error.stderr || error.message).trim() + '). Fetch more history, for example `git fetch --unshallow`.');
    return null;
  }
  const changed = lines(git(['diff', '--name-only', mergeBase, '--', 'dist']))
    .concat(lines(git(['ls-files', '--others', '--exclude-standard', '--', 'dist'])));
  const before = JSON.parse(git(['show', mergeBase + ':package.json'])).version;
  const now = readVersion();
  const tag = tagged(now);
  const since = 'since ' + mergeBase.slice(0, 7) + ' (merge base with ' + base + ')';
  const restore = 'Tests build into a temporary directory, so restore it with `git checkout ' + mergeBase.slice(0, 7) + ' -- dist`.';

  if (before !== now) {
    console.log('package.json version ' + before + ' -> ' + now + ' ' + since + ': a release, so dist/ must equal a fresh build.');
    return 'fresh';
  }
  if (!changed.length) {
    if (tag) {
      console.log('dist/ unchanged ' + since + '; version ' + now + ', released as v' + now + '.');
      return 'tag';
    }
    console.log('dist/ unchanged ' + since + '; version ' + now + ' has no tag v' + now + ' yet (a release being prepared), ' +
      'so there is no released dist/ to compare with.');
    return 'none';
  }
  const list = '\n  ' + changed.join('\n  ');
  if (tag) {
    fail(
      'dist/ changed ' + since + ', but version ' + now + ' is released (tag v' + now + ' at ' + tag.slice(0, 7) + '):' + list +
      '\ndist/ changes only in a release, because jsDelivr serves main\'s dist/ to @master links; a new release needs a ' +
      'new version. ' + restore
    );
    return null;
  }
  const subject = releaseSubject(now);
  const release = lines(git(['log', '--format=%H %s', mergeBase + '..HEAD']))
    .map((line) => ({ sha: line.slice(0, 40), subject: line.slice(41) }))
    .find((commit) => commit.subject === subject);
  if (!release) {
    fail(
      'dist/ changed ' + since + ', but the version in package.json is still ' + now + ' and no commit since then is its ' +
      'release commit (subject `' + subject + '`):' + list +
      '\ndist/ changes only in a release, because jsDelivr serves main\'s dist/ to @master links. ' + restore
    );
    return null;
  }
  console.log('dist/ changed ' + since + ' with release commit ' + release.sha.slice(0, 7) + ' (`' + subject + '`; version ' + now +
    ' has no tag yet), so dist/ must equal a fresh build:' + list);
  return 'fresh';
}

// Compares dist/ with the dist/ committed at `rev` (the tag of the release, or --release), file by file.
function checkRelease(rev, label) {
  const sha = git(['rev-parse', '--verify', rev + '^{commit}']);
  const listed = lines(git(['ls-tree', '--name-only', sha, '--', 'dist/'])).map((p) => path.posix.basename(p));
  const names = new Set(FILES.concat(listed, fs.existsSync(dist) ? fs.readdirSync(dist) : []));
  const problems = [];
  for (const name of Array.from(names).sort()) {
    const committed = path.join(dist, name);
    const released = listed.indexOf(name) === -1 ? null
      : execFileSync('git', ['show', sha + ':dist/' + name], { cwd: root, maxBuffer: 1 << 26 });
    if (!released) problems.push(name + ' is in dist/ but not in the release');
    else if (!fs.existsSync(committed)) problems.push(name + ' is missing from dist/');
    else if (!fs.readFileSync(committed).equals(released)) problems.push(name + ' differs from the release');
  }
  if (problems.length) {
    fail(
      'dist/ is not the dist/ of the release (' + label + '):\n  ' + problems.join('\n  ') +
      '\ndist/ changes only in a release. Restore it with `git checkout ' + sha.slice(0, 7) + ' -- dist`.'
    );
  } else {
    console.log('dist/ equals the dist/ of the release (' + label + ').');
  }
}

const base = argument('--base');
const fresh = process.argv.includes('--fresh');
const override = argument('--release');
if (base === null && !fresh && override === null) {
  console.error('Usage: node scripts/check-dist.js --base <rev> | --fresh | --release <rev>');
  process.exit(2);
}
if (base === '' || override === '') {
  console.error((base === '' ? '--base' : '--release') + ' needs a revision, for example origin/main.');
  process.exit(2);
}

const policy = base !== null ? checkPolicy(base) : 'none';
if (policy !== null) {
  if (fresh || policy === 'fresh') {
    checkFresh();
  } else if (override) {
    checkRelease(override, override);
  } else if (policy === 'tag') {
    const version = readVersion();
    checkRelease('refs/tags/v' + version, 'tag v' + version);
  }
}
