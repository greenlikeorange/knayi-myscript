// Loads one copy of knayi, so that two copies can be compared (compare.mjs) or timed (perf.mjs) in one process.
//
// What is loaded is always the 2.x API: main.js of a 2.x copy, or of a 3.0 copy the './compat' export of its
// package.json (src/compat/index.js, the 2.x API on the 3.0 core, an ES module). A spec names the copy:
//   .  or a path            a checkout or package directory (its 2.x API, as above), or a CommonJS or .mjs file
//   git:<ref>  or  <ref>    a commit, unpacked read-only with `git archive` into a temporary directory
//   npm:<version>           a published version, only if it is already installed (node_modules/knayi-myscript, or the
//                           eval cache's knayi-baseline from scripts/eval/engines.mjs). Nothing is downloaded.
//   min:<file>              a script build such as dist/knayi-myscript.min.js, run in a vm context like a <script>;
//                           its global is the 2.x API, or holds it as knayi.compat (3.0's knayi.min.js)
//   min:<spec>              the script build of that copy, built by its own scripts/build.js in a temporary directory
//                           (an npm package's own dist file is used as shipped)
//   mjs:<file>, mjs:<spec>  the same for the ES module build of the 2.x API (3.0: knayi-myscript-compat.min.mjs),
//                           which is imported
//
// prepareKnayi() does the git and build work and returns a plain descriptor. instantiate() turns a descriptor into a
// library, so worker threads and a Bun child process load the very same copy without repeating that work.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CACHE } from '../datasets.mjs';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const run = (cmd, args, options = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...options });
const git = (args, options) => run('git', ['-C', REPO, ...args], options);

// Temporary directories are removed when the process exits. Unpacked files are read-only, so they are made
// writable again first (Windows refuses to delete a read-only file).
const temps = [];
function tempDir(tag) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'knayi-' + tag + '-')));
  temps.push(dir);
  return dir;
}
function eachFile(dir, fn) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) eachFile(p, fn);
    else if (entry.isFile()) fn(p);
  }
}
export function cleanup() {
  for (const dir of temps.splice(0)) {
    try {
      eachFile(dir, (p) => fs.chmodSync(p, 0o644));
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      // A leftover directory in the system temp directory is harmless.
    }
  }
}
process.on('exit', cleanup);

// The library code of a copy: main.js and library/ of 2.x, src/ of 3.0.
const LIBRARY_PATHS = ['main.js', 'library', 'src'];

// sha256 over every file of LIBRARY_PATHS, with their paths: equal hashes mean equal library code.
export function libraryHash(dir) {
  const files = [];
  const walk = (rel) => {
    const st = fs.statSync(path.join(dir, rel), { throwIfNoEntry: false });
    if (!st) return;
    if (st.isDirectory()) fs.readdirSync(path.join(dir, rel)).forEach((name) => walk(rel + '/' + name));
    else files.push(rel);
  };
  LIBRARY_PATHS.forEach(walk);
  const hash = crypto.createHash('sha256');
  for (const rel of files.sort()) hash.update(rel + '\0').update(fs.readFileSync(path.join(dir, rel))).update('\0');
  return hash.digest('hex');
}

const fileHash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// The file that holds a copy's 2.x API, and how it loads: { main, kind }. A 2.x copy has main.js (CommonJS). A 3.0
// copy has none, and its package.json maps './compat' to the 2.x API on the 3.0 core, an ES module. null when the
// directory has neither.
export function apiOf(dir) {
  const main = path.join(dir, 'main.js');
  if (fs.existsSync(main)) return { main, kind: 'cjs' };
  let pkg = null;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch (e) {
    return null;
  }
  const entry = pkg.exports && pkg.exports['./compat'];
  const target = typeof entry === 'string' ? entry : entry && (entry.import || entry.default);
  if (typeof target !== 'string' || !fs.existsSync(path.join(dir, target))) return null;
  return { main: path.join(dir, target), kind: 'esm' };
}

// The commit a checkout is at, whether the code that runs differs from it, and the library hash. `dirty` is true
// when main.js, library/, src/, scripts/ or package.json have changes or new files that are not committed; other
// files (docs/benchmark.*, which the benchmark itself rewrites) do not count.
export const CODE_PATHS = ['main.js', 'library', 'src', 'scripts', 'package.json'];
export function codeState(dir) {
  const state = { commit: null, dirty: null, libraryHash: libraryHash(dir) };
  try {
    const top = run('git', ['-C', dir, 'rev-parse', '--show-toplevel']).trim();
    if (fs.realpathSync(top) !== fs.realpathSync(dir)) return state;
    state.commit = run('git', ['-C', dir, 'rev-parse', 'HEAD']).trim();
    state.dirty = run('git', ['-C', dir, 'status', '--porcelain', '--untracked-files=all', '--', ...CODE_PATHS]).trim() !== '';
  } catch (e) {
    // Not a git checkout (an installed package, an unpacked tarball): only the hash describes it.
  }
  return state;
}

function resolveRef(ref) {
  try {
    return git(['rev-parse', '--verify', '--quiet', ref + '^{commit}']).trim() || null;
  } catch (e) {
    return null;
  }
}

function installedVersion(version) {
  const candidates = [
    path.join(REPO, 'node_modules', 'knayi-myscript'),
    path.join(CACHE, 'engines', version, 'node_modules', 'knayi-baseline')
  ];
  for (const dir of candidates) {
    try {
      if (JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version === version) return fs.realpathSync(dir);
    } catch (e) {
      // Not installed there.
    }
  }
  return null;
}

// What a build needs besides the library: the build script and whatever else scripts/ holds for it.
const SOURCE = LIBRARY_PATHS.concat('package.json');
const BUILD = ['scripts'];

// Unpacks the library code and package.json of a commit (and scripts/ when it is to be built): main.js and
// library/ of a 2.x commit, src/ of a 3.0 one.
function unpack(sha, withBuild) {
  const wanted = SOURCE.concat(withBuild ? BUILD : []);
  const listed = git(['ls-tree', '--name-only', sha, '--', ...wanted]).split('\n').filter(Boolean);
  const is2x = listed.includes('main.js') && listed.includes('library');
  const is3x = listed.includes('src') && listed.includes('package.json');
  if (!is2x && !is3x) throw new Error(sha.slice(0, 7) + ' has neither main.js and library/ nor src/ and package.json');
  const dir = tempDir('git-' + sha.slice(0, 7));
  const tar = git(['archive', '--format=tar', sha, '--', ...listed], { encoding: 'buffer' });
  run('tar', ['-xf', '-', '-C', dir], { input: tar, stdio: ['pipe', 'pipe', 'pipe'] });
  eachFile(dir, (p) => fs.chmodSync(p, 0o444));
  return dir;
}

const short = (sha) => (sha ? sha.slice(0, 7) : '?');

// The 2.x API of a copy's directory, or an error naming what is missing.
function requireApi(dir, what) {
  const api = apiOf(dir);
  if (!api) throw new Error(what + ' has no main.js, and its package.json exports no ./compat');
  return api;
}

// A copy as source code: { dir, main, label, kind, state }.
function prepareSource(spec, { withBuild = false } = {}) {
  let m = /^npm:(.+)$/.exec(spec);
  if (m) {
    const dir = installedVersion(m[1]);
    if (!dir) {
      throw new Error('knayi-myscript@' + m[1] + ' is not installed. Nothing is downloaded here: install it into the eval ' +
        'cache with `KNAYI_EVAL_BASELINE=' + m[1] + ' npm run eval`, or name the release tag instead (git:v' + m[1] + ').');
    }
    return { type: 'npm', dir, ...requireApi(dir, 'npm ' + m[1]), label: 'npm ' + m[1],
      state: { version: m[1], ...codeState(dir) } };
  }
  m = /^git:(.+)$/.exec(spec);
  const asPath = m ? null : path.resolve(spec);
  if (asPath && fs.existsSync(asPath)) {
    const real = fs.realpathSync(asPath);
    if (fs.statSync(real).isDirectory()) {
      const api = requireApi(real, spec);
      const state = codeState(real);
      const where = real === fs.realpathSync(REPO) ? 'working tree' : path.relative(process.cwd(), real) || '.';
      const at = state.commit ? ' (' + short(state.commit) + (state.dirty ? ', uncommitted changes' : '') + ')' : '';
      return { type: 'path', dir: real, ...api, label: where + at, state };
    }
    return { type: 'file', dir: path.dirname(real), main: real, kind: real.endsWith('.mjs') ? 'esm' : 'cjs',
      label: path.relative(process.cwd(), real), state: { fileHash: fileHash(real) } };
  }
  const ref = m ? m[1] : spec;
  const sha = resolveRef(ref);
  if (!sha) throw new Error(spec + ' is not a path, an installed npm:<version> or a git ref that this clone has');
  const dir = unpack(sha, withBuild);
  return { type: 'git', dir, ...requireApi(dir, ref), label: ref + ' (' + short(sha) + ')',
    state: { commit: sha, dirty: false, libraryHash: libraryHash(dir) } };
}

// Builds a copy's dist files with its own scripts/build.js, in a temporary directory, never in the checkout.
const builds = new Map();
function buildDist(source) {
  if (source.type === 'npm') return path.join(source.dir, 'dist');
  if (builds.has(source.dir)) return builds.get(source.dir);
  let dir = source.dir;
  if (!fs.existsSync(path.join(dir, 'scripts', 'build.js'))) throw new Error(source.label + ' has no scripts/build.js');
  if (source.type !== 'git') {
    const copy = tempDir('build');
    for (const p of SOURCE.concat(BUILD)) {
      if (fs.existsSync(path.join(dir, p))) fs.cpSync(path.join(dir, p), path.join(copy, p), { recursive: true });
    }
    dir = copy;
  }
  const modules = path.join(REPO, 'node_modules');
  if (!fs.existsSync(path.join(modules, 'esbuild'))) throw new Error('esbuild is not installed in ' + modules + '; run npm ci first');
  if (!fs.existsSync(path.join(dir, 'node_modules'))) fs.symlinkSync(modules, path.join(dir, 'node_modules'), 'junction');
  run(process.execPath, [path.join(dir, 'scripts', 'build.js')], { cwd: dir });
  builds.set(source.dir, path.join(dir, 'dist'));
  return path.join(dir, 'dist');
}

// Returns a descriptor: { spec, kind: 'cjs' | 'vm' | 'esm', file, label, commit, dirty, version, libraryHash, fileHash }.
export function prepareKnayi(spec) {
  if (typeof spec !== 'string' || spec === '') throw new Error('a knayi copy needs a spec, such as . or origin/main');
  const m = /^(min|mjs):(.*)$/.exec(spec);
  if (!m) {
    const source = prepareSource(spec);
    return { spec, kind: source.kind || 'cjs', file: source.main, label: source.label, ...source.state };
  }
  const kind = m[1] === 'min' ? 'vm' : 'esm';
  const inner = m[2] || '.';
  const asFile = path.resolve(inner);
  if (fs.existsSync(asFile) && fs.statSync(asFile).isFile()) {
    const file = fs.realpathSync(asFile);
    return { spec, kind, file, label: path.relative(process.cwd(), file), fileHash: fileHash(file) };
  }
  const source = prepareSource(inner, { withBuild: true });
  const dist = buildDist(source);
  // The ES module build of the 2.x API: 3.0's knayi-myscript-compat.min.mjs (its knayi-myscript.min.mjs is the 3.0
  // API), 2.9 and 2.10's knayi-myscript.mjs, and knayi-myscript.es.js, the only one of the releases before 2.9.
  const names = m[1] === 'min' ? ['knayi-myscript.min.js']
    : ['knayi-myscript-compat.min.mjs', 'knayi-myscript.mjs', 'knayi-myscript.es.js'];
  const name = names.find((n) => fs.existsSync(path.join(dist, n)));
  if (!name) throw new Error(source.label + ' has no dist/' + names.join(' or dist/'));
  const file = path.join(dist, name);
  const built = source.type === 'npm' ? ' as shipped' : ' built';
  return { spec, kind, file, label: name + ' of ' + source.label + built, ...source.state, fileHash: fileHash(file) };
}

// A fresh module instance each time: entries of this copy are dropped from the require cache before and after
// loading, so two loads of the same directory (an A/A run) do not share module state.
function requireFresh(file) {
  const req = createRequire(file);
  const root = path.dirname(file) + path.sep;
  const drop = () => {
    for (const key of Object.keys(req.cache)) {
      if (key.startsWith(root) && !key.slice(root.length).split(path.sep).includes('node_modules')) delete req.cache[key];
    }
  };
  drop();
  const lib = req(file);
  drop();
  return lib;
}

// A script build sets the `knayi` global, as in a browser. Builds from 2.8.x set window.knayi. 3.0's
// knayi-myscript.min.js sets the 2.x API, as 2.x did (and 3.0.0-next.0's set the 3.0 API, with the 2.x API as its
// `compat`, as 3.0's knayi.min.js does).
function runScript(file) {
  const context = vm.createContext({ console });
  vm.runInContext('this.window = this; this.self = this;', context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  const knayi = context.knayi;
  return knayi && typeof knayi.fontConvert !== 'function' && knayi.compat ? knayi.compat : knayi;
}

let imports = 0;
async function importFresh(file) {
  const ns = await import(pathToFileURL(file).href + '?copy=' + ++imports);
  return ns.default || ns;
}

// Loads the library a descriptor names, in silent mode.
export async function instantiate(desc) {
  let lib;
  if (desc.kind === 'cjs') lib = requireFresh(desc.file);
  else if (desc.kind === 'vm') lib = runScript(desc.file);
  else if (desc.kind === 'esm') lib = await importFresh(desc.file);
  else throw new Error('unknown kind ' + desc.kind);
  if (!lib || typeof lib.fontConvert !== 'function') throw new Error(desc.label + ' does not export knayi');
  if (typeof lib.setGlobalOptions === 'function') lib.setGlobalOptions({ silent_mode: true });
  return lib;
}

export async function loadKnayi(spec) {
  const desc = prepareKnayi(spec);
  return { ...desc, lib: await instantiate(desc) };
}

// One line that says which code a descriptor is.
export function describe(desc) {
  const parts = [desc.label];
  if (desc.libraryHash) parts.push('library ' + desc.libraryHash.slice(0, 12));
  if (desc.fileHash) parts.push('file ' + desc.fileHash.slice(0, 12));
  return parts.join(', ');
}
