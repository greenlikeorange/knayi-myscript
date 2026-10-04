import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

// Reads the module builds from a fresh build of this checkout (or KNAYI_DIST), not from the tracked dist/,
// which holds the last release.
const { builtDist } = createRequire(import.meta.url)("./build.js");
const load = (file) => import(pathToFileURL(path.join(builtDist(), file)).href);

const { default: compat } = await load("knayi-myscript-compat.min.mjs");
assert.equal(compat.fontConvert("မဂၤလာပါ", "unicode", "zawgyi"), "မင်္ဂလာပါ");
assert.deepEqual(compat.detectEncoding("မဂၤလာပါ"), { encoding: "zawgyi", unicode: 0, zawgyi: 1 });

const api = await load("knayi-myscript.min.mjs");
assert.equal(api.toUnicode("မဂၤလာပါ", { from: "zawgyi" }), "မင်္ဂလာပါ");
console.log("bun esm contract ok", api.VERSION);
