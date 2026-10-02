// Runs eval and bench, then rebuilds docs/benchmark.html and docs/benchmark.json from their results.
// Usage: node scripts/eval/page.mjs (npm run bench:page). Results go to the same cache as the other scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CACHE } from './datasets.mjs';

if (process.argv.length > 2) {
  console.error('bench:page takes no options: the page is always built from licensed data only.');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const evalJson = path.join(CACHE, 'eval.json');
const benchJson = path.join(CACHE, 'bench.json');
fs.mkdirSync(CACHE, { recursive: true });

const run = (script, args) => execFileSync(process.execPath, [path.join(here, script), ...args], { stdio: 'inherit' });
run('run.mjs', ['--json', evalJson]);
run('bench.mjs', ['--sweep', '--json', benchJson]);
run('report.mjs', [evalJson, benchJson]);
