import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

// Reads the ESM build from a fresh build of this checkout (or KNAYI_DIST), not from the tracked dist/,
// which holds the last release.
const { builtDist } = createRequire(import.meta.url)("./build.js");
const { default: knayi } = await import(pathToFileURL(path.join(builtDist(), "knayi-myscript.mjs")).href);

const converted = knayi.fontConvert("မဂၤလာပါ", "unicode", "zawgyi");
assert.equal(converted, "မင်္ဂလာပါ");
console.log("bun esm contract ok", knayi.version);
