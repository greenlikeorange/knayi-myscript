import { execSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const { build } = createRequire(import.meta.url)("./build.js");

const root = path.join(import.meta.dirname, "..");
const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "knayi-stage-"));
const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "knayi-pack-"));
const appDir = fs.mkdtempSync(path.join(os.tmpdir(), "knayi-app-"));
process.on("exit", () => {
  for (const dir of [stageDir, packDir, appDir]) fs.rmSync(dir, { recursive: true, force: true });
});

// The tracked dist/ holds the last release, so pack a copy of the package whose dist/ is a fresh build of this
// checkout. npm lists the files it would pack, so the copy holds exactly what `npm pack` would publish.
const listing = JSON.parse(execSync("npm pack --dry-run --json --ignore-scripts", { cwd: root, encoding: "utf8" }));
for (const { path: file } of listing[0].files) {
  fs.mkdirSync(path.join(stageDir, path.dirname(file)), { recursive: true });
  fs.copyFileSync(path.join(root, file), path.join(stageDir, file));
}
build(path.join(stageDir, "dist"));

execSync("npm pack --ignore-scripts --pack-destination " + JSON.stringify(packDir), {
  cwd: stageDir,
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
