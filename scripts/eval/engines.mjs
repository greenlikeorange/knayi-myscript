// The engines we compare: this checkout, a published knayi baseline, myanmar-tools, and Rabbit.
// The published packages are installed into the cache directory, never into the repo.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { CACHE } from './datasets.mjs';

export const BASELINE = process.env.KNAYI_EVAL_BASELINE || '2.8.3';
// myanmar-tools 1.2.0 on npm has no build_node/ and cannot be loaded.
const MYANMAR_TOOLS = '1.1.3';
const RABBIT = '1.0.4';

function install(dir) {
  const marker = path.join(dir, 'node_modules', 'knayi-baseline', 'package.json');
  if (fs.existsSync(marker)) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{ "private": true }\n');
  console.error('installing knayi-myscript@' + BASELINE + ', myanmar-tools@' + MYANMAR_TOOLS + ', rabbit-node@' + RABBIT + ' …');
  execFileSync('npm', [
    'install', '--no-audit', '--no-fund', '--ignore-scripts', '--no-package-lock',
    'knayi-baseline@npm:knayi-myscript@' + BASELINE,
    'myanmar-tools@' + MYANMAR_TOOLS,
    'rabbit-node@' + RABBIT
  ], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
}

function knayiEngine(lib, name) {
  lib.setGlobalOptions({ silent_mode: true });
  return {
    name,
    lib,
    detect: (text, fallback) => lib.fontDetect(text, fallback),
    toUnicode: (text) => lib.fontConvert(text, 'unicode', 'zawgyi')
  };
}

export function loadEngines() {
  const dir = path.join(CACHE, 'engines', BASELINE);
  install(dir);
  const requireCache = createRequire(path.join(dir, 'package.json'));
  const requireHere = createRequire(import.meta.url);

  const local = requireHere('../../main.js');
  const baseline = requireCache('knayi-baseline');
  const tools = requireCache('myanmar-tools');
  const rabbit = requireCache('rabbit-node');

  const detector = new tools.ZawgyiDetector();
  const converter = new tools.ZawgyiConverter();
  // Same thresholds and fallback as knayi's myanmartools adapter.
  const toolsDetect = (text, fallback = 'zawgyi') => {
    const p = detector.getZawgyiProbability(text);
    return p < 0.05 ? 'unicode' : p > 0.95 ? 'zawgyi' : fallback;
  };

  return {
    local: knayiEngine(local, 'knayi ' + local.version + ' (this checkout)'),
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
