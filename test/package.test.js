const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const pkg = require('../package.json');
const { builtDist } = require('../scripts/build');

// 3.0's package (decisions 31 and 35): ES module sources only, behind an exports map with one entry per API, for
// Node 22.12 and later, where require() loads an ES module too. The 2.x API is the './compat' entry; 2.x's deep
// paths (library/, main.js) are gone.

const ROOT = path.join(__dirname, '..');

// A require that resolves the package's own name through its exports map, as a user's require does. Node and Bun
// resolve a package's name from inside it by the nearest package.json, and test/'s only says that the tests are
// CommonJS, so this require starts at the root's.
const requireFromRoot = createRequire(path.join(ROOT, 'package.json'));

// The entries of the exports map and the files they name. A test of an entry's types reads them with
// declaredNames(); its module comes from importing the entry by the package's own name.
const ENTRIES = {
  '.': { types: './src/index.d.ts', default: './src/index.js' },
  './compat': { types: './src/compat/index.d.ts', default: './src/compat/index.js' },
  './stream': { types: './src/stream.d.ts', default: './src/stream.js' }
};

// The values a declaration file declares: `export declare const NAME`, `export declare function NAME`, and
// `export default` as 'default'.
function declaredNames(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const names = new Set();
  for (const [, name] of text.matchAll(/^export declare (?:const|function) (\w+)/gm)) names.add(name);
  if (/^export default /m.test(text)) names.add('default');
  return [...names].sort();
}

// An entry's name, as a user imports it: 'knayi-myscript' or 'knayi-myscript/compat'.
const nameOf = (entry) => (entry === '.' ? 'knayi-myscript' : 'knayi-myscript' + entry.slice(1));

// An entry imported by the package's name, resolved through the exports map.
function importEntry(entry) {
  return import(pathToFileURL(requireFromRoot.resolve(nameOf(entry))).href);
}

async function importBuild(file) {
  return import(pathToFileURL(path.join(builtDist(), file)).href);
}

describe('package.json', () => {
  it('is an ES module package for Node 22.12 and later', () => {
    assert.equal(pkg.type, 'module');
    assert.deepEqual(pkg.engines, { node: '>=22.12' });
  });

  it('maps an entry to each API, with types first, and to package.json', () => {
    assert.deepEqual(pkg.exports, Object.assign({}, ENTRIES, { './package.json': './package.json' }));
    for (const entry of Object.keys(ENTRIES)) {
      assert.deepEqual(Object.keys(pkg.exports[entry]), ['types', 'default'], entry + ': TypeScript reads the first');
      for (const file of Object.values(pkg.exports[entry])) assert.ok(fs.existsSync(path.join(ROOT, file)), file);
    }
    // For tools that read no exports map: the 3.0 API.
    assert.equal(pkg.main, ENTRIES['.'].default);
    assert.equal(pkg.types, ENTRIES['.'].types);
  });

  it('ships the sources, their types and the browser builds, and no spec, tests or scripts', () => {
    assert.deepEqual(pkg.files, ['src', '!src/spec'].concat(require('../scripts/build').FILES.map((f) => 'dist/' + f)));
  });

  it('marks only the script build as having side effects', () => {
    assert.deepEqual(pkg.sideEffects, ['./dist/knayi-myscript.min.js']);
    assert.equal(require('../src/package.json').sideEffects, false);
  });

  it('keeps myanmar-tools an optional peer, below the broken 1.2.0 release', () => {
    assert.equal(pkg.peerDependencies['myanmar-tools'], '>=1.1.2 <1.2.0');
    assert.deepEqual(pkg.peerDependenciesMeta, { 'myanmar-tools': { optional: true } });
    assert.equal(pkg.dependencies, undefined);
  });
});

describe('the entries', () => {
  for (const [entry, files] of Object.entries(ENTRIES)) {
    it(entry + ': its types declare exactly what it exports', async () => {
      const module = await importEntry(entry);
      assert.deepEqual(declaredNames(files.types), Object.keys(module).sort());
    });
  }

  it('give every API the version of package.json', async () => {
    assert.equal((await importEntry('.')).VERSION, pkg.version);
    assert.equal((await importEntry('./compat')).version, pkg.version);
    assert.equal((await importEntry('./compat')).default.version, pkg.version);
  });

  it('load through require too, as an ES module, on Node 22.12 and later', () => {
    const api = requireFromRoot('knayi-myscript');
    const compat = requireFromRoot('knayi-myscript/compat');
    assert.equal(api.toUnicode('မဂၤလာပါ', { from: 'zawgyi' }), 'မင်္ဂလာပါ');
    assert.equal(compat.fontConvert('မဂၤလာပါ', 'unicode', 'zawgyi'), 'မင်္ဂလာပါ');
    assert.equal(compat.default.fontConvert, compat.fontConvert);
    assert.equal(requireFromRoot('knayi-myscript/package.json').version, pkg.version);
    for (const entry of Object.keys(ENTRIES)) {
      assert.equal(requireFromRoot.resolve(nameOf(entry)), path.join(ROOT, ENTRIES[entry].default), entry);
    }
  });

  it('give compat\'s default export a non-enumerable default, for TypeScript without esModuleInterop', async () => {
    const knayi = (await importEntry('./compat')).default;
    assert.equal(knayi.default, knayi);
    assert.equal(Object.keys(knayi).includes('default'), false);
  });

  it('leave 2.x\'s deep paths, and every other path, out', () => {
    for (const deep of ['knayi-myscript/library/converter', 'knayi-myscript/main.js', 'knayi-myscript/src/index.js',
      'knayi-myscript/dist/knayi-myscript.min.js']) {
      // Node's error has the code ERR_PACKAGE_PATH_NOT_EXPORTED; Bun's says it cannot find the module.
      const notExported = (error) => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' ||
        (typeof Bun !== 'undefined' && /Cannot find (module|package)/.test(error.message));
      assert.throws(() => requireFromRoot.resolve(deep), notExported, deep);
    }
  });
});

describe('the module builds', () => {
  it('give the compat module build every named export of compat, and its default', async () => {
    const esm = await importBuild('knayi-myscript-compat.min.mjs');
    const compat = await importEntry('./compat');
    assert.deepEqual(Object.keys(esm).sort(), Object.keys(compat).sort());
    for (const name of Object.keys(compat.default)) {
      assert.equal(typeof esm[name], typeof compat[name], 'knayi-myscript-compat.min.mjs is missing ' + name);
      assert.equal(esm[name], esm.default[name], name + ' differs from the default export');
    }
    assert.equal(esm.default.default, esm.default);
    assert.equal(esm.syllBreak('မင်္ဂလာပါ', null, '|'), 'မင်္ဂလာ|ပါ');
  });

  it('give the 3.0 module build every export of the 3.0 API', async () => {
    const esm = await importBuild('knayi-myscript.min.mjs');
    const api = await importEntry('.');
    assert.deepEqual(Object.keys(esm).sort(), Object.keys(api).sort());
    assert.equal(esm.toUnicode('မဂၤလာပါ', { from: 'zawgyi' }), 'မင်္ဂလာပါ');
  });
});
