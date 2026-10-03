// Packs the package the way `npm pack` would, except that dist/ is a fresh build of this checkout: the tracked
// dist/ holds the last release (scripts/build.js). npm lists the files it would pack, so the staged copy holds
// exactly what `npm pack` would publish. Used by scripts/check-packed.mjs and scripts/check-types.mjs.
import { execSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const { build } = createRequire(import.meta.url)("./build.js");

const root = path.join(import.meta.dirname, "..");

// Writes the tarball into packDir and returns its path. options.quiet hides npm's listing of the packed files.
export function packFresh(packDir, options = {}) {
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "knayi-stage-"));
  try {
    const listing = JSON.parse(execSync("npm pack --dry-run --json --ignore-scripts", { cwd: root, encoding: "utf8" }));
    for (const { path: file } of listing[0].files) {
      fs.mkdirSync(path.join(stageDir, path.dirname(file)), { recursive: true });
      fs.copyFileSync(path.join(root, file), path.join(stageDir, file));
    }
    build(path.join(stageDir, "dist"));
    execSync("npm pack --ignore-scripts" + (options.quiet ? " --silent" : "") + " --pack-destination " + JSON.stringify(packDir), {
      cwd: stageDir,
      stdio: options.quiet ? ["ignore", "ignore", "inherit"] : "inherit"
    });
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
  const tarballName = fs.readdirSync(packDir).find((name) => name.endsWith(".tgz"));
  if (!tarballName) {
    throw new Error("npm pack did not write a tarball");
  }
  return path.join(packDir, tarballName);
}
