import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { packFresh } from "./pack-fresh.mjs";

// The package as users install it: packed (with a fresh build in dist/), installed with Bun into a scratch app, and
// loaded through each entry of the exports map with require and with import.

const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "knayi-pack-"));
const appDir = fs.mkdtempSync(path.join(os.tmpdir(), "knayi-app-"));
process.on("exit", () => {
  for (const dir of [packDir, appDir]) fs.rmSync(dir, { recursive: true, force: true });
});

// The tracked dist/ holds the last release, so the tarball gets a fresh build of this checkout.
const tarball = packFresh(packDir);

fs.writeFileSync(path.join(appDir, "package.json"), JSON.stringify({
  name: "knayi-pack-check",
  private: true
}));

execSync("bun add " + JSON.stringify(tarball), {
  cwd: appDir,
  stdio: "inherit"
});

const greeting = "မဂၤလာပါ";
const expected = "မင်္ဂလာပါ";

function run(source, label) {
  const file = path.join(appDir, label + (source.startsWith("import") ? ".mjs" : ".cjs"));
  fs.writeFileSync(file, source);
  execSync("bun " + JSON.stringify(file), {
    cwd: appDir,
    stdio: "inherit"
  });
}

const checks =
  "if (api.toUnicode(" + JSON.stringify(greeting) + ", { from: 'zawgyi' }) !== " + JSON.stringify(expected) + ") {\n" +
  "  throw new Error('the 3.0 API failed');\n" +
  "}\n" +
  "if (compat.fontConvert(" + JSON.stringify(greeting) + ", 'unicode', 'zawgyi') !== " + JSON.stringify(expected) + ") {\n" +
  "  throw new Error('the 2.x API failed');\n" +
  "}\n" +
  "if (Object.keys(stream).length !== 0) throw new Error('./stream exports ' + Object.keys(stream));\n";

run(
  "const api = require('knayi-myscript');\n" +
    "const compat = require('knayi-myscript/compat').default;\n" +
    "const stream = require('knayi-myscript/stream');\n" +
    checks +
    "console.log('packed require ok', api.VERSION);\n",
  "require-check"
);

run(
  "import * as api from 'knayi-myscript';\n" +
    "import compat from 'knayi-myscript/compat';\n" +
    "import * as stream from 'knayi-myscript/stream';\n" +
    checks +
    "console.log('packed import ok', api.VERSION);\n",
  "import-check"
);
