const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ts = require('typescript');
const knayi = require('../main');

// index.d.ts marks fontDetect `@deprecated`, pointing to detectEncoding: both of its signatures, and the fontDetect
// property of Knayi. An editor strikes fontDetect through where TypeScript's language service reports the deprecation
// as a suggestion; tsc reports nothing, and nothing prints at run time. This test asks the language service, as an
// editor does, about the consumer below, under the two configurations npm test compiles typecheck/ with (with and
// without esModuleInterop).
//
// A line that ends with "// deprecated" must get a deprecation suggestion, and no other line may. The service does not
// report a namespace member passed uncalled, such as `lines.map(ns.fontDetect)` after `import * as ns`, so the
// consumer has no such line.
const root = path.join(__dirname, '..');
const CONSUMER = [
  "import knayi, { detectEncoding, fontConvert, normalize, setGlobalOptions, spellingFix, syllBreak, truncate, version } from 'knayi-myscript';",
  "import { fontDetect } from 'knayi-myscript'; // deprecated",
  "import type { Knayi } from 'knayi-myscript';",
  'declare const lines: string[];',
  'const all: Knayi = knayi;',
  "fontDetect('a'); // deprecated",
  "fontDetect('a', 'unicode', { adapter: 'myanmartools' }); // deprecated",
  'lines.map(fontDetect); // deprecated',
  "knayi.fontDetect('a'); // deprecated",
  'lines.map(knayi.fontDetect); // deprecated',
  "all.fontDetect('a'); // deprecated",
  'type Detect = typeof fontDetect; // deprecated',
  "detectEncoding('a');",
  'lines.map(detectEncoding);',
  "knayi.detectEncoding('a');",
  'lines.map(knayi.detectEncoding);',
  "fontConvert('a', 'unicode');",
  "fontConvert.debugging('a', 'unicode');",
  "syllBreak('a');",
  'lines.map(spellingFix);',
  'lines.map(truncate);',
  'lines.map(normalize);',
  'setGlobalOptions({ silent_mode: true });',
  'const copy: string = version;',
  'export { copy };'
].join('\n');

// A language service over CONSUMER, a file that exists only here, with the compiler options of a typecheck/ config.
function languageService(config) {
  const configFile = path.join(root, 'typecheck', config);
  const read = ts.readConfigFile(configFile, ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configFile)).options;
  const file = path.join(root, 'typecheck', 'deprecated-consumer.ts');
  const readFile = (name) => (name === file ? CONSUMER : ts.sys.readFile(name));
  const host = {
    getScriptFileNames: () => [file],
    getScriptVersion: () => '1',
    getScriptSnapshot: (name) => {
      const text = readFile(name);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => root,
    getCompilationSettings: () => options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (name) => name === file || ts.sys.fileExists(name),
    readFile: readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories
  };
  return { service: ts.createLanguageService(host, ts.createDocumentRegistry()), file: file };
}

for (const config of ['tsconfig.json', 'tsconfig.no-interop.json']) {
  describe('fontDetect is deprecated in the types (typecheck/' + config + ')', () => {
    const { service, file } = languageService(config);

    it('compiles the consumer without errors', () => {
      const errors = service.getSyntacticDiagnostics(file).concat(service.getSemanticDiagnostics(file));
      assert.deepEqual(errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, ' ')), []);
    });

    it('reports fontDetect as deprecated on the marked lines, and nothing else', () => {
      const source = service.getProgram().getSourceFile(file);
      const reported = service.getSuggestionDiagnostics(file).filter((d) => d.reportsDeprecated);
      const lines = new Set(reported.map((d) => source.getLineAndCharacterOfPosition(d.start).line + 1));
      const marked = new Set();
      CONSUMER.split('\n').forEach((line, i) => {
        if (line.endsWith('// deprecated')) marked.add(i + 1);
      });
      assert.deepEqual([...lines].sort((a, b) => a - b), [...marked].sort((a, b) => a - b));
      for (const d of reported) assert.equal(CONSUMER.substr(d.start, d.length), 'fontDetect');
    });

    it('shows a deprecation that names detectEncoding', () => {
      for (const call of ["fontDetect('a');", "knayi.fontDetect('a');", "all.fontDetect('a');"]) {
        const at = CONSUMER.indexOf(call) + call.indexOf('fontDetect');
        const tags = service.getQuickInfoAtPosition(file, at).tags || [];
        const deprecated = tags.filter((tag) => tag.name === 'deprecated');
        assert.equal(deprecated.length, 1, call);
        assert.match(ts.displayPartsToString(deprecated[0].text), /^Use detectEncoding\b/, call);
      }
    });
  });
}

describe('the @deprecated tags of index.d.ts', () => {
  const file = path.join(root, 'index.d.ts');
  const source = ts.createSourceFile(file, ts.sys.readFile(file), ts.ScriptTarget.Latest, true);

  it('mark fontDetect\'s two signatures and Knayi\'s fontDetect, each pointing to detectEncoding', () => {
    const found = [];
    (function visit(node) {
      const tag = ts.getJSDocDeprecatedTag(node);
      if (tag) {
        const owner = node.parent && ts.isInterfaceDeclaration(node.parent) ? node.parent.name.text + '.' : '';
        found.push(owner + node.name.text);
        assert.match(ts.getTextOfJSDocComment(tag.comment), /^Use detectEncoding\b/, owner + node.name.text);
      }
      ts.forEachChild(node, visit);
    })(source);
    assert.deepEqual(found, ['fontDetect', 'fontDetect', 'Knayi.fontDetect']);
  });

  it('print nothing at run time: fontDetect writes nothing to the console', () => {
    const messages = [];
    const saved = {};
    for (const name of ['log', 'info', 'warn', 'error']) {
      saved[name] = console[name];
      console[name] = (...args) => messages.push(name + ': ' + args.join(' '));
    }
    try {
      assert.equal(knayi.fontDetect('ျမန္မာ'), 'zawgyi');
      assert.equal(knayi.fontDetect('မြန်မာ', 'unicode'), 'unicode');
      assert.deepEqual(['ျမန္မာ', 'abc'].map(knayi.fontDetect), ['zawgyi', 'en']);
    } finally {
      for (const name of Object.keys(saved)) console[name] = saved[name];
    }
    assert.deepEqual(messages, []);
  });
});
