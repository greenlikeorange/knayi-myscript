// The engines we compare: this checkout, a published knayi baseline, myanmar-tools, and Rabbit.
// The published packages are installed into the cache directory, never into the repo.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync, execSync } from 'node:child_process';
import { CACHE } from './datasets.mjs';
import { loadKnayi, REPO } from './lib/knayi.mjs';

export const BASELINE = process.env.KNAYI_EVAL_BASELINE || '2.8.3';
// myanmar-tools 1.2.0 on npm has no build_node/ and cannot be loaded.
const MYANMAR_TOOLS = '1.1.3';
const RABBIT = '1.0.4';
const PACKAGES = ['knayi-baseline', 'myanmar-tools', 'rabbit-node'];

function install(dir) {
  const installed = PACKAGES.every((name) => fs.existsSync(path.join(dir, 'node_modules', name, 'package.json')));
  if (installed) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{ "private": true }\n');
  console.error('installing knayi-myscript@' + BASELINE + ', myanmar-tools@' + MYANMAR_TOOLS + ', rabbit-node@' + RABBIT + ' …');
  const args = [
    'install', '--no-audit', '--no-fund', '--ignore-scripts', '--no-package-lock',
    'knayi-baseline@npm:knayi-myscript@' + BASELINE,
    'myanmar-tools@' + MYANMAR_TOOLS,
    'rabbit-node@' + RABBIT
  ];
  const options = { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] };
  // npm is npm.cmd on Windows, which needs a shell; passing one command string avoids Node's DEP0190 warning.
  if (process.platform === 'win32') execSync('npm ' + args.map((a) => '"' + a + '"').join(' '), options);
  else execFileSync('npm', args, options);
}

// What fontDetect(text, fallback) returns for a detectEncoding result: the encoding it found, or else the fallback,
// and with no fallback 'zawgyi' for a tie and 'en' for text with no Myanmar letters.
const fontDetectAnswer = (found, fallback) => (found.encoding === 'unicode' || found.encoding === 'zawgyi'
  ? found.encoding : fallback || (found.encoding === 'none' ? 'en' : 'zawgyi'));

// Every engine's detect(text) detects once and returns (fallback) => the engine's answer with that fallback, so a
// table that asks with and without a fallback detects each text once.
function knayiEngine(lib, name) {
  lib.setGlobalOptions({ silent_mode: true });
  // A copy with detectEncoding detects once; an older release, such as the baseline, runs fontDetect per fallback.
  const detect = typeof lib.detectEncoding === 'function'
    ? (text) => {
      const found = lib.detectEncoding(text);
      return (fallback) => fontDetectAnswer(found, fallback);
    }
    : (text) => (fallback) => lib.fontDetect(text, fallback);
  return {
    name,
    lib,
    detect,
    toUnicode: (text) => lib.fontConvert(text, 'unicode', 'zawgyi')
  };
}

// The checkout's engine is its 2.x API (lib/knayi.mjs): main.js of a 2.x checkout, compat of a 3.0 one.
export async function loadEngines() {
  const dir = path.join(CACHE, 'engines', BASELINE);
  install(dir);
  const requireCache = createRequire(path.join(dir, 'package.json'));

  const local = (await loadKnayi(REPO)).lib;
  const baseline = requireCache('knayi-baseline');
  const tools = requireCache('myanmar-tools');
  const rabbit = requireCache('rabbit-node');

  const detector = new tools.ZawgyiDetector();
  const converter = new tools.ZawgyiConverter();
  // Same thresholds and fallback as knayi's myanmartools adapter.
  const toolsDetect = (text) => {
    const p = detector.getZawgyiProbability(text);
    return (fallback = 'zawgyi') => (p < 0.05 ? 'unicode' : p > 0.95 ? 'zawgyi' : fallback);
  };

  return {
    local: { ...knayiEngine(local, 'knayi ' + local.version), checkout: true },
    baseline: knayiEngine(baseline, 'knayi ' + baseline.version),
    tools: {
      name: 'myanmar-tools ' + MYANMAR_TOOLS,
      detect: toolsDetect,
      probability: (text) => detector.getZawgyiProbability(text),
      toUnicode: (text) => converter.zawgyiToUnicode(text)
    },
    rabbit: {
      name: 'Rabbit ' + RABBIT,
      toUnicode: (text) => rabbit.zg2uni(text),
      toZawgyi: (text) => rabbit.uni2zg(text)
    }
  };
}
