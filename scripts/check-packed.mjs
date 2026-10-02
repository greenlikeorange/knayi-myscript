import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "knayi-pack-"));
const appDir = fs.mkdtempSync(path.join(os.tmpdir(), "knayi-app-"));

execSync("npm pack --pack-destination " + JSON.stringify(packDir), {
  cwd: root,
  stdio: "inherit"
});

const tarballName = fs.readdirSync(packDir).find((name) => name.endsWith(".tgz"));
if (!tarballName) {
  throw new Error("npm pack did not write a tarball");
}
const tarball = path.join(packDir, tarballName);

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

run(
  "const knayi = require('knayi-myscript');\n" +
    "if (knayi.fontConvert(" + JSON.stringify(greeting) + ", 'unicode', 'zawgyi') !== " + JSON.stringify(expected) + ") {\n" +
    "  throw new Error('packed require failed');\n" +
    "}\n" +
    "console.log('packed require ok', knayi.version);\n",
  "require-check"
);

run(
  "import knayi from 'knayi-myscript';\n" +
    "if (knayi.fontConvert(" + JSON.stringify(greeting) + ", 'unicode', 'zawgyi') !== " + JSON.stringify(expected) + ") {\n" +
    "  throw new Error('packed import failed');\n" +
    "}\n" +
    "console.log('packed import ok', knayi.version);\n",
  "import-check"
);
